import type { AgentStatus } from './types'

/**
 * SSE 事件里 `status` 字段的取值含义（后端约定）。
 *
 * 目前只明确「2 = 本轮结束」；其余取值都按「仍在进行」处理。收到终态后服务端可能
 * 仍保持连接（用于后续追问的心跳），届时由 store 主动结束订阅。
 */
export const AGENT_STREAM_STATUS_DONE = 2

/** 提问输入框的最大字符数 */
export const AGENT_QUERY_MAX_LENGTH = 2000

/** Agent 状态在界面上的展示文案与标签主题 */
export const AGENT_STATUS_META: Readonly<
  Record<
    AgentStatus,
    { label: string; theme: 'primary' | 'success' | 'warning' | 'danger' | 'info' }
  >
> = {
  idle: { label: '待命', theme: 'info' },
  submitting: { label: '提交中', theme: 'primary' },
  streaming: { label: '回复中', theme: 'primary' },
  restoring: { label: '载入中', theme: 'primary' },
  done: { label: '已完成', theme: 'success' },
  error: { label: '出错', theme: 'danger' },
}

/** 角色展示名（未知角色直接回退到原始 role） */
export const AGENT_ROLE_LABEL: Readonly<Record<string, string>> = {
  user: '我',
  assistant: 'Agent',
  system: '系统',
  tool: '工具',
}

/** 空态引导文案 */
export const AGENT_EMPTY_HINT = '向 Agent 提问，例如：帮我梳理这份文档的要点'

/** 侧栏标题 */
export const AGENT_PANEL_TITLE = 'Agent 助手'

/** 等待回复时的占位文案 */
export const AGENT_THINKING_HINT = 'Agent 正在思考…'

/** 思考过程折叠区标题 */
export const AGENT_REASONING_LABEL = '思考过程'

/** 工具调用折叠区标题 */
export const AGENT_TOOL_CALLS_LABEL = '工具调用'

/** 工具调用参数标签 */
export const AGENT_TOOL_ARGS_LABEL = '参数'

/** 工具调用结果标签 */
export const AGENT_TOOL_RESULT_LABEL = '返回结果'

/** 新会话按钮文案 */
export const AGENT_RESET_LABEL = '新会话'

/** 历史会话标题为空时的展示文案 */
export const AGENT_SESSION_TITLE_FALLBACK = '未命名会话'

/** 历史会话列表为空时的文案 */
export const AGENT_HISTORY_EMPTY = '暂无历史会话'

/** 历史会话列表加载中的文案 */
export const AGENT_HISTORY_LOADING_HINT = '正在加载历史会话列表…'

/** 历史会话视图标题 */
export const AGENT_HISTORY_LABEL = '历史会话'

/** 正在载入历史会话时的占位文案 */
export const AGENT_RESTORING_HINT = '正在载入历史会话…'
