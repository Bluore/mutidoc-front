import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/utils/error'

import { fetchCurrentUser, updateProfile as updateProfileApi, uploadAvatar as uploadAvatarApi } from '../api/user'
import type { UserInfo } from '../types'

/** 取昵称首字符作为头像占位（中文取首字，英文取首字母大写） */
function toInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?'
}

/**
 * 当前用户信息 store：登录后由布局统一拉取一次，供各页面消费。
 * 数据修改失败会向上抛出，由调用方决定提示方式。
 */
export const useUserStore = defineStore('user', () => {
  // state
  const profile = ref<UserInfo | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const avatarUpdating = ref(false)
  const error = ref<string | null>(null)
  const loaded = ref(false)

  // getters
  const displayName = computed(() => profile.value?.nick_name || profile.value?.email || '未登录')
  const initials = computed(() => toInitial(displayName.value))
  const hasAvatar = computed(() => Boolean(profile.value?.avatar))

  // actions
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      profile.value = await fetchCurrentUser()
      loaded.value = true
    } catch (e) {
      error.value = getErrorMessage(e, '获取用户信息失败')
    } finally {
      loading.value = false
    }
  }

  /** 只在尚未加载时请求一次，避免布局反复触发 */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value || loading.value) return
    await load()
  }

  async function updateProfile(nickName: string): Promise<void> {
    saving.value = true
    try {
      profile.value = await updateProfileApi({ nick_name: nickName })
    } finally {
      saving.value = false
    }
  }

  async function updateAvatar(dataUrl: string): Promise<void> {
    avatarUpdating.value = true
    try {
      profile.value = await uploadAvatarApi(dataUrl)
    } finally {
      avatarUpdating.value = false
    }
  }

  function reset(): void {
    profile.value = null
    error.value = null
    loaded.value = false
  }

  return {
    profile,
    loading,
    saving,
    avatarUpdating,
    error,
    loaded,
    displayName,
    initials,
    hasAvatar,
    load,
    ensureLoaded,
    updateProfile,
    updateAvatar,
    reset,
  }
})
