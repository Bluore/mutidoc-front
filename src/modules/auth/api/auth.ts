import { request } from '@/api'
import { env } from '@/config/env'

import { ROBOT_CODE_PLACEHOLDER } from '../constants'
import type { AuthToken, LoginPayload, RegisterPayload } from '../types'
import { mockLogin, mockRegister, mockSendEmailCode } from './mock'

/**
 * 鉴权模块 API 层。
 * 路径为「服务前缀之后」的部分，`/api` 由 env.apiBaseUrl 统一提供。
 */

/** 登录：POST /user/v1/login */
export function login(payload: LoginPayload): Promise<AuthToken> {
  if (env.useMock) return mockLogin(payload)
  return request<AuthToken>({
    url: '/user/v1/login',
    method: 'post',
    data: payload,
  })
}

/** 注册：POST /user/v1/user */
export function register(payload: RegisterPayload): Promise<AuthToken> {
  if (env.useMock) return mockRegister(payload)
  return request<AuthToken>({
    url: '/user/v1/user',
    method: 'post',
    data: payload,
  })
}

/** 获取邮箱验证码：POST /user/v1/email/code（body 传 `email` + `robot_code`） */
export function sendEmailCode(email: string): Promise<void> {
  if (env.useMock) return mockSendEmailCode(email)
  return request<void>({
    url: '/user/v1/email/code',
    method: 'post',
    data: { email, robot_code: ROBOT_CODE_PLACEHOLDER },
  })
}
