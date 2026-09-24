import type { PageQuery } from '@/api'

/** 示例状态（使用联合类型而非 enum，符合 erasableSyntaxOnly） */
export type ExampleStatus = 'draft' | 'published' | 'archived'

/** 列表 / 详情共用的实体 */
export interface ExampleItem {
  id: string
  title: string
  description: string
  status: ExampleStatus
  createdAt: string
}

/** 列表查询参数 */
export interface ExampleQuery extends PageQuery {
  keyword?: string
  status?: ExampleStatus | ''
}

/** 新建参数 */
export interface ExampleCreatePayload {
  title: string
  description: string
  status: ExampleStatus
}
