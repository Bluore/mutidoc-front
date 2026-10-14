/**
 * Agent 模块类型定义。
 * 与 docs 中的 Agent 服务契约对应；新增字段时优先在 API 层适配，不要泄漏给视图层。
 */

/** 对话角色：给出常见值，同时允许后端新增角色（用字符串兜底） */
export type AgentRole = 'user' | 'assistant' | 'system' | 'tool'

/**
 * 助手发起的一次工具调用。
 *
 * `arguments` / `result` 都保留**原文**（可能是 JSON 字符串），视图层默认折叠展示，
 * 避免长参数 / 大段工具返回值淹没正文。
 */
export interface AgentToolCall {
  /** 工具调用 ID（流式增量按它归并到同一次调用上） */
  id: string
  /** 工具名，如 maps_weather */
  name: string
  /** 调用参数（原始字符串，可能分多片累积） */
  arguments: string
  /** 工具执行结果（工具返回的原文，未返回时为空串） */
  result: string
}

/**
 * 助手回合内的一个有序片段。
 *
 * 思考、工具调用、正文按事件到达顺序排列，视图据此**穿插**渲染：思考 / 工具调用各自
 * 折叠，正文直接铺开；这样顺序与后端事件流一致，不会把多轮工具调用挤在一起。
 */
export type AgentMessageSegment =
  | { kind: 'reasoning'; text: string }
  | { kind: 'content'; text: string }
  | { kind: 'tool'; call: AgentToolCall }

/**
 * 一条累积完成的对话消息。
 *
 * 一次「助手回合」只产出一条消息：思考、工具调用（含参数与结果）、正文都按到达顺序
 * 存进 `segments`，视图据此渲染成**一个**气泡并在内部按顺序折叠细节。
 */
export interface AgentMessage {
  role: AgentRole | string
  segments: AgentMessageSegment[]
}

/**
 * 事件里的一条**消息增量**。
 *
 * 服务端是流式的：同一角色的分片会持续追加到同一条消息上——
 * `{"role":"assistant","reasoning":"The"}` 之后可能是
 * `{"role":"assistant","content":"你好！","reasoning":" rather than transfer."}`，
 * 二者分别累积到同一条助手消息的 `reasoning` / `content`。
 *
 * 工具调用（顶层的 `tool_call` 帧）会被适配成一条 `role: 'assistant'` 的增量，
 * 通过 `toolCalls` 承载；工具返回值则是 `role: 'tool'` 增量，其 `content` 即结果原文。
 */
export interface AgentMessageDelta {
  role: AgentRole | string
  content?: string
  reasoning?: string
  /** 本片增量携带的工具调用（按 id 归并，arguments 可能分片累积） */
  toolCalls?: AgentToolCall[]
  /** 工具返回值所属的调用 ID（`role === 'tool'` 时后端可能提供，用于精确匹配） */
  toolCallId?: string
}

/**
 * SSE 每个 `data` 事件的数据体。
 *
 * `msg` 是**增量**（不是完整快照），需要按角色累积；心跳事件可能只有 `status`
 * 而没有 `msg`（此时为空数组）。
 */
export interface AgentStreamPayload {
  msg: AgentMessageDelta[]
  /** 服务端运行状态，取值见 constants 中的 `AGENT_STREAM_STATUS_*` */
  status: number
}

/** Agent 侧栏的本地状态机 */
export type AgentStatus = 'idle' | 'submitting' | 'streaming' | 'restoring' | 'done' | 'error'

/** 历史会话条目（GET /agent/v1/session/list） */
export interface AgentSession {
  id: string
  /** 会话标题（后端生成，可能为空串） */
  title: string
  /** 会话归属用户 ID */
  userId: string
}
