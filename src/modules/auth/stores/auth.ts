import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { login as loginApi, register as registerApi, sendEmailCode as sendEmailCodeApi } from '../api/auth'
import type { AuthToken, LoginPayload, RegisterPayload } from '../types'

/** 与 src/api/http.ts 的 TOKEN_STORAGE_KEY 保持一致 */
const TOKEN_KEY = 'md_token'
const EXPIRE_KEY = 'md_token_expire'

function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** 读取绝对过期时间戳（Unix 秒），读不到或非法时返回 0 */
function readExpire(): number {
  const raw = localStorage.getItem(EXPIRE_KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

/**
 * 全局登录态：负责凭证的持久化与刷新。
 * token 写入 localStorage['md_token']，请求拦截器会自动带上 Authorization 头。
 */
export const useAuthStore = defineStore('auth', () => {
  // state
  const token = ref<string | null>(readToken())
  const expiresAt = ref<number>(readExpire())

  // getters：access_expire 是秒级绝对时间戳
  const isAuthenticated = computed(
    () => Boolean(token.value) && expiresAt.value * 1000 > Date.now(),
  )

  // actions
  function applyAuth(result: AuthToken): void {
    token.value = result.access_token
    expiresAt.value = result.access_expire
    localStorage.setItem(TOKEN_KEY, result.access_token)
    localStorage.setItem(EXPIRE_KEY, String(result.access_expire))
  }

  function clearAuth(): void {
    token.value = null
    expiresAt.value = 0
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRE_KEY)
  }

  async function login(payload: LoginPayload): Promise<void> {
    applyAuth(await loginApi(payload))
  }

  async function register(payload: RegisterPayload): Promise<void> {
    applyAuth(await registerApi(payload))
  }

  async function sendEmailCode(email: string): Promise<void> {
    await sendEmailCodeApi(email)
  }

  function logout(): void {
    clearAuth()
  }

  /** 凭证过期时清理本地存储，供路由守卫调用 */
  function ensureFresh(): void {
    if (token.value && !isAuthenticated.value) clearAuth()
  }

  return {
    token,
    expiresAt,
    isAuthenticated,
    login,
    register,
    sendEmailCode,
    logout,
    ensureFresh,
  }
})
