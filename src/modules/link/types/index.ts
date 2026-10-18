/**
 * 换取文档地址返回（GET /link/v1/grant/{grantId}）。
 * `link` 是最终目标地址，形如 `<BaseUrl>/documents/<documentId>/edit`。
 */
export interface GrantExchangeResult {
  link: string
}

/** 授权中间页的展示状态 */
export type GrantStatus = 'exchanging' | 'success' | 'error'
