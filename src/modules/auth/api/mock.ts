import type { AuthToken, LoginPayload, RegisterPayload } from '../types'

/**
 * 模块内置 mock：后端未就绪时的本地假实现（VITE_USE_MOCK=true 时生效）。
 * 仅用于演示流程，接入真实接口后把 .env 的 VITE_USE_MOCK 改为 false 即可整体绕过。
 */
const DELAY = 400
const delay = (ms = DELAY) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface MockUser {
  id: string
  email: string
  nick_name: string
  password: string
}

let sequence = 1
const users = new Map<string, MockUser>()
users.set('demo@mutidoc.dev', {
  id: '1',
  email: 'demo@mutidoc.dev',
  nick_name: 'Demo',
  password: 'demo1234',
})

function issueToken(userId: string): AuthToken {
  return {
    access_token: `mock-token-${userId}-${Date.now().toString(36)}`,
    // 与后端保持一致：绝对过期时间（秒），这里给 1 小时
    access_expire: Math.floor(Date.now() / 1000) + 3600,
  }
}

export async function mockLogin(payload: LoginPayload): Promise<AuthToken> {
  await delay()
  // login 既可以是邮箱，也可以是登录名（昵称）
  const key = payload.login.trim().toLowerCase()
  const user = [...users.values()].find(
    (item) => item.email === key || item.nick_name.toLowerCase() === key,
  )
  // 与后端错误码 1014007 的文案保持一致
  if (!user || user.password !== payload.password) {
    throw new Error('用户名或密码错误')
  }
  return issueToken(user.id)
}

export async function mockRegister(payload: RegisterPayload): Promise<AuthToken> {
  await delay()
  const email = payload.email.trim().toLowerCase()
  if (users.has(email)) throw new Error('邮箱已存在')
  sequence += 1
  const user: MockUser = {
    id: String(sequence),
    email,
    nick_name: payload.nick_name.trim(),
    password: payload.password,
  }
  users.set(email, user)
  return issueToken(user.id)
}

export async function mockSendEmailCode(email: string): Promise<void> {
  await delay(300)
  // 演示环境下把验证码打到控制台，方便体验注册流程
  console.info(`[mock] 邮箱验证码已发送至 ${email}（演示验证码：123456）`)
}
