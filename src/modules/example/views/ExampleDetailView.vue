<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import { formatDateTime } from '@/utils/date'

import { EXAMPLE_STATUS_LABEL } from '../constants'
import { useExampleStore } from '../stores/example'

const props = defineProps<{ id: string }>()

const router = useRouter()
const store = useExampleStore()

const statusText = computed(() =>
  store.detail ? EXAMPLE_STATUS_LABEL[store.detail.status] : '',
)
const createdAtText = computed(() =>
  store.detail ? formatDateTime(store.detail.createdAt) : '-',
)

function loadDetail() {
  void store.loadDetail(props.id)
}

function goBack() {
  void router.push({ name: 'example-list' })
}

onMounted(loadDetail)
// 同一个组件复用时（仅 id 变化）需要重新拉取
watch(() => props.id, loadDetail)
</script>

<template>
  <section class="example-detail">
    <BaseButton size="sm" @click="goBack">← 返回列表</BaseButton>

    <p v-if="store.loading" class="example-detail__hint">加载中…</p>
    <p v-else-if="store.error" class="example-detail__error">{{ store.error }}</p>

    <article v-else-if="store.detail" class="example-detail__card">
      <header class="example-detail__header">
        <h1 class="example-detail__title">{{ store.detail.title }}</h1>
        <span class="example-detail__status">{{ statusText }}</span>
      </header>
      <p class="example-detail__desc">{{ store.detail.description }}</p>
      <dl class="example-detail__meta">
        <div class="example-detail__meta-item">
          <dt>ID</dt>
          <dd>{{ store.detail.id }}</dd>
        </div>
        <div class="example-detail__meta-item">
          <dt>创建时间</dt>
          <dd>{{ createdAtText }}</dd>
        </div>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.example-detail {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-5);
  align-items: flex-start;
}

.example-detail__card {
  width: 100%;
  padding: var(--md-space-6);
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-lg);
}

.example-detail__header {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}

.example-detail__title {
  font-size: var(--md-font-size-xl);
  font-weight: 700;
}

.example-detail__status {
  padding: var(--md-space-1) var(--md-space-3);
  font-size: var(--md-font-size-xs);
  color: var(--md-color-primary);
  background-color: var(--md-color-primary-soft);
  border-radius: var(--md-radius-full);
}

.example-detail__desc {
  margin-top: var(--md-space-4);
  color: var(--md-color-text-secondary);
}

.example-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-6);
  margin-top: var(--md-space-6);
  padding-top: var(--md-space-4);
  border-top: 1px solid var(--md-color-border);
}

.example-detail__meta-item dt {
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-disabled);
}

.example-detail__meta-item dd {
  margin: var(--md-space-1) 0 0;
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-sm);
}

.example-detail__hint {
  color: var(--md-color-text-secondary);
}

.example-detail__error {
  color: var(--md-color-danger);
}
</style>
