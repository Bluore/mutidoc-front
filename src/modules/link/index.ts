/**
 * 授权链接模块出口（Public API）。
 */
export { default as linkRoutes } from './routes'
export { useGrantStore } from './stores/grant'
export { GRANT_ERROR_CODES } from './constants'
export type { GrantExchangeResult, GrantStatus } from './types'
