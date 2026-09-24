import type { DocumentSort } from './types'

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
