/// <reference types="vite/client" />

/** 与 .env.example 保持一致：新增变量后请同步补充类型 */
interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_REQUEST_TIMEOUT?: string
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
