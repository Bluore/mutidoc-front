import type { PageResult } from '@/api'

import type { ExampleCreatePayload, ExampleItem, ExampleQuery } from '../types'

/**
 * 模块内置 mock：仅用于前后端分离、后端未就绪时演示。
 * 接入真实接口后，把 .env 的 VITE_USE_MOCK 改为 false 即可整体绕过。
 */
const DELAY = 300
const delay = (ms = DELAY) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let sequence = 0
const nextId = () => `example-${Date.now().toString(36)}-${(sequence += 1)}`

let db: ExampleItem[] = [
  {
    id: nextId(),
    title: '模块化目录规范',
    description: '每个业务模块自包含 api / store / views / routes，对外只暴露 index.ts。',
    status: 'published',
    createdAt: '2026-09-20T09:30:00.000Z',
  },
  {
    id: nextId(),
    title: '样式防穿越方案',
    description: '组件一律 scoped，共享样式只走 --md-* 设计令牌。',
    status: 'published',
    createdAt: '2026-09-21T14:05:00.000Z',
  },
  {
    id: nextId(),
    title: '请求层统一封装',
    description: 'axios 实例、错误归一化、鉴权注入统一在 src/api 处理。',
    status: 'draft',
    createdAt: '2026-09-22T08:12:00.000Z',
  },
  {
    id: nextId(),
    title: '待归档的示例条目',
    description: '用于演示状态筛选与分页。',
    status: 'archived',
    createdAt: '2026-09-23T10:00:00.000Z',
  },
]

export async function mockFetchExampleList(query: ExampleQuery): Promise<PageResult<ExampleItem>> {
  await delay()
  const keyword = query.keyword?.trim().toLowerCase() ?? ''

  const filtered = db.filter((item) => {
    const matchKeyword =
      !keyword ||
      item.title.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword)
    const matchStatus = !query.status || item.status === query.status
    return matchKeyword && matchStatus
  })

  const start = (query.page - 1) * query.pageSize
  return {
    list: filtered.slice(start, start + query.pageSize).map((item) => ({ ...item })),
    total: filtered.length,
    page: query.page,
    pageSize: query.pageSize,
  }
}

export async function mockFetchExampleDetail(id: string): Promise<ExampleItem> {
  await delay()
  const item = db.find((it) => it.id === id)
  if (!item) throw new Error(`示例数据不存在：${id}`)
  return { ...item }
}

export async function mockCreateExample(payload: ExampleCreatePayload): Promise<ExampleItem> {
  await delay()
  const item: ExampleItem = {
    id: nextId(),
    createdAt: new Date().toISOString(),
    ...payload,
  }
  db = [item, ...db]
  return { ...item }
}

export async function mockRemoveExample(id: string): Promise<void> {
  await delay()
  db = db.filter((it) => it.id !== id)
}
