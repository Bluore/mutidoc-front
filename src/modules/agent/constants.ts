import type { AgentStatus } from './types'

/**
 * SSE 事件里 `status` 字段的取值含义（后端约定，对应 SessionStatus）。
 *
 * - 1 = 生成中；2 = 本轮结束；3 = 已打断、等待人工确认；其余取值按「仍在进行」处理。
 * 收到终态后服务端可能仍保持连接（用于后续追问的心跳），届时由 store 主动结束订阅；
 * 收到打断态则保持连接，提交 feedback 后服务端会在**同一条流**上继续推送。
 */
export const AGENT_STREAM_STATUS_DONE = 2
export const AGENT_STREAM_STATUS_INTERRUPTED = 3

/** 提问输入框的最大字符数 */
export const AGENT_QUERY_MAX_LENGTH = 2000

/** 人工确认补充意见的最大字符数 */
export const AGENT_FEEDBACK_MAX_LENGTH = 500

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
  awaiting: { label: '待确认', theme: 'warning' },
  done: { label: '已完成', theme: 'success' },
  error: { label: '出错', theme: 'danger' },
}

/** 智能助手名称（品牌名，界面统一用它称呼助手） */
export const AGENT_ASSISTANT_NAME = 'MuDo'

/**
 * 角色展示名（未知角色直接回退到原始 role）。
 * `user` 只是兜底文案，实际对话里由宿主传入的当前用户名覆盖（见 `AgentSidebar` 的 `selfName`）。
 */
export const AGENT_ROLE_LABEL: Readonly<Record<string, string>> = {
  user: '用户',
  assistant: AGENT_ASSISTANT_NAME,
  system: '系统',
  tool: '工具',
}

/** 空态引导文案 */
export const AGENT_EMPTY_HINT = `向 ${AGENT_ASSISTANT_NAME} 提问，例如：帮我梳理这份文档的要点`

/** 侧栏标题 */
export const AGENT_PANEL_TITLE = `${AGENT_ASSISTANT_NAME} 慧帮你`

/** 等待回复时的占位文案（每次进入思考态随机挑一条，活跃等待氛围） */
export const AGENT_THINKING_HINTS: readonly string[] = [
  `${AGENT_ASSISTANT_NAME} 正在思考…`,
  `${AGENT_ASSISTANT_NAME} 正在翻箱倒柜找答案…`,
  `${AGENT_ASSISTANT_NAME} 正在查阅资料，马上就好…`,
  `${AGENT_ASSISTANT_NAME} 正在头脑风暴…`,
  `${AGENT_ASSISTANT_NAME} 掐指一算，答案就快出来了…`,
  `${AGENT_ASSISTANT_NAME} 正在把想法搅拌成答案…`,
  `让 ${AGENT_ASSISTANT_NAME} 组织一下语言…`,
  `${AGENT_ASSISTANT_NAME} 正在极速运算，请稍候…`,
  `答案正在路上，马不停蹄…`,
  `${AGENT_ASSISTANT_NAME} 认真起来了，请稍等片刻…`,
]

/** 思考过程折叠区标题 */
export const AGENT_REASONING_LABEL = '思考过程'

/** 用户消息里「环境上下文」折叠区标题 */
export const AGENT_CONTEXT_LABEL = '环境上下文'

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

/** 人工确认卡片标题 */
export const AGENT_INTERRUPT_LABEL = '需要你的确认'

/** 打断信息缺少 message 时的兜底文案 */
export const AGENT_INTERRUPT_FALLBACK = '智能助手需要你的确认后才能继续执行，是否同意？'

/** 人工确认补充意见输入框占位 */
export const AGENT_FEEDBACK_PLACEHOLDER = '补充意见（可选），会一并反馈给助手'

/** 人工确认按钮文案 */
export const AGENT_APPROVE_LABEL = '同意'
export const AGENT_REJECT_LABEL = '拒绝'
