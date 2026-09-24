/**
 * 鉴权模块出口（Public API）。
 * 其它模块 / 全局代码（如路由守卫）只能从这里导入。
 */
export { default as authRoutes } from './routes'
export { useAuthStore } from './stores/auth'
export type { AuthMode, AuthToken, LoginPayload, RegisterPayload } from './types'
export { EMAIL_PATTERN, EMAIL_CODE_COOLDOWN } from './constants'
