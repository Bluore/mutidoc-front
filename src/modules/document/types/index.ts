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

/** 服务端 init / user 消息里回传的在线用户（用于右侧「编辑人信息」面板与光标配色） */
export interface CollaborationUser {
  id: string
  name: string
  /** 服务端分配的光标颜色（12 色调色板之一）；未知时为 `''` */
  cursorColor: string
}

/**
 * 用于在编辑器里绘制远端光标 / 选区的位置。
 *
 * `anchor` / `head` 是**本地文本（`applyText`）的 UTF-8 字节偏移**，已由 store 从
 * 服务端坐标经在途算子映射而来；编辑器再把它换算成 CodeMirror 的码元坐标并绘制。
 * 保持字节单位是为了让编辑器能以「当前文档」为基准换算，并交给 CodeMirror 在本地
 * 输入时自动映射，而不必每次按键都由 store 重算。
 */
export interface RemoteCursor {
  userId: string
  name: string
  color: string
  /** 选区起点；普通光标时与 `head` 相等 */
  anchor: number
  /** 选区终点 */
  head: number
}
