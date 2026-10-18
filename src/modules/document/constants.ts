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

/** 文档不存在（document-api 业务错误码，HTTP 200 + code） */
export const DOCUMENT_NOT_FOUND_CODE = 1024002

/** 快照不存在（document-api 业务错误码，HTTP 200 + code） */
export const DOCUMENT_SNAPSHOT_NOT_FOUND_CODE = 1024004

/** 快照短链默认有效期（天）：发布接口不传过期时间，由 link 服务使用默认值 */
export const DOCUMENT_SNAPSHOT_LINK_DAYS = 7

/** 快照正文为空时的展示文案 */
export const DOCUMENT_SNAPSHOT_EMPTY_TEXT = '该快照发布时正文为空。'

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

/**
 * 本地编辑的批量上送间隔（毫秒）。
 *
 * 逐键上送会产生大量网络往返与 OT 变换，因此首次输入后开启一个固定 500ms 的窗口，
 * 窗口内的所有输入合并成一次发送；窗口结束若仍有新输入，再开启下一个窗口。
 */
export const COLLABORATION_EDIT_INTERVAL_MS = 500

/** 光标位置上报的最小间隔（毫秒）：光标比正文频繁，但仍需节流。 */
export const COLLABORATION_CURSOR_THROTTLE_MS = 200
