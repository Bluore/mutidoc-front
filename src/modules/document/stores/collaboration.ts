import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/modules/auth'
import { getErrorMessage } from '@/utils/error'

import { buildCollaborationUrl } from '../api/collaboration'
import { COLLABORATION_LOG_LIMIT } from '../constants'
import { createWebSocketTransport } from '../ot/connection'
import type { CollabTransport } from '../ot/connection'
import { OtClient, SEP } from '../ot/ot-client'
import type { ClientInitMessage, ServerMessage } from '../ot/ot-client'
import type { CollaborationStatus, CollaborationUser } from '../types'

/** 把服务端 init 的 `users` 归一化为面板需要的结构。 */
function normalizeUsers(raw: unknown): CollaborationUser[] {
  if (!Array.isArray(raw)) return []

  const users: CollaborationUser[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as { id?: unknown; name?: unknown }
    users.push({ id: String(record.id ?? ''), name: String(record.name ?? '') })
  }
  return users
}

/**
 * 协作编辑 store：把无副作用的 OT 状态机（`ot/ot-client.ts`）与 WebSocket 传输
 * （`ot/connection.ts`）编排成 Vue 可消费的响应式状态。
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
  /** 服务端 init 回传的在线用户。 */
  const users = ref<CollaborationUser[]>([])
  /** 服务端为当前连接分配的 user_id（token 鉴权后由 init 回传）。 */
  const selfUserId = ref('')
  /** 是否已收到 init（收到前禁止编辑，避免基于空文档生成算子）。 */
  const ready = ref(false)
  const desynced = ref(false)
  const error = ref<string | null>(null)
  /** 开发期活动日志（后端接口未完善，便于排查协议问题）。 */
  const logs = ref<string[]>([])

  // 非响应式的 OT 会话与传输对象，保存在 store 闭包内。
  const client = new OtClient()
  let transport: CollabTransport | null = null
  /** 会话序号：连接换代后丢弃旧 socket 的迟到回调。 */
  let session = 0

  // getters
  const isConnected = computed(() => status.value === 'connected')
  const canEdit = computed(() => status.value === 'connected' && ready.value)
  const onlineCount = computed(() => users.value.length)

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
  }

  /**
   * 把编辑器里的未算变更折算成算子并发送。
   *
   * - 只有编辑器文本与本地文本不一致时才 `calculate`，否则会清掉正在途中的算子；
   * - 若已有算子在途则先不发，等它的回声回来后由本方法把晋升的算子再发出去。
   */
  function flush(): void {
    if (status.value !== 'connected') return

    if (content.value !== client.renderText()) {
      const calculated = client.calculate(content.value)
      pushLogs(calculated.lines)
      if (!calculated.ok) {
        error.value = calculated.error ?? '本地变更无法生成编辑算子'
        return
      }
    }

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

  /** 处理一条服务端帧：入队 → 立即消费 → 回填文本 → 尝试续发。 */
  function handleMessage(message: ServerMessage): void {
    const queued = client.enqueue(message)
    pushLogs(queued.lines)

    if (message.init) {
      // token 鉴权后身份由服务端回传，用它识别「自己的算子」。
      client.setUserId(message.init.user_id ?? '')
      users.value = normalizeUsers(message.init.users)
      ready.value = true
    }

    const consumed = client.consumePending(content.value)
    pushLogs(consumed.lines)
    if (!consumed.ok) desynced.value = true

    const next = client.renderText()
    if (next !== content.value) content.value = next

    syncFromClient()
    flush()
  }

  /** 连接建立后发送唯一一条 init 首帧：按后端要求只带 token。 */
  function sendInit(token: string): void {
    client.reset('', 0)
    client.setUserId('')
    content.value = ''
    revision.value = 0
    desynced.value = false

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
        pushLogs([`WebSocket 已断开（${code}${reason ? ` ${reason}` : ''}）`])
      },
      onError: (err) => {
        if (current !== session) return
        status.value = 'error'
        error.value = getErrorMessage(err, 'WebSocket 连接异常')
        pushLogs([`WebSocket 异常：${error.value}`])
      },
    })
  }

  /** 关闭连接并清空会话状态。 */
  function disconnect(): void {
    session += 1
    transport?.close()
    transport = null

    status.value = 'idle'
    ready.value = false
    content.value = ''
    revision.value = 0
    users.value = []
    selfUserId.value = ''
    desynced.value = false
    error.value = null
    client.reset('', 0)
  }

  /** 用当前文档重新建连（断线后手动重试）。 */
  function reconnect(): void {
    const id = documentId.value
    if (id) connect(id)
  }

  /** 编辑器本地输入的统一入口。 */
  function setContent(text: string): void {
    content.value = text
    flush()
  }

  return {
    // state
    status,
    documentId,
    content,
    revision,
    users,
    selfUserId,
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
    setContent,
  }
})
