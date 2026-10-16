/**
 * Agent 模块出口（Public API）。
 * 其它模块（如 document 的协作编辑页）只从这里导入，不深入内部文件。
 */
export { default as AgentSidebar } from './components/AgentSidebar.vue'
export { useAgentStore } from './stores/agent'
export type {
  AgentCondition,
  AgentMessage,
  AgentMessageDelta,
  AgentMessageSegment,
  AgentRole,
  AgentSession,
  AgentStatus,
  AgentStreamPayload,
  AgentToolCall,
} from './types'
export { AGENT_STATUS_META, AGENT_STREAM_STATUS_DONE } from './constants'
