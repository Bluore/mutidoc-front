import { ApiError, request } from '@/api'
import { env } from '@/config/env'

import type { UpdateProfilePayload, UserInfo } from '../types'
import { mockFetchCurrentUser, mockUpdateProfile, mockUploadAvatar } from './mock'

/**
 * 用户模块 API 层。
 *
 * 现状说明（见 docs/user-api.md）：
 * - 仅「获取当前用户信息」已实现；
 * - 「修改头像」在后端是空实现（会返回假成功、不保存任何内容），因此这里直接给出明确提示；
 * - 不存在「修改昵称」接口。
 */

/** 获取当前用户信息：GET /user/v1/user */
export async function fetchCurrentUser(): Promise<UserInfo> {
  if (env.useMock) return mockFetchCurrentUser()
  const data = await request<{ user_info: UserInfo }>({
    url: '/user/v1/user',
    method: 'get',
  })
  return data.user_info
}

/** 修改资料：后端暂未提供对应接口，Mock 模式下用于演示 */
export function updateProfile(payload: UpdateProfilePayload): Promise<UserInfo> {
  if (env.useMock) return mockUpdateProfile(payload)
  return Promise.reject(new ApiError('后端暂未提供修改资料的接口', -1))
}

/** 修改头像：POST /user/v1/user/avatar（后端未实现，暂不真正调用） */
export function uploadAvatar(dataUrl: string): Promise<UserInfo> {
  if (env.useMock) return mockUploadAvatar(dataUrl)
  return Promise.reject(new ApiError('后端暂未实现头像上传，敬请期待', -1))
}
