import { request } from '@/api'
import { env } from '@/config/env'

import type { GrantExchangeResult } from '../types'
import { mockExchangeGrantLink } from './mock'

/**
 * 换取文档地址：GET /link/v1/grant/{grantId}
 *
 * 需要 JWT；link-api 会校验链接、检查文档权限，无权限时先授予权限，
 * 最后返回文档编辑页地址（不再 302）。
 */
export async function exchangeGrantLink(grantId: string): Promise<string> {
  if (env.useMock) return mockExchangeGrantLink(grantId)

  const data = await request<GrantExchangeResult>({
    url: `/link/v1/grant/${encodeURIComponent(grantId)}`,
    method: 'get',
  })
  return data.link
}
