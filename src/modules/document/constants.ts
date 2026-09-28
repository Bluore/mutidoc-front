import type { CollaborationStatus, DocumentSort } from './types'

/** 列表默认每页数量 */
export const DOCUMENT_PAGE_SIZE = 12

/** 每页数量可选项 */
export const DOCUMENT_PAGE_SIZE_OPTIONS: number[] = [12, 24, 48]

/** summary 为空时的展示文案（后端未提供标题字段） */
export const DOCUMENT_SUMMARY_FALLBACK = '未命名文档'

/** 排序选项（前端对当前页排序） */
export const DOCUMENT_SORT_OPTIONS: ReadonlyArray<{ value: DocumentSort; label: string }> = [
  { value: 'create', label: '按创建时间' },
  { value: 'update', label: '按更新时间' },
]

/** 协作连接状态在界面上的展示文案与标签主题 */
export const COLLABORATION_STATUS_META: Readonly<
  Record<
    CollaborationStatus,
    { label: string; theme: 'primary' | 'success' | 'warning' | 'danger' | 'info' }
  >
> = {
  idle: { label: '未连接', theme: 'info' },
  connecting: { label: '连接中', theme: 'primary' },
  connected: { label: '已连接', theme: 'success' },
  closed: { label: '已断开', theme: 'warning' },
  error: { label: '连接异常', theme: 'danger' },
}

/** 协作编辑编辑器文件名后缀（当前仅支持纯文本） */
export const COLLABORATION_FILE_EXTENSION = '.txt'

/** 协作编辑活动日志最多保留的条数 */
export const COLLABORATION_LOG_LIMIT = 50
