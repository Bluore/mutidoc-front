import type { UpdateProfilePayload, UserInfo } from '../types'

/**
 * 模块内置 mock：演示用户信息的读取与修改。
 * 真实后端 `/user/v1/user` 只提供「查询」，修改昵称 / 头像尚未实现（见 docs/user-api.md）。
 */
const DELAY = 350
const delay = (ms = DELAY) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let profile: UserInfo = {
  id: '1001',
  nick_name: 'Demo',
  email: 'demo@mutidoc.dev',
  avatar: '',
}

export async function mockFetchCurrentUser(): Promise<UserInfo> {
  await delay()
  return { ...profile }
}

export async function mockUpdateProfile(payload: UpdateProfilePayload): Promise<UserInfo> {
  await delay()
  profile = { ...profile, nick_name: payload.nick_name }
  return { ...profile }
}

export async function mockUploadAvatar(dataUrl: string): Promise<UserInfo> {
  await delay()
  profile = { ...profile, avatar: dataUrl }
  return { ...profile }
}
