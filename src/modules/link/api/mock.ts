import { ApiError } from '@/api'

import { GRANT_ERROR_CODES } from '../constants'

/**
 * 模块内置 mock：模拟 link-api 的授权换取。
 *
 * 任意 grantId 都会授权成功并跳到 mock 文档 `1024`；
 * 以 `expired` / `missing` / `denied` 开头的 grantId 用于本地验证错误态。
 */
const DELAY = 500
const delay = (ms = DELAY) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const MOCK_ERRORS: Record<string, { code: number; message: string }> = {
  missing: { code: GRANT_ERROR_CODES.notFound, message: '链接不存在' },
  expired: { code: GRANT_ERROR_CODES.expired, message: '链接已过期' },
  denied: { code: GRANT_ERROR_CODES.denied, message: '没有权限访问该链接' },
}

export async function mockExchangeGrantLink(grantId: string): Promise<string> {
  await delay()

  const prefix = Object.keys(MOCK_ERRORS).find((key) => grantId.startsWith(key))
  if (prefix) {
    const error = MOCK_ERRORS[prefix]
    throw new ApiError(error.message, error.code)
  }

  return `${window.location.origin}/documents/1024/edit`
}
