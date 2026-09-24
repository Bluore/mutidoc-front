import axios from 'axios'
import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios'

import { env } from '@/config/env'

import { ApiError } from './error'
import type { ApiResponse } from './types'

/** 本地凭证 key，登录模块接入后统一使用它 */
export const TOKEN_STORAGE_KEY = 'md_token'

/** 全局唯一的 axios 实例：所有请求都必须经过它 */
export const http: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.requestTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截：注入鉴权信息
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// 响应拦截：把各类错误统一归一为 ApiError
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<unknown>>) => {
    const status = error.response?.status
    const body = error.response?.data

    // 鉴权失败：清理失效凭证并回到登录页（避免继续带着坏 token 请求）
    if (status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }

    const message = body?.message || body?.msg || error.message || '网络请求失败'
    return Promise.reject(new ApiError(message, body?.code ?? -1, status))
  },
)

/**
 * 业务请求入口：自动解包统一信封，code 非 0 时抛出 ApiError。
 *
 * @example
 * const page = await request<PageResult<ExampleItem>>({ url: '/examples', method: 'get', params })
 */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<ApiResponse<T>>(config)
  const body = response.data
  // 兼容 204 No Content 等无响应体的情况
  if (body == null) return undefined as T
  if (body.code !== 0) {
    throw new ApiError(body.message || body.msg || '业务处理失败', body.code)
  }
  return body.data
}
