<script setup lang="ts">
import { Button as PxButton, Card as PxCard, Spin as PxSpin } from '@pixelium/web-vue/es'
import {
  IconCheckCircle,
  IconExclamationTriangle,
  IconHome,
  IconLink,
  IconRefresh,
} from '@pixelium/web-vue/icon-hn/es'
import { computed, onBeforeUnmount, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { env } from '@/config/env'

import { GRANT_ERROR_CODES, GRANT_REDIRECT_DELAY_MS } from '../constants'
import { useGrantStore } from '../stores/grant'

/**
 * 授权中间页（`/grant/:grantId`，整屏布局、需要登录）。
 *
 * 打开分享链接后调用 link-api 换取文档地址：
 * - 成功：短暂展示成功态后跳转到 `data.link`；
 * - 失败：按错误码展示原因（链接不存在 / 已过期 / 授权失败 / 网络异常）。
 */
const props = defineProps<{ grantId: string }>()

const router = useRouter()
const grant = useGrantStore()

const ERROR_INFO: Record<number, { title: string; description: string }> = {
  [GRANT_ERROR_CODES.notFound]: {
    title: '授权链接不存在',
    description: '链接可能已被撤销，或对应的文档已被删除。请向文档归属者重新获取授权链接。',
  },
  [GRANT_ERROR_CODES.expired]: {
    title: '授权链接已过期',
    description: '授权链接有效期为 7 天。请联系文档归属者重新生成一条链接。',
  },
  [GRANT_ERROR_CODES.denied]: {
    title: '授权失败',
    description: '未能为你授予该文档的访问权限。请稍后重试，或联系文档归属者确认文档状态。',
  },
}

const DEFAULT_ERROR_INFO = {
  title: '授权失败',
  description: '授权过程中出现问题，请稍后重试。',
}

const errorInfo = computed(() => {
  const code = grant.errorCode
  return code !== null && code in ERROR_INFO ? ERROR_INFO[code] : DEFAULT_ERROR_INFO
})

/** 业务错误附带错误码，便于用户反馈问题时定位 */
const errorDetail = computed(() =>
  grant.errorCode === null ? grant.errorMessage : `${grant.errorMessage}（${grant.errorCode}）`,
)

/** 已预约的跳转定时器；重试 / 手动进入 / 卸载时都要取消 */
let redirectTimer: number | undefined
/** 组件已卸载：丢弃迟到的授权结果，避免卸载后仍触发跳转 */
let disposed = false

function cancelRedirect(): void {
  if (redirectTimer === undefined) return
  window.clearTimeout(redirectTimer)
  redirectTimer = undefined
}

/** 解析后端返回的目标地址，只接受 http(s) */
function parseTarget(raw: string): URL | null {
  const value = raw.trim()
  if (!value) return null

  try {
    const url = new URL(value, window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/**
 * 在当前前端 origin 内跳转文档页。
 *
 * 后端返回的 `<BaseUrl>` 可能是网关地址（例如开发环境的 `:8888`），
 * 直接整页跳转会让浏览器切换到另一个 origin，丢失当前 origin 的登录态；
 * 因此这里只取路径交给前端路由，origin 保持为当前页面。
 */
function navigateToTarget(): void {
  cancelRedirect()

  const url = parseTarget(grant.target)
  if (!url) {
    grant.fail('授权成功，但返回的文档地址无效，请稍后重试。')
    return
  }

  const path = `${url.pathname}${url.search}${url.hash}`
  router.replace(path).catch(() => {
    window.location.assign(path)
  })
}

async function run(): Promise<void> {
  cancelRedirect()
  const target = await grant.exchange(props.grantId)
  if (disposed || !target) return
  redirectTimer = window.setTimeout(navigateToTarget, GRANT_REDIRECT_DELAY_MS)
}

function retry(): void {
  void run()
}

function goHome(): void {
  void router.replace({ name: 'home' })
}

watch(
  () => props.grantId,
  () => void run(),
  { immediate: true },
)

onBeforeUnmount(() => {
  disposed = true
  cancelRedirect()
})
</script>

<template>
  <div class="grant-view">
    <header class="grant-view__top">
      <RouterLink class="grant-view__brand" :to="{ name: 'home' }">
        <span class="grant-view__brand-mark">M</span>
        <span class="grant-view__brand-text">{{ env.appTitle }}</span>
      </RouterLink>
    </header>

    <main class="grant-view__main">
      <PxCard class="grant-view__card" shape="rect" :bordered="true">
        <div class="grant-view__content" role="status" aria-live="polite">
          <!-- 授权中 -->
          <template v-if="grant.status === 'exchanging'">
            <span class="grant-view__icon grant-view__icon--pending" aria-hidden="true">
              <PxSpin size="large" />
            </span>
            <h1 class="grant-view__title">正在验证授权链接</h1>
            <p class="grant-view__desc">正在为你开通该文档的访问权限，请稍候…</p>
            <p class="grant-view__hint">授权完成后会自动进入文档，请不要关闭页面。</p>
          </template>

          <!-- 授权成功 -->
          <template v-else-if="grant.status === 'success'">
            <span class="grant-view__icon grant-view__icon--success" aria-hidden="true">
              <IconCheckCircle />
            </span>
            <h1 class="grant-view__title">授权成功</h1>
            <p class="grant-view__desc">正在进入文档编辑页…</p>
            <div class="grant-view__actions">
              <PxButton native-type="button" @click="navigateToTarget">
                <template #icon>
                  <IconLink />
                </template>
                立即进入
              </PxButton>
            </div>
          </template>

          <!-- 授权失败 -->
          <template v-else>
            <span class="grant-view__icon grant-view__icon--error" aria-hidden="true">
              <IconExclamationTriangle />
            </span>
            <h1 class="grant-view__title">{{ errorInfo.title }}</h1>
            <p class="grant-view__desc">{{ errorInfo.description }}</p>

            <p v-if="grant.errorMessage" class="grant-view__detail">
              <span class="grant-view__detail-label">错误信息</span>
              <code class="grant-view__detail-value">{{ errorDetail }}</code>
            </p>

            <div class="grant-view__actions">
              <PxButton v-if="grant.canRetry" native-type="button" @click="retry">
                <template #icon>
                  <IconRefresh />
                </template>
                重新验证
              </PxButton>
              <PxButton
                :variant="grant.canRetry ? 'outline' : undefined"
                native-type="button"
                @click="goHome"
              >
                <template #icon>
                  <IconHome />
                </template>
                返回工作台
              </PxButton>
            </div>
          </template>
        </div>
      </PxCard>
    </main>

    <footer class="grant-view__footer">{{ env.appTitle }} · 像素风多文档协作</footer>
  </div>
</template>

<style scoped>
.grant-view {
  --grant-view-grid: color-mix(in srgb, var(--md-color-border) 45%, transparent);

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--md-color-bg);
  background-image:
    linear-gradient(to right, var(--grant-view-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--grant-view-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}

.grant-view__top {
  display: flex;
  align-items: center;
  padding: var(--md-space-5) var(--md-space-6);
}

.grant-view__brand {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-lg);
  font-weight: 700;
  color: var(--md-color-text);
}

.grant-view__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.grant-view__main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: var(--md-space-6);
}

.grant-view__card {
  width: 100%;
  max-width: 520px;
}

.grant-view__content {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  align-items: center;
  text-align: center;
}

.grant-view__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  font-size: 32px;
  border-radius: var(--md-radius-lg);
}

.grant-view__icon--pending {
  color: var(--md-color-primary);
  background-color: var(--md-color-primary-soft);
}

/* 覆盖第三方 Spin 内部图标颜色，使其跟随项目主题令牌 */
.grant-view__icon--pending :deep(.px-spin-icon) {
  fill: var(--md-color-primary);
}

.grant-view__icon--success {
  color: var(--md-color-success);
  background-color: color-mix(in srgb, var(--md-color-success) 12%, transparent);
}

.grant-view__icon--error {
  color: var(--md-color-danger);
  background-color: var(--md-color-danger-soft);
}

.grant-view__title {
  margin: 0;
  font-size: var(--md-font-size-xl);
}

.grant-view__desc {
  margin: 0;
  font-size: var(--md-font-size-md);
  color: var(--md-color-text-secondary);
}

.grant-view__hint {
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-disabled);
}

.grant-view__detail {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--md-space-2);
  align-items: center;
  max-width: 100%;
  padding: var(--md-space-1) var(--md-space-3);
  margin: 0;
  font-size: var(--md-font-size-sm);
  background-color: var(--md-color-bg);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-sm);
}

.grant-view__detail-label {
  flex: none;
  color: var(--md-color-text-disabled);
}

.grant-view__detail-value {
  font-family: var(--md-font-mono);
  color: var(--md-color-text-secondary);
  word-break: break-all;
}

.grant-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3);
  justify-content: center;
  margin-top: var(--md-space-2);
}

.grant-view__footer {
  padding: var(--md-space-4) var(--md-space-6);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  text-align: center;
}
</style>
