import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/modules/auth'
import { getErrorMessage } from '@/utils/error'

import { buildCollaborationUrl } from '../api/collaboration'
import {
  COLLABORATION_CURSOR_THROTTLE_MS,
  COLLABORATION_EDIT_INTERVAL_MS,
  COLLABORATION_LOG_LIMIT,
} from '../constants'
import { codeUnitsToByteOffset } from '../ot/ot'
import { createWebSocketTransport } from '../ot/connection'
import type { CollabTransport } from '../ot/connection'
import { OtClient, SEP } from '../ot/ot-client'
import type {
  ClientInitMessage,
  ClientMessage,
  Cursor,
  ServerMessage,
  ServerUser,
  ServerUserMsg,
} from '../ot/ot-client'
import type { CollaborationStatus, CollaborationUser, RemoteCursor } from '../types'

/**
 * 光标端点的粘附方向。
 *
 * `1` 表示「粘在插入点右侧」：别人恰好把文本插在光标处时，光标被推到插入内容
 * 之后。两个端点都用同一方向，普通光标（anchor == head）就不会因为一次插入被
 * 拆成选区。含义见 `docs/document/editDocument.md` 的 `Cursor.assoc`。
 */
const CURSOR_ASSOC = 1

/** 远端用户没有已知配色时的兜底颜色（服务端调色板缺失时的降级）。 */
const CURSOR_COLOR_FALLBACK = '#9AA4B2'

/** 把服务端 `users` 归一化为面板 / 光标需要的结构。 */
function normalizeUsers(raw: ServerUser[] | null | undefined): CollaborationUser[] {
  if (!Array.isArray(raw)) return []

  const users: CollaborationUser[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    users.push({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      cursorColor: String(item.cursor_color ?? ''),
    })
  }
  return users
}

/**
 * 协作编辑 store：把无副作用的 OT 状态机（`ot/ot-client.ts`）与 WebSocket 传输
 * （`ot/connection.ts`）编排成 Vue 可消费的响应式状态，并维护用户 / 光标这些
 * 协议新增的会话信息。
 *
 * 数据流：视图 → store action → api/ot → 后端；远端帧 → store → 视图。
 * 视图永远不直接碰 socket 或 OT 客户端，OT 客户端也不感知 DOM / Router。
 */
export const useCollaborationStore = defineStore('collaboration', () => {
  /** 当前登录用户的凭证来源；仅用于取 token 放进 init 首帧。 */
  const auth = useAuthStore()

  // state
  const status = ref<CollaborationStatus>('idle')
  const documentId = ref<string | null>(null)
  /** 本地编辑器文本（= 服务端文档 + 尚未确认的本地算子）。 */
  const content = ref('')
  /** 服务端已确认版本号。 */
  const revision = ref(0)
  /** 服务端维护的文档标题（不参与 OT，随 init / set_title 广播更新）。 */
  const title = ref('')
  /** 在线用户（含自己），来自 init 与 user 广播。 */
  const users = ref<CollaborationUser[]>([])
  /** 服务端为当前连接分配的光标颜色。 */
  const selfCursorColor = ref('')
  /** 服务端为当前连接分配的 user_id（token 鉴权后由 init 回传）。 */
  const selfUserId = ref('')
  /** 是否已收到 init（收到前禁止编辑，避免基于空文档生成算子）。 */
  const ready = ref(false)
  const desynced = ref(false)
  const error = ref<string | null>(null)
  /** 开发期活动日志（便于排查协议问题）。 */
  const logs = ref<string[]>([])

  // 非响应式的 OT 会话与传输对象，保存在 store 闭包内。
  const client = new OtClient()
  let transport: CollabTransport | null = null
  /** 会话序号：连接换代后丢弃旧 socket 的迟到回调。 */
  let session = 0

  /**
   * 每条光标以 `user_id` 为键的最新原始记录（偏移是**服务端字节坐标**，尚未映射到
   * 本地文本、也未过滤自己）。它不是响应式的，改动后靠 `clientTick` 触发重算。
   */
  const remoteRaw = new Map<string, Cursor>()
  /** 本地算子 / 版本号变化后 +1，作为远端光标重算的依赖信号。 */
  const clientTick = ref(0)

  // 定时器与光标发送状态（非响应式）。
  /** 定时采样「文本框内容」的计时器；不依赖输入事件。 */
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let cursorTimer: ReturnType<typeof setTimeout> | null = null
  /** 上次上报后光标是否又被改动（在途算子期间会被置位，待确认后补发）。 */
  let cursorDirty = false
  /** 最近一次本地选区（编辑器 UTF-16 码元坐标）。 */
  let localCursor: { anchor: number; head: number } | null = null
  /**
   * 读取文本框当前全文的回调，由视图在挂载时登记。计算只通过它采样，不消费输入事件；
   * 未登记（如脱离组件单独使用 store）时退化为读取 `content`。
   */
  let readSource: (() => string) | null = null

  // getters
  const isConnected = computed(() => status.value === 'connected')
  const canEdit = computed(() => status.value === 'connected' && ready.value)
  const onlineCount = computed(() => users.value.length)

  /**
   * 编辑器要绘制的远端光标 / 选区，偏移为本地文本（`applyText`）的 **UTF-8 字节**。
   *
   * 原始偏移在服务端坐标系上，这里只做「经本地在途算子映射到 applyText」这一步；
   * 字节 → CodeMirror 码元由编辑器按当前文档完成，这样本地输入时装饰可由 CodeMirror
   * 自行映射，不必每次按键都由 store 重算。自己的光标交给编辑器原生选区，因此过滤掉。
   */
  const remoteCursors = computed<RemoteCursor[]>(() => {
    // 依赖信号：本地算子变化不会改动 remoteRaw，必须显式读取。
    void clientTick.value

    const list: RemoteCursor[] = []

    for (const cursor of remoteRaw.values()) {
      const userId = cursor.user_id
      if (!userId || userId === selfUserId.value) continue

      const user = users.value.find((item) => item.id === userId)
      list.push({
        userId,
        name: user?.name ?? '',
        color: user?.cursorColor || CURSOR_COLOR_FALLBACK,
        anchor: client.mapServerOffsetToLocal(cursor.anchor.offset, cursor.anchor.assoc),
        head: client.mapServerOffsetToLocal(cursor.head.offset, cursor.head.assoc),
      })
    }

    return list
  })

  // actions
  function pushLogs(lines: string[]): void {
    if (lines.length === 0) return
    // 日志字段用 SEP（\u0001）分隔，展示时替换为普通空白。
    const formatted = lines.map((text) => text.split(SEP).join('  ').trimEnd())
    logs.value = [...formatted, ...logs.value].slice(0, COLLABORATION_LOG_LIMIT)
  }

  /** 把 OT 客户端里的版本号 / 身份 / 失步状态同步到响应式 state。 */
  function syncFromClient(): void {
    const snapshot = client.getState()
    revision.value = snapshot.receiveReversion
    selfUserId.value = snapshot.userId
    desynced.value = snapshot.desynced
    clientTick.value += 1
  }

  /** 新增或覆盖一个在线用户（按 id 去重）。 */
  function upsertUser(user: CollaborationUser): void {
    const index = users.value.findIndex((item) => item.id === user.id)
    if (index < 0) {
      users.value = [...users.value, user]
      return
    }
    const next = users.value.slice()
    next[index] = user
    users.value = next
  }

  /** 应用 `init` 里的完整名册（整体替换）。 */
  function replaceUsers(raw: ServerUser[] | null | undefined): void {
    users.value = normalizeUsers(raw)
  }

  /** 应用 `user` 广播：加入者登记，离开者连同其光标一起移除。 */
  function applyUsers(message: ServerUserMsg | null | undefined): void {
    if (!message) return

    for (const user of normalizeUsers(message.join_users)) {
      upsertUser(user)
    }

    for (const user of normalizeUsers(message.quit_users)) {
      users.value = users.value.filter((item) => item.id !== user.id)
      if (remoteRaw.delete(user.id)) clientTick.value += 1
    }
  }

  /** 应用一批光标更新：按 `user_id` 覆盖，保留最新一次。 */
  function applyCursors(list: Cursor[] | null | undefined): void {
    if (!Array.isArray(list) || list.length === 0) return

    for (const cursor of list) {
      if (typeof cursor !== 'object' || cursor === null) continue
      const userId = String(cursor.user_id ?? '')
      if (!userId) continue
      remoteRaw.set(userId, cursor)
    }
    clientTick.value += 1
  }

  /** 清空远端光标（重连 / init 前）。 */
  function clearRemoteCursors(): void {
    if (remoteRaw.size === 0) return
    remoteRaw.clear()
    clientTick.value += 1
  }

  /** 登记读取「文本框内容」的回调（视图挂载时调用）。 */
  function attachSource(reader: () => string): void {
    readSource = reader
  }

  /** 解除采样源（视图卸载时调用）。 */
  function detachSource(): void {
    readSource = null
  }

  /**
   * 文本框当前全文。
   *
   * 计算只从这里取数：不消费任何输入事件，未登记采样源时退化为 `content`。
   */
  function sourceText(): string {
    return readSource ? readSource() : content.value
  }

  /** 把已折算好、尚未发出的算子上送；不重新计算。 */
  function dispatchPending(): void {
    if (status.value !== 'connected') return

    const snapshot = client.getState()
    if (snapshot.dispatched) return

    const payload = client.buildSendMessage()
    if (!payload || !transport) return

    if (!transport.send(payload.message)) {
      error.value = '编辑算子发送失败（连接可能已断开）'
      return
    }

    client.markSent()
    syncFromClient()
    pushLogs([`send base-revision=${snapshot.receiveReversion}`])
  }

  /**
   * 采样一次：比较「文本框内容」与前端本地副本（`OtClient.applyText`），不同才折算成
   * 算子并上送。由固定间隔的定时器调用，完全由内容比较驱动，与输入事件无关。
   */
  function syncFromSource(): void {
    if (status.value !== 'connected' || !ready.value) return

    const text = sourceText()
    if (text !== client.renderText()) {
      const calculated = client.calculate(text)
      pushLogs(calculated.lines)
      if (!calculated.ok) {
        error.value = calculated.error ?? '本地变更无法生成编辑算子'
        return
      }
      content.value = text
      syncFromClient()
    }

    dispatchPending()
    maybeSendCursor()
  }

  /** 启动定时采样（每 500ms 检查一次文本框内容）。 */
  function startPolling(): void {
    if (pollTimer !== null) return
    pollTimer = setInterval(syncFromSource, COLLABORATION_EDIT_INTERVAL_MS)
  }

  /** 停止定时采样。 */
  function stopPolling(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  /** 节流调度一次光标上报；已有排期时不重复排队。 */
  function scheduleCursor(): void {
    if (cursorTimer !== null) return
    cursorTimer = setTimeout(() => {
      cursorTimer = null
      sendCursor()
    }, COLLABORATION_CURSOR_THROTTLE_MS)
  }

  /** 若在途算子期间攒下了未上报的光标，算子确认后补发。 */
  function maybeSendCursor(): void {
    if (cursorDirty) scheduleCursor()
  }

  /** 上报本地光标 / 选区。偏移必须是服务端坐标，因此有在途算子时延后。 */
  function sendCursor(): void {
    if (status.value !== 'connected' || !ready.value || !localCursor || !transport) return

    // 有在途算子，或文本框里还含尚未折算成算子的输入时，本地坐标领先于服务端，
    // 此刻上报会被服务端再变换一次；先记下，等文本与服务端对齐后补发。
    if (client.hasPending() || sourceText() !== client.renderText()) {
      cursorDirty = true
      return
    }

    const text = sourceText()
    const message: ClientMessage = {
      cursor: {
        user_id: '',
        reversion: revision.value,
        anchor: { offset: codeUnitsToByteOffset(text, localCursor.anchor), assoc: CURSOR_ASSOC },
        head: { offset: codeUnitsToByteOffset(text, localCursor.head), assoc: CURSOR_ASSOC },
      },
    }

    if (!transport.send(message)) {
      error.value = '光标位置发送失败（连接可能已断开）'
      return
    }
    cursorDirty = false
  }

  /**
   * 上报文档标题变更。
   *
   * 标题不参与 OT：这里只把新标题发给服务端，本地值等服务端广播回来再更新，从而
   * 让所有客户端（含设置者自己）收敛到同一标题。与当前标题相同则不发。
   */
  function setTitle(nextTitle: string): void {
    if (status.value !== 'connected' || !ready.value || !transport) return

    const value = nextTitle.trim()
    if (value === title.value.trim()) return

    const message: ClientMessage = { set_title: { title: value } }
    if (!transport.send(message)) {
      error.value = '标题发送失败（连接可能已断开）'
      return
    }
    pushLogs([`send set_title ${JSON.stringify(value)}`])
  }

  /** 处理一条服务端帧：入队 → 立即消费 → 回填文本 → 同步用户 / 光标 → 尝试续发。 */
  function handleMessage(message: ServerMessage): void {
    const queued = client.enqueue(message)
    pushLogs(queued.lines)

    if (message.init) {
      // token 鉴权后身份由服务端回传，用它识别「自己的算子」。
      client.setUserId(message.init.user_id ?? '')
      // 标题与正文一样只存在于协作会话内存中，init 下发当前值（可能为空串）。
      title.value = message.init.title ?? ''
      replaceUsers(message.init.users)
      selfCursorColor.value = message.init.cursor_color ?? ''
      ready.value = true
      clearRemoteCursors()
      applyCursors(message.init.cursor)
    }

    // 标题不参与 OT，服务端会向所有连接（含设置者自己）广播，客户端直接采纳。
    if (message.set_title) {
      title.value = message.set_title.title ?? ''
    }

    applyUsers(message.user)

    // 消费前用文本框真实内容把尚未折算的输入折叠进算子，避免远端改动覆盖本地输入。
    const consumed = client.consumePending(sourceText())
    pushLogs(consumed.lines)
    if (!consumed.ok) desynced.value = true

    // edit 帧可能同时携带被服务端平移后的光标（在消费算子之后应用）。
    applyCursors(message.cursor)

    const next = client.renderText()
    if (next !== content.value) content.value = next

    syncFromClient()
    dispatchPending()
    maybeSendCursor()
  }

  /** 连接建立后发送唯一一条 init 首帧：按后端要求只带 token。 */
  function sendInit(token: string): void {
    client.reset('', 0)
    client.setUserId('')
    content.value = ''
    revision.value = 0
    title.value = ''
    desynced.value = false
    selfCursorColor.value = ''
    clearRemoteCursors()

    const payload: ClientInitMessage = { token }
    if (!transport?.send(payload)) {
      error.value = 'init 消息发送失败'
      pushLogs(['init 消息发送失败'])
      return
    }
    pushLogs([`init 已发送（token ${token ? '已携带' : '缺失'}）`])
  }

  /** 打开指定文档的协作连接。 */
  function connect(id: string): void {
    disconnect()
    documentId.value = id
    error.value = null
    logs.value = []
    status.value = 'connecting'
    ready.value = false

    session += 1
    const current = session
    const token = auth.token ?? ''
    const url = buildCollaborationUrl(id)

    transport = createWebSocketTransport(url, {
      onOpen: () => {
        if (current !== session) return
        status.value = 'connected'
        pushLogs([`WebSocket 已连接：${url}`])
        sendInit(token)
        startPolling()
      },
      onMessage: (message) => {
        if (current !== session) return
        handleMessage(message as ServerMessage)
      },
      onClose: (code, reason) => {
        if (current !== session) return
        status.value = 'closed'
        ready.value = false
        transport = null
        stopPolling()
        pushLogs([`WebSocket 已断开（${code}${reason ? ` ${reason}` : ''}）`])
      },
      onError: (err) => {
        if (current !== session) return
        status.value = 'error'
        error.value = getErrorMessage(err, 'WebSocket 连接异常')
        stopPolling()
        pushLogs([`WebSocket 异常：${error.value}`])
      },
    })
  }

  /** 停掉采样 / 节流计时器。 */
  function clearTimers(): void {
    stopPolling()
    if (cursorTimer !== null) {
      clearTimeout(cursorTimer)
      cursorTimer = null
    }
    cursorDirty = false
  }

  /** 关闭连接并清空会话状态。 */
  function disconnect(): void {
    // 退出前最后采样一次，尽力把尚未上传的本地变更送出。
    if (status.value === 'connected') syncFromSource()
    clearTimers()

    session += 1
    transport?.close()
    transport = null

    status.value = 'idle'
    ready.value = false
    content.value = ''
    revision.value = 0
    title.value = ''
    users.value = []
    selfUserId.value = ''
    selfCursorColor.value = ''
    desynced.value = false
    error.value = null
    localCursor = null
    clearRemoteCursors()
    client.reset('', 0)
  }

  /** 用当前文档重新建连（断线后手动重试）。 */
  function reconnect(): void {
    const id = documentId.value
    if (id) connect(id)
  }

  /** 编辑器选区变化的统一入口：记录本地光标并节流上报。 */
  function setCursor(anchor: number, head: number): void {
    localCursor = { anchor: Math.min(anchor, head), head: Math.max(anchor, head) }
    scheduleCursor()
  }

  return {
    // state
    status,
    documentId,
    content,
    revision,
    title,
    users,
    selfUserId,
    selfCursorColor,
    remoteCursors,
    ready,
    desynced,
    error,
    logs,
    // getters
    isConnected,
    canEdit,
    onlineCount,
    // actions
    connect,
    disconnect,
    reconnect,
    attachSource,
    detachSource,
    setCursor,
    setTitle,
  }
})
