/**
 * 全局 API 层出口（基础设施）。
 * 模块内的 api/*.ts 统一从这里导入 request / 类型。
 */
export { http, request, TOKEN_STORAGE_KEY } from './http'
export { ApiError } from './error'
export type { ApiResponse, PageQuery, PageResult } from './types'
