import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { getErrorMessage } from '@/utils/error'

import { exchangeGrantLink } from '../api/link'
import { isGrantLinkError } from '../constants'
import type { GrantStatus } from '../types'

/**
 * 授权中间页 store：调用 link-api 换取文档地址。
 * 只负责状态与请求，跳转由视图（路由层）完成。
 */
export const useGrantStore = defineStore('grant', () => {
  // state
  const status = ref<GrantStatus>('exchanging')
  /** 授权成功后拿到的目标地址；失败或加载中为空串 */
  const target = ref('')
  const errorCode = ref<number | null>(null)
  const errorMessage = ref('')

  /** 请求序号：切换 grantId 时丢弃上一次的迟到响应 */
  let requestSequence = 0

  // getters
  /** 只有网络异常 / 服务端异常才值得重试；链接本身失效时重试没有意义 */
  const canRetry = computed(
    () => status.value === 'error' && !isGrantLinkError(errorCode.value),
  )

  // actions
  async function exchange(grantId: string): Promise<string | null> {
    const sequence = ++requestSequence

    status.value = 'exchanging'
    target.value = ''
    errorCode.value = null
    errorMessage.value = ''

    try {
      const link = await exchangeGrantLink(grantId)
      if (sequence !== requestSequence) return null

      target.value = link
      status.value = 'success'
      return link
    } catch (error) {
      if (sequence !== requestSequence) return null

      status.value = 'error'
      errorCode.value = error instanceof ApiError ? error.code : null
      errorMessage.value = getErrorMessage(error, '授权失败，请稍后重试')
      return null
    }
  }

  /** 后端返回的地址不可用时，把页面切到错误态 */
  function fail(message: string): void {
    status.value = 'error'
    errorCode.value = null
    errorMessage.value = message
  }

  return {
    status,
    target,
    errorCode,
    errorMessage,
    canRetry,
    exchange,
    fail,
  }
})
