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
 * 打断事件里由触发方（工具）提供的用户可见信息。
 *
 * 后端把它作为 JSON 对象原样下发（如 `create_document_connection`），字段随打断类型
 * 变化，因此除常见字段外允许扩展；视图层只直接展示 `message`。
 */
export interface AgentInterruptInfo {
  /** 打断类型，如 create_document_connection */
  kind?: string
  /** 给用户看的说明，通常是一句是否同意的询问 */
  message?: string
  /** 相关文档 ID（创建文档连接时提供） */
  document_id?: string
  /** 发起操作的机器人名称（创建文档连接时提供） */
  bot_name?: string
  /** 其它随打断类型变化的字段 */
  [key: string]: unknown
}

/**
 * 一次需要人工确认的打断（Human-in-the-Loop）。
 *
 * 服务端在等待反馈期间会把未处理的打断**重复**放在每个事件里下发，前端只保留最新的
 * 一组；用户通过 feedback 接口同意 / 拒绝后，会话从该打断点继续执行。
 */
export interface AgentInterrupt {
  /** 打断点唯一 ID（同一会话内用于去重 / 识别已处理项） */
  id: string
  /** 组件路径，如 agent:MuDo;tool:EditAgent:call_00_... */
  address: string
  /** 触发方提供的用户可见信息 */
  info: AgentInterruptInfo
  /** 是否为根因打断点（恢复时后端据此定位） */
  isRootCause: boolean
  /** 父打断点 ID（嵌套 agent 时存在） */
  parentId: string
}

/**
 * SSE 每个 `data` 事件的数据体。
 *
 * `msg` 是**增量**（不是完整快照），需要按角色累积；心跳事件可能只有 `status`
 * 而没有 `msg`（此时为空数组）。
 */
export interface AgentStreamPayload {
  msg: AgentMessageDelta[]
  /** 本轮需要人工确认的打断点；没有时为空数组（等待反馈期间会被重复下发） */
  interrupt: AgentInterrupt[]
  /** 服务端运行状态，取值见 constants 中的 `AGENT_STREAM_STATUS_*` */
  status: number
}

/** Agent 侧栏的本地状态机（`awaiting` = 等待用户确认敏感操作） */
export type AgentStatus =
  | 'idle'
  | 'submitting'
  | 'streaming'
  | 'restoring'
  | 'awaiting'
  | 'done'
  | 'error'

/** 历史会话条目（GET /agent/v1/session/list） */
export interface AgentSession {
  id: string
  /** 会话标题（后端生成，可能为空串） */
  title: string
  /** 会话归属用户 ID */
  userId: string
}

/**
 * 提问时随请求携带的**环境上下文**（`create` / `resume` 接口的 `condition` 字段）。
 *
 * 后端会把它转成自然语言拼进本轮提问，不影响响应结构。字段全部可选，缺省即忽略；
 * `user_ip` 由后端从 `X-Forwarded-For` / `X-Real-IP` / RemoteAddr 解析后回填，前端
 * **不要**传（传了也会被覆盖）。
 *
 * 注意：接口要求的 `condition` 是**字符串化的 JSON**，序列化由 API 层
 * （`createAgentSession` / `resumeAgentSession`）统一完成，视图 / store 只提供这个对象。
 */
export interface AgentCondition {
  /** 用户 ID */
  user_id?: string
  /** 用户名 */
  user_name?: string
  /** 当前文档 ID */
  document_id?: string
  /** 当前文档名称 */
  document_name?: string
  /** 光标锚点位置 */
  cursor_anchor?: string
  /** 当前选中的文本 */
  cursor_select?: string
  /** 当前时间戳（毫秒，建议 `Date.now()`） */
  timestamp?: number
  /** IANA 时区名，如 Asia/Shanghai */
  time_zone?: string
  /** 界面语言，如 zh-CN */
  language?: string
}
