import type { ExampleStatus } from './types'

/** 状态下拉选项 */
export const EXAMPLE_STATUS_OPTIONS: ReadonlyArray<{ value: ExampleStatus; label: string }> = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
]

/** 状态 → 展示文案 */
export const EXAMPLE_STATUS_LABEL: Record<ExampleStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}
