/**
 * 环境配置的唯一出口。
 * 业务代码不要直接读取 import.meta.env，统一从这里取值，便于集中维护与类型约束。
 */
export const env = {
  appTitle: import.meta.env.VITE_APP_TITLE || 'MutiDoc',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  requestTimeout: Number(import.meta.env.VITE_REQUEST_TIMEOUT) || 10_000,
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  /** 协作编辑 WebSocket 端点覆盖值；为空时按当前 origin + apiBaseUrl 推导 */
  collabWsUrl: import.meta.env.VITE_COLLAB_WS_URL || '',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const
