/**
 * link-api 授权相关错误码。
 * 这些错误以 HTTP 200 + 非零 code 返回，由 request() 统一抛出 ApiError。
 */
export const GRANT_ERROR_CODES = {
  /** 链接不存在，或对应文档已被删除 */
  notFound: 1034001,
  /** 链接已超过有效期 */
  expired: 1034002,
  /** 授予文档权限失败 */
  denied: 1034003,
} as const

/** 授权成功后停留展示成功态的时长（毫秒），随后自动进入文档 */
export const GRANT_REDIRECT_DELAY_MS = 500

/**
 * 授权链接类错误（链接本身不可用）不适合直接重试，
 * 网络异常 / 服务端 500 等才允许重试。
 */
export function isGrantLinkError(code: number | null): boolean {
  return (
    code === GRANT_ERROR_CODES.notFound ||
    code === GRANT_ERROR_CODES.expired ||
    code === GRANT_ERROR_CODES.denied
  )
}
