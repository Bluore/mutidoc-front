import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/utils/error'

import {
  createAgentSession,
  fetchAgentSessions,
  resumeAgentSession,
  streamAgentSession,
  submitAgentFeedback,
} from '../api/agent'
import { AGENT_STREAM_STATUS_DONE, AGENT_STREAM_STATUS_INTERRUPTED } from '../constants'
import { mergeDelta } from '../merge'
import type {
  AgentCondition,
  AgentInterrupt,
  AgentMessage,
  AgentMessageDelta,
  AgentSession,
  AgentStatus,
  AgentStreamPayload,
} from '../types'

/**
 * Agent 会话 store：把「建会话 / 追问 / 恢复历史 / 订阅事件流」编排成 Vue 可消费的
 * 响应式状态。
 *
 * 数据流：视图 → store action → api（REST + SSE）→ 后端；事件流增量 → store → 视图。
 * 视图不直接碰 `fetch` / SSE，api 层不持有业务状态。
 *
 * 关于「事件流是整段会话的回放」：`stream/{id}` 在连接时会重放该会话的完整历史
 * （增量形式），因此每次开启新一轮订阅都会**先清空本地消息**再累积，避免与上一轮
 * 的历史重复；恢复历史会话也是复用同一条路径（只订阅、不提交问题）。
 */
export const useAgentStore = defineStore('agent', () => {
  // state
  /** 服务端会话 ID；为空表示尚未创建（首次提问走 create） */
  const sessionId = ref<string | null>(null)
  /** 累积后的完整对话（服务端只发增量，这里负责拼接） */
  const messages = ref<AgentMessage[]>([])
  /** 已提交、但尚未出现在服务端事件里的提问（用于即时回显） */
  const pendingQuery = ref('')
  const status = ref<AgentStatus>('idle')
  const error = ref<string | null>(null)

  /** 本轮等待人工确认的打断点（服务端会重复下发，只保留最新一组） */
  const interrupts = ref<AgentInterrupt[]>([])
  /** 是否正在提交人工确认结果 */
  const feedbackSubmitting = ref(false)

  /** 历史会话列表 */
  const sessions = ref<AgentSession[]>([])
  const sessionsLoading = ref(false)
  const sessionsError = ref<string | null>(null)

  // 非响应式的会话序号与中断控制器，保存在 store 闭包内
  /** 会话轮次：重置 / 新提问 / 恢复后 +1，用于丢弃上一轮的迟到回调 */
  let sessionSeq = 0
  let controller: AbortController | null = null
  /** 本轮订阅开始后、收到第一条消息增量时是否先清空本地消息（事件流会回放整段历史） */
  let resetOnNextEvent = false
  /**
   * 已提交过反馈的打断点 ID。
   *
   * 提交反馈后后端状态立即变为「生成中」，但清空 interrupt 发生在恢复协程里，中间可能
   * 还有一两个轮询事件带着旧打断；据此过滤，避免确认卡片短暂重现。
   */
  let dismissedInterruptIds = new Set<string>()

  // getters
  const busy = computed(
    () =>
      status.value === 'submitting' ||
      status.value === 'streaming' ||
      status.value === 'restoring' ||
      status.value === 'awaiting' ||
      interrupts.value.length > 0,
  )
  const restoring = computed(() => status.value === 'restoring')
  /** 是否正在等待用户确认敏感操作（确认卡片据此展示） */
  const awaiting = computed(() => interrupts.value.length > 0)
  const hasConversation = computed(
    () => messages.value.length > 0 || pendingQuery.value.length > 0,
  )
  /**
   * 是否显示独立的「正在思考」占位：
   * 本轮（最近一条 user 之后）还没有可展示的助手内容。一旦助手开始输出思考、工具调用
   * 或正文，就撤下占位，改由消息气泡里的打字动画继续表达「仍在进行」。
   */
  const thinking = computed(() => {
    if (status.value !== 'submitting' && status.value !== 'streaming') return false
    // 新提问尚未被服务端回显，本轮一定还没有助手内容
    if (pendingQuery.value) return true

    for (let i = messages.value.length - 1; i >= 0; i -= 1) {
      const message = messages.value[i]
      if (message.role === 'assistant') return message.segments.length === 0
      if (message.role === 'user') return true
    }
    return true
  })

  /** 取消正在进行的流订阅（不清理会话）。 */
  function abortStream(): void {
    controller?.abort()
    controller = null
  }

  /**
   * 把一条流式增量并入累积对话（拼接规则见 `merge.ts` 的 `mergeDelta`）。
   */
  function applyDelta(delta: AgentMessageDelta): void {
    const next = mergeDelta(messages.value, delta)
    if (next === messages.value) return
    messages.value = next
    // 服务端已回显本次提问，撤下本地乐观回显，避免重复展示。
    if (delta.role === 'user') pendingQuery.value = ''
  }

  /** 应用一条 SSE 事件：逐条累积增量，收到终态则结束订阅，收到打断则等待人工确认。 */
  function applyPayload(payload: AgentStreamPayload): void {
    // 事件流会重放整段历史，收到第一条消息时先清空本地旧对话再重建。
    if (resetOnNextEvent && payload.msg.length > 0) {
      messages.value = []
      resetOnNextEvent = false
    }

    for (const delta of payload.msg) applyDelta(delta)

    // 打断：仅 status === 3 表示「等待人工确认」。等待反馈期间服务端会把同一组打断
    // 重复下发，直接覆盖为最新一组；已提交反馈的旧打断（id 命中）再过滤一层，避免
    // 恢复瞬间（状态已变回生成中）卡片闪现。
    if (payload.status === AGENT_STREAM_STATUS_INTERRUPTED) {
      const pending = payload.interrupt.filter((item) => !dismissedInterruptIds.has(item.id))
      if (pending.length > 0) {
        interrupts.value = pending
        status.value = 'awaiting'
      }
    }

    // 终态后服务端可能仍挂着心跳，主动结束订阅，避免一直停留在「回复中」。
    if (payload.status === AGENT_STREAM_STATUS_DONE) abortStream()
  }

  /**
   * 订阅当前会话的事件流，直到终态 / 流结束 / 出错。
   *
   * @param current 调用方持有的会话轮次，用于丢弃过期回调
   * @param initialStatus 订阅期间对外展示的状态（提问为 streaming，恢复历史为 restoring）
   * @param resetMessages 是否在收到第一条增量时清空本地旧对话
   */
  async function runStream(
    current: number,
    initialStatus: AgentStatus,
    resetMessages: boolean,
  ): Promise<void> {
    const id = sessionId.value
    if (current !== sessionSeq || !id) return

    const active = new AbortController()
    controller = active
    resetOnNextEvent = resetMessages
    status.value = initialStatus

    try {
      await streamAgentSession(id, {
        signal: active.signal,
        onEvent: (payload) => {
          if (current === sessionSeq) applyPayload(payload)
        },
      })
      if (current !== sessionSeq) return
      // 等待人工确认时连接可能已断开（例如代理超时），保持「待确认」而不是误报完成；
      // 提交反馈后若发现连接已断，会重新订阅事件流。
      if (status.value !== 'awaiting') status.value = 'done'
    } catch (e) {
      if (current !== sessionSeq) return
      error.value = getErrorMessage(e, 'Agent 请求失败，请稍后重试')
      status.value = 'error'
    } finally {
      if (current === sessionSeq) {
        controller = null
        resetOnNextEvent = false
      }
    }
  }

  /**
   * 提交一次提问：首次建会话，之后在既有会话里追问，随后订阅事件流。
   *
   * @param condition 本轮携带的环境上下文；`create` 与 `resume` 都会透传。
   */
  async function ask(rawQuery: string, condition?: AgentCondition): Promise<void> {
    const query = rawQuery.trim()
    if (!query || busy.value) return

    error.value = null
    pendingQuery.value = query
    // 新的一轮提问开始，清掉上一轮残留的打断与已处理标记
    interrupts.value = []
    dismissedInterruptIds = new Set<string>()

    // 取消可能残留的订阅，并开启新的会话轮次
    const current = (sessionSeq += 1)
    abortStream()
    status.value = 'submitting'

    try {
      if (sessionId.value) {
        await resumeAgentSession(sessionId.value, query, condition)
      } else {
        sessionId.value = await createAgentSession(query, condition)
      }
    } catch (e) {
      if (current !== sessionSeq) return
      error.value = getErrorMessage(e, 'Agent 请求失败，请稍后重试')
      status.value = 'error'
      return
    }
    if (current !== sessionSeq) return

    await runStream(current, 'streaming', true)
  }

  /**
   * 提交人工确认结果（Human-in-the-Loop）。
   *
   * 同意 / 拒绝都会让服务端从打断点继续执行；`feedback` 是给模型的补充意见，可为空。
   * 成功后清掉确认卡片并回到「回复中」——服务端仍在同一条事件流上推送后续增量，
   * 只有流已经断开时才需要重新订阅（重新订阅会回放整段历史，故复用 runStream 的重建逻辑）。
   */
  async function submitFeedback(approved: boolean, feedback = ''): Promise<void> {
    const id = sessionId.value
    if (!id || interrupts.value.length === 0 || feedbackSubmitting.value) return

    const current = sessionSeq
    const dismissed = interrupts.value.map((item) => item.id)
    error.value = null
    feedbackSubmitting.value = true

    try {
      await submitAgentFeedback(id, approved, feedback.trim())
    } catch (e) {
      if (current !== sessionSeq) return
      error.value = getErrorMessage(e, '提交确认失败，请稍后重试')
      return
    } finally {
      if (current === sessionSeq) feedbackSubmitting.value = false
    }
    if (current !== sessionSeq) return

    // 记录已处理的打断，过滤恢复瞬间可能重复下发的旧 interrupt。
    for (const interruptId of dismissed) dismissedInterruptIds.add(interruptId)
    interrupts.value = []
    status.value = 'streaming'

    // 等待确认期间长连接可能已断开：重新订阅以继续接收后续输出。
    if (!controller) await runStream(current, 'streaming', true)
  }

  /** 历史会话列表：GET /agent/v1/session/list。 */
  async function loadSessions(): Promise<void> {
    sessionsLoading.value = true
    sessionsError.value = null
    try {
      sessions.value = await fetchAgentSessions()
    } catch (e) {
      sessionsError.value = getErrorMessage(e, '历史会话加载失败')
    } finally {
      sessionsLoading.value = false
    }
  }

  /**
   * 恢复一个历史会话：切换 sessionId 并订阅事件流（服务端会回放整段历史），
   * 之后可继续用 `ask` 追问。
   */
  async function restore(rawSessionId: string): Promise<void> {
    const id = rawSessionId.trim()
    if (!id || busy.value) return
    if (id === sessionId.value && controller) return

    error.value = null
    pendingQuery.value = ''
    messages.value = []
    interrupts.value = []
    dismissedInterruptIds = new Set<string>()
    sessionId.value = id

    const current = (sessionSeq += 1)
    abortStream()
    await runStream(current, 'restoring', false)
  }

  /** 用户主动停止本轮回复。 */
  function stop(): void {
    if (!busy.value) return
    sessionSeq += 1
    abortStream()
    interrupts.value = []
    feedbackSubmitting.value = false
    status.value = 'done'
  }

  /** 结束当前会话并清空本地状态（离开页面 / 点击「新会话」时调用）。 */
  function reset(): void {
    sessionSeq += 1
    abortStream()
    sessionId.value = null
    messages.value = []
    pendingQuery.value = ''
    interrupts.value = []
    feedbackSubmitting.value = false
    dismissedInterruptIds = new Set<string>()
    status.value = 'idle'
    error.value = null
  }

  return {
    // state
    sessionId,
    messages,
    pendingQuery,
    status,
    error,
    interrupts,
    feedbackSubmitting,
    sessions,
    sessionsLoading,
    sessionsError,
    // getters
    busy,
    restoring,
    awaiting,
    thinking,
    hasConversation,
    // actions
    ask,
    submitFeedback,
    restore,
    loadSessions,
    stop,
    reset,
  }
})
