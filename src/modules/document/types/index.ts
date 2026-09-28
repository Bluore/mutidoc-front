/**
 * 文档实体（对应 docs/document-api.md 的 Document）。
 * 注意：正文不在这里，正文只在 WebSocket 协作连接中下发。
 */
export interface DocumentItem {
  id: string
  owner_id: string
  summary: string
  /** 创建时间：秒级 Unix 时间戳 */
  create_at: number
  /** 更新时间：秒级 Unix 时间戳 */
  update_at: number
}

/** 创建文档返回 */
export interface CreateDocumentResult {
  document_id: string
}

/** 列表排序方式（后端固定按 create_at 倒序，这里是当前页的前端排序） */
export type DocumentSort = 'create' | 'update'

/** 协作会话连接状态 */
export type CollaborationStatus = 'idle' | 'connecting' | 'connected' | 'closed' | 'error'

/** 服务端 init 消息里回传的在线用户（用于右侧「编辑人信息」面板） */
export interface CollaborationUser {
  id: string
  name: string
}
