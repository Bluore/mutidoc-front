import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { getErrorMessage } from '@/utils/error'

import { fetchSnapshotContent } from '../api/document'
import { DOCUMENT_SNAPSHOT_NOT_FOUND_CODE } from '../constants'
import type { DocumentSnapshot } from '../types'

/**
 * 只读快照 store：供公开页 `/public_documents/:snapshotId` 拉取快照正文。
 *
 * 该页面无需登录，store 只负责请求与状态；「快照不存在」是终态，
 * 其他异常（网络 / 服务端）可以由视图重试。
 */
export const useSnapshotStore = defineStore('document-snapshot', () => {
  // state
  const detail = ref<DocumentSnapshot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const errorCode = ref<number | null>(null)

  /** 请求序号：切换快照 ID 时丢弃上一次的迟到响应 */
  let requestSequence = 0

  // getters
  const notFound = computed(() => errorCode.value === DOCUMENT_SNAPSHOT_NOT_FOUND_CODE)
  /** 快照不存在时重试没有意义，只有网络 / 服务端异常才提供重试 */
  const canRetry = computed(() => error.value !== null && !notFound.value)

  // actions
  async function load(snapshotId: string): Promise<void> {
    const sequence = ++requestSequence

    loading.value = true
    detail.value = null
    error.value = null
    errorCode.value = null

    try {
      const result = await fetchSnapshotContent(snapshotId)
      if (sequence !== requestSequence) return
      detail.value = result
    } catch (e) {
      if (sequence !== requestSequence) return
      error.value = getErrorMessage(e, '快照加载失败，请稍后重试')
      errorCode.value = e instanceof ApiError ? e.code : null
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  return {
    detail,
    loading,
    error,
    errorCode,
    notFound,
    canRetry,
    load,
  }
})
