import { request } from '@/api'
import type { PageResult } from '@/api'
import { env } from '@/config/env'

import type { ExampleCreatePayload, ExampleItem, ExampleQuery } from '../types'
import {
  mockCreateExample,
  mockFetchExampleDetail,
  mockFetchExampleList,
  mockRemoveExample,
} from './mock'

/**
 * 模块 API 层：统一使用全局 request()，天然获得鉴权、错误归一化与信封解包。
 * mock 分支仅为演示，接后端时删除即可（VITE_USE_MOCK=false 也会绕过）。
 */

export function fetchExampleList(query: ExampleQuery): Promise<PageResult<ExampleItem>> {
  if (env.useMock) return mockFetchExampleList(query)
  return request<PageResult<ExampleItem>>({
    url: '/examples',
    method: 'get',
    params: query,
  })
}

export function fetchExampleDetail(id: string): Promise<ExampleItem> {
  if (env.useMock) return mockFetchExampleDetail(id)
  return request<ExampleItem>({
    url: `/examples/${id}`,
    method: 'get',
  })
}

export function createExample(payload: ExampleCreatePayload): Promise<ExampleItem> {
  if (env.useMock) return mockCreateExample(payload)
  return request<ExampleItem>({
    url: '/examples',
    method: 'post',
    data: payload,
  })
}

export function deleteExample(id: string): Promise<void> {
  if (env.useMock) return mockRemoveExample(id)
  return request<void>({
    url: `/examples/${id}`,
    method: 'delete',
  })
}
