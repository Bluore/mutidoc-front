<script setup lang="ts">
import { Button as PxButton, Card as PxCard } from '@pixelium/web-vue/es'
import { IconArrowLeft, IconFaceThinking, IconHome } from '@pixelium/web-vue/icon-hn/es'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { env } from '@/config/env'

/**
 * 404 错误页（`meta.layout = 'blank'`，整屏独立页面，未登录也可访问）。
 * 展示当前访问地址，并提供「返回上一页 / 返回工作台」两个出口。
 */
const route = useRoute()
const router = useRouter()

const currentPath = computed(() => route.fullPath)

/** 仅当存在站内跳转来源时才展示「返回上一页」，避免新标签页直开时点了没反应 */
const canGoBack = ref(false)

onMounted(() => {
  canGoBack.value = window.history.state?.back != null
})

function goBack(): void {
  router.back()
}

function goHome(): void {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="err-not-found">
    <header class="err-not-found__top">
      <RouterLink class="err-not-found__brand" :to="{ name: 'home' }">
        <span class="err-not-found__brand-mark">M</span>
        <span class="err-not-found__brand-text">{{ env.appTitle }}</span>
      </RouterLink>
    </header>

    <main class="err-not-found__main">
      <PxCard class="err-not-found__card" shape="rect" :bordered="true">
        <div class="err-not-found__content">
          <span class="err-not-found__icon" aria-hidden="true">
            <IconFaceThinking />
          </span>

          <p class="err-not-found__code">404</p>
          <h1 class="err-not-found__title">页面走丢了</h1>
          <p class="err-not-found__desc">你访问的页面不存在，或已经被移动、删除。</p>

          <p class="err-not-found__path">
            <span class="err-not-found__path-label">当前地址</span>
            <code class="err-not-found__path-value" :title="currentPath">{{ currentPath }}</code>
          </p>

          <div class="err-not-found__actions">
            <PxButton v-if="canGoBack" variant="outline" native-type="button" @click="goBack">
              <template #icon>
                <IconArrowLeft />
              </template>
              返回上一页
            </PxButton>
            <PxButton native-type="button" @click="goHome">
              <template #icon>
                <IconHome />
              </template>
              返回工作台
            </PxButton>
          </div>
        </div>
      </PxCard>
    </main>

    <footer class="err-not-found__footer">{{ env.appTitle }} · 像素风多文档协作</footer>
  </div>
</template>

<style scoped>
.err-not-found {
  --err-not-found-grid: color-mix(in srgb, var(--md-color-border) 45%, transparent);

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--md-color-bg);
  background-image:
    linear-gradient(to right, var(--err-not-found-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--err-not-found-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}

.err-not-found__top {
  display: flex;
  align-items: center;
  padding: var(--md-space-5) var(--md-space-6);
}

.err-not-found__brand {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-lg);
  font-weight: 700;
  color: var(--md-color-text);
}

.err-not-found__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.err-not-found__main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: var(--md-space-6);
}

.err-not-found__card {
  width: 100%;
  max-width: 520px;
}

.err-not-found__content {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  align-items: center;
  text-align: center;
}

.err-not-found__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  font-size: 32px;
  color: var(--md-color-primary);
  background-color: var(--md-color-primary-soft);
  border-radius: var(--md-radius-lg);
}

.err-not-found__code {
  margin: 0;
  font-size: 88px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 6px;
  color: var(--md-color-primary);
  text-shadow: 4px 4px 0 var(--md-color-primary-soft);
}

.err-not-found__title {
  margin: 0;
  font-size: var(--md-font-size-xl);
}

.err-not-found__desc {
  margin: 0;
  font-size: var(--md-font-size-md);
  color: var(--md-color-text-secondary);
}

.err-not-found__path {
  display: inline-flex;
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

.err-not-found__path-label {
  flex: none;
  color: var(--md-color-text-disabled);
}

.err-not-found__path-value {
  overflow: hidden;
  font-family: var(--md-font-mono);
  color: var(--md-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.err-not-found__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3);
  justify-content: center;
  margin-top: var(--md-space-2);
}

.err-not-found__footer {
  padding: var(--md-space-4) var(--md-space-6);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  text-align: center;
}

@media (max-width: 480px) {
  .err-not-found__code {
    font-size: 64px;
  }
}
</style>
