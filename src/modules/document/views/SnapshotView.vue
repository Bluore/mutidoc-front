<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Card as PxCard,
  Spin as PxSpin,
  Tag as PxTag,
} from '@pixelium/web-vue/es'
import { IconExclamationTriangle, IconRefresh } from '@pixelium/web-vue/icon-hn/es'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { env } from '@/config/env'
import { formatUnixSeconds } from '@/utils/date'

import {
  DOCUMENT_SNAPSHOT_EMPTY_TEXT,
  DOCUMENT_SNAPSHOT_LINK_DAYS,
  DOCUMENT_SUMMARY_FALLBACK,
} from '../constants'
import { useSnapshotStore } from '../stores/snapshot'

/**
 * 文档快照公开页（`/public_documents/:snapshotId`，整屏布局、无需登录）。
 *
 * 由快照短链经 link 服务 302 跳转而来，也可能是用户直接打开的地址。
 * 页面只读：按 snapshot_id 调用公开接口取回发布时冻结的标题与正文，不提供编辑入口。
 */
const props = defineProps<{ snapshotId: string }>()

const snapshotStore = useSnapshotStore()

const detail = computed(() => snapshotStore.detail)
const title = computed(() => detail.value?.summary.trim() || DOCUMENT_SUMMARY_FALLBACK)
const hasContent = computed(() => (detail.value?.content ?? '').length > 0)

const errorInfo = computed(() =>
  snapshotStore.notFound
    ? {
        title: '快照不存在',
        description: `链接可能拼写有误，或该快照已被删除。分享短链默认有效期为 ${DOCUMENT_SNAPSHOT_LINK_DAYS} 天，请联系文档归属者重新发布。`,
      }
    : {
        title: '快照加载失败',
        description: '快照内容暂时无法读取，请稍后重试。',
      },
)

function reload(): void {
  void snapshotStore.load(props.snapshotId)
}

watch(
  () => props.snapshotId,
  (snapshotId) => {
    if (snapshotId) void snapshotStore.load(snapshotId)
  },
  { immediate: true },
)
</script>

<template>
  <div class="snapshot-view">
    <header class="snapshot-view__top">
      <RouterLink class="snapshot-view__brand" :to="{ name: 'home' }">
        <span class="snapshot-view__brand-mark">M</span>
        <span class="snapshot-view__brand-text">{{ env.appTitle }}</span>
      </RouterLink>
      <PxTag size="small" variant="outline" theme="info">只读快照</PxTag>
    </header>

    <main class="snapshot-view__main">
      <PxSpin class="snapshot-view__spin" :loading="snapshotStore.loading">
        <!-- 快照正文 -->
        <PxCard
          v-if="detail"
          class="snapshot-view__card"
          shape="rect"
          :bordered="true"
        >
          <template #header>
            <div class="snapshot-view__title-row">
              <h1 class="snapshot-view__title">{{ title }}</h1>
              <PxTag size="small" variant="outline" theme="success">只读</PxTag>
            </div>
          </template>

          <dl class="snapshot-view__meta">
            <div class="snapshot-view__meta-item">
              <dt class="snapshot-view__meta-label">快照 ID</dt>
              <dd class="snapshot-view__meta-value">{{ detail.id }}</dd>
            </div>
            <div class="snapshot-view__meta-item">
              <dt class="snapshot-view__meta-label">归属者</dt>
              <dd class="snapshot-view__meta-value">{{ detail.owner_id }}</dd>
            </div>
            <div class="snapshot-view__meta-item">
              <dt class="snapshot-view__meta-label">版本</dt>
              <dd class="snapshot-view__meta-value">v{{ detail.version }}</dd>
            </div>
            <div class="snapshot-view__meta-item">
              <dt class="snapshot-view__meta-label">发布时间</dt>
              <dd class="snapshot-view__meta-value">{{ formatUnixSeconds(detail.create_at) }}</dd>
            </div>
          </dl>

          <pre v-if="hasContent" class="snapshot-view__content">{{ detail.content }}</pre>
          <p v-else class="snapshot-view__empty">{{ DOCUMENT_SNAPSHOT_EMPTY_TEXT }}</p>

          <p class="snapshot-view__note">
            这是发布时冻结的内容快照，之后对原文档的修改不会同步到这里。
          </p>
        </PxCard>

        <!-- 加载中占位 -->
        <PxCard
          v-else-if="snapshotStore.loading"
          class="snapshot-view__card snapshot-view__card--state"
          shape="rect"
          :bordered="true"
        >
          <p class="snapshot-view__loading">正在加载快照内容…</p>
        </PxCard>

        <!-- 加载失败 -->
        <PxCard
          v-else-if="snapshotStore.error"
          class="snapshot-view__card snapshot-view__card--state"
          shape="rect"
          :bordered="true"
        >
          <div class="snapshot-view__state">
            <span class="snapshot-view__state-icon" aria-hidden="true">
              <IconExclamationTriangle />
            </span>
            <h1 class="snapshot-view__state-title">{{ errorInfo.title }}</h1>
            <p class="snapshot-view__state-desc">{{ errorInfo.description }}</p>

            <PxAlert
              v-if="snapshotStore.canRetry && snapshotStore.error"
              class="snapshot-view__state-alert"
              type="error"
              :title="snapshotStore.error"
            />

            <PxButton v-if="snapshotStore.canRetry" native-type="button" @click="reload">
              <template #icon>
                <IconRefresh />
              </template>
              重新加载
            </PxButton>
          </div>
        </PxCard>
      </PxSpin>
    </main>

    <footer class="snapshot-view__footer">{{ env.appTitle }} · 只读文档快照</footer>
  </div>
</template>

<style scoped>
.snapshot-view {
  --snapshot-view-grid: color-mix(in srgb, var(--md-color-border) 45%, transparent);

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--md-color-bg);
  background-image:
    linear-gradient(to right, var(--snapshot-view-grid) 1px, transparent 1px),
    linear-gradient(to bottom, var(--snapshot-view-grid) 1px, transparent 1px);
  background-size: 24px 24px;
}

.snapshot-view__top {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--md-space-5) var(--md-space-6);
}

.snapshot-view__brand {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-lg);
  font-weight: 700;
  color: var(--md-color-text);
}

.snapshot-view__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.snapshot-view__main {
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  padding: var(--md-space-6);
}

.snapshot-view__spin {
  width: 100%;
  max-width: 860px;
}

.snapshot-view__card {
  width: 100%;
}

.snapshot-view__card--state {
  min-height: 280px;
}

.snapshot-view__title-row {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.snapshot-view__title {
  margin: 0;
  overflow: hidden;
  font-size: var(--md-font-size-xl);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-view__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3) var(--md-space-6);
  margin: 0 0 var(--md-space-4);
}

.snapshot-view__meta-item {
  display: flex;
  gap: var(--md-space-2);
  align-items: baseline;
  min-width: 0;
  font-size: var(--md-font-size-sm);
}

.snapshot-view__meta-label {
  flex: none;
  color: var(--md-color-text-secondary);
}

.snapshot-view__meta-value {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-view__content {
  padding: var(--md-space-4);
  margin: 0;
  overflow-x: auto;
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-sm);
  line-height: var(--md-line-height);
  color: var(--md-color-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background-color: var(--md-color-bg);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-sm);
}

.snapshot-view__empty,
.snapshot-view__loading {
  padding: var(--md-space-6) 0;
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  text-align: center;
}

.snapshot-view__note {
  margin: var(--md-space-4) 0 0;
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-disabled);
}

.snapshot-view__state {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  align-items: center;
  padding: var(--md-space-6) var(--md-space-4);
  text-align: center;
}

.snapshot-view__state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  font-size: 32px;
  color: var(--md-color-danger);
  background-color: var(--md-color-danger-soft);
  border-radius: var(--md-radius-lg);
}

.snapshot-view__state-title {
  margin: 0;
  font-size: var(--md-font-size-xl);
}

.snapshot-view__state-desc {
  margin: 0;
  font-size: var(--md-font-size-md);
  color: var(--md-color-text-secondary);
}

.snapshot-view__state-alert {
  width: 100%;
  text-align: left;
}

.snapshot-view__footer {
  padding: var(--md-space-4) var(--md-space-6);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  text-align: center;
}
</style>
