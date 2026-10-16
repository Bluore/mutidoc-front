import { ApiError, request, TOKEN_STORAGE_KEY } from '@/api'
import { env } from '@/config/env'
import { createSseParser } from '@/utils/sse'

import type {
  AgentCondition,
  AgentMessageDelta,
  AgentSession,
  AgentStreamPayload,
  AgentToolCall,
} from '../types'

/**
 * Agent 服务 API 层。
 *
 * - create / resume 走全局 `request()`，自动注入鉴权并解包统一信封；
 * - stream 是 `text/event-stream`，`request()`（axios）无法处理流式响应，故改用
 *   `fetch` + `ReadableStream` 手动解析 SSE（同时便于用 `AbortSignal` 取消订阅）。
 */

/**
 * 创建 Agent 会话：POST /agent/v1/session/create
 *
 * `condition` 同 `resume`：**字符串化的 JSON** 环境上下文（见 `AgentCondition`），
 * 这里统一 `JSON.stringify`；缺省发送 `"{}"`。
 */
export async function createAgentSession(
  query: string,
  condition?: AgentCondition,
): Promise<string> {
  const data = await request<{ session_id: string }>({
    url: '/agent/v1/session/create',
    method: 'post',
    data: { query, condition: JSON.stringify(condition ?? {}) },
  })
  return data.session_id
}

/**
 * 在既有会话中追问：POST /agent/v1/session/resume
 *
 * `condition` 是本次请求的**环境上下文**（见 `AgentCondition`），接口要求它是
 * **字符串化的 JSON**，因此这里统一做一次 `JSON.stringify`——直接传对象会让后端
 * 解析失败并返回 `1044004`。缺省时发送 `"{}"`，行为与旧版一致。
 */
export function resumeAgentSession(
  sessionId: string,
  query: string,
  condition?: AgentCondition,
): Promise<void> {
  return request<void>({
    url: '/agent/v1/session/resume',
    method: 'post',
    data: { query, session_id: sessionId, condition: JSON.stringify(condition ?? {}) },
  })
}

/** 后端列表原始结构：sessions + session_len */
interface RawSessionList {
  sessions?: Array<{ session_id?: unknown; session_title?: unknown; user_id?: unknown }>
  session_len?: number
}

/**
 * 获取历史会话列表：GET /agent/v1/session/list
 *
 * 后端字段为下划线命名，这里适配为前端的 camelCase 结构，视图层不感知原始字段。
 */
export async function fetchAgentSessions(): Promise<AgentSession[]> {
  const data = await request<RawSessionList>({
    url: '/agent/v1/session/list',
    method: 'get',
  })

  return (data.sessions ?? []).map((item) => ({
    id: typeof item.session_id === 'string' ? item.session_id : String(item.session_id ?? ''),
    title: typeof item.session_title === 'string' ? item.session_title : '',
    userId: typeof item.user_id === 'string' ? item.user_id : String(item.user_id ?? ''),
  }))
}

/** 事件流订阅回调 */
export interface AgentStreamHandlers {
  /** 每收到一条 SSE 事件（消息增量 + 状态）时回调 */
  onEvent: (payload: AgentStreamPayload) => void
  /** 用于取消订阅（例如组件卸载、收到终态后主动结束） */
  signal: AbortSignal
}

/**
 * 解析顶层的 `tool_call` 帧：形如
 * `[{"offset":82,"tool_msg":"{\"index\":0,\"id\":\"call_..\",\"function\":{\"name\":\"..\",\"arguments\":\"..\"}}"}]`。
 *
 * 每个 `tool_msg` 是 OpenAI 风格的流式工具调用增量（按 `index` / `id` 归并），这里
 * 只提取前端展示所需的 `id` / `name` / `arguments`，适配成一条助手增量。
 */
function parseToolCalls(raw: unknown): AgentToolCall[] {
  if (!Array.isArray(raw)) return []

  const calls: AgentToolCall[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const { tool_msg: toolMsg } = item as { tool_msg?: unknown }
    if (typeof toolMsg !== 'string' || !toolMsg) continue

    let decoded: unknown
    try {
      decoded = JSON.parse(toolMsg)
    } catch {
      continue
    }
    if (typeof decoded !== 'object' || decoded === null) continue

    const entry = decoded as {
      index?: unknown
      id?: unknown
      function?: { name?: unknown; arguments?: unknown }
    }
    const id =
      typeof entry.id === 'string' && entry.id
        ? entry.id
        : `tool-${typeof entry.index === 'number' ? entry.index : calls.length}`
    calls.push({
      id,
      name: typeof entry.function?.name === 'string' ? entry.function.name : '',
      arguments: typeof entry.function?.arguments === 'string' ? entry.function.arguments : '',
      result: '',
    })
  }
  return calls
}

/**
 * 把一条 SSE `data` 解析为业务载荷；格式不合法或为空时返回 `null`（忽略该事件）。
 * 只保留 role / content / reasoning 与工具调用，避免把后端附带的额外字段泄漏到视图层。
 *
 * 事件有两种形态：
 * - **实时增量**：`msg` 通常只有一条增量，工具调用单独成帧（`tool_call`）；
 * - **历史回放**：一个事件里带**整段会话**（`msg` 是完整消息数组），全部 `tool_call`
 *   也一并在同一事件里下发。
 *
 * 历史回放里工具调用不带消息序号，但 `tool_call` 与 `tool` 消息都按发生顺序排列，
 * 因此这里按序配对：遇到一条 `tool` 消息，先补一条对应的工具调用增量，再放它的结果，
 * 从而让 store 把「调用 + 结果」按原始顺序并入同一个助手回合（不会挤到最后或单独成气泡）。
 */
function parsePayload(raw: string): AgentStreamPayload | null {
  if (!raw) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof value !== 'object' || value === null) return null

  const record = value as { msg?: unknown; tool_call?: unknown; status?: unknown }
  const msg: AgentMessageDelta[] = []

  // 待配对的工具调用（按发生顺序）；实时流里它们单独成帧，历史回放里与整段消息同帧。
  const pendingTools = parseToolCalls(record.tool_call)
  let toolCursor = 0

  if (Array.isArray(record.msg)) {
    for (const item of record.msg) {
      if (typeof item !== 'object' || item === null) continue
      const delta = item as {
        role?: unknown
        content?: unknown
        reasoning?: unknown
        tool_call_id?: unknown
      }
      const role = typeof delta.role === 'string' ? delta.role : 'assistant'

      // 工具结果：先补上对应的工具调用，再放结果，顺序与后端事件流一致。
      if (role === 'tool' && toolCursor < pendingTools.length) {
        msg.push({ role: 'assistant', toolCalls: [pendingTools[toolCursor]] })
        toolCursor += 1
      }

      const entry: AgentMessageDelta = { role }
      if (typeof delta.content === 'string') entry.content = delta.content
      if (typeof delta.reasoning === 'string') entry.reasoning = delta.reasoning
      if (typeof delta.tool_call_id === 'string') entry.toolCallId = delta.tool_call_id
      // 不含任何文本的分片没有意义（例如只带 tool_calls 的帧），直接丢弃。
      if (entry.content || entry.reasoning) msg.push(entry)
    }
  }

  // 剩余未被工具消息消费的调用（实时流里 tool_call 单独成帧）：作为助手增量追加。
  for (; toolCursor < pendingTools.length; toolCursor += 1) {
    msg.push({ role: 'assistant', toolCalls: [pendingTools[toolCursor]] })
  }

  return { msg, status: typeof record.status === 'number' ? record.status : 0 }
}

/**
 * 构造事件流请求头。
 *
 * 浏览器原生 `EventSource` 不能设置 `Authorization` 头，所以改用 `fetch`。这里手动
 * 读取 token，行为与全局 axios 拦截器保持一致。
 */
function streamHeaders(): Headers {
  const headers = new Headers({ Accept: 'text/event-stream' })
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

/**
 * 订阅 Agent 会话事件流：GET /agent/v1/session/stream/{id}
 *
 * 逐分片读取响应体并增量解析 SSE；收到终态或外部 `abort()` 后返回（正常结束，不抛错）。
 * 非 2xx 响应会抛出 `ApiError`，交由 store 统一转成可展示文案。
 */
export async function streamAgentSession(
  sessionId: string,
  handlers: AgentStreamHandlers,
): Promise<void> {
  const { onEvent, signal } = handlers
  const url = `${env.apiBaseUrl}/agent/v1/session/stream/${encodeURIComponent(sessionId)}`

  let response: Response
  try {
    response = await fetch(url, { method: 'GET', headers: streamHeaders(), signal })
  } catch (error) {
    if (signal.aborted) return
    throw new ApiError(error instanceof Error ? error.message : '连接 Agent 事件流失败', -1)
  }

  // fetch 不会走 axios 的 401 拦截，这里手动保持与全局一致的处理。
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login')
    }
    throw new ApiError('登录状态已失效，请重新登录', 401, 401)
  }
  if (!response.ok) {
    throw new ApiError(
      `Agent 事件流请求失败（HTTP ${response.status}）`,
      response.status,
      response.status,
    )
  }
  if (!response.body) {
    throw new ApiError('当前环境不支持流式响应', -1)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const parse = createSseParser()

  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break

      for (const message of parse(decoder.decode(value, { stream: true }))) {
        const payload = parsePayload(message.data)
        if (payload) onEvent(payload)
      }
    }
  } catch (error) {
    // abort() 触发的读取中断属于正常取消，不上抛。
    if (!signal.aborted) throw error
  } finally {
    void reader.cancel().catch(() => undefined)
  }
}
