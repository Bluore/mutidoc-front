/**
 * 用户模块出口（Public API）。
 * 布局等外部代码通过这里消费当前用户信息。
 */
export { default as userRoutes } from './routes'
export { useUserStore } from './stores/user'
export type { UpdateProfilePayload, UserInfo } from './types'
