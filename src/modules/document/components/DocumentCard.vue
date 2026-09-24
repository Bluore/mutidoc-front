<script setup lang="ts">
import { Button as PxButton, Card as PxCard, Popconfirm as PxPopconfirm } from '@pixelium/web-vue/es'
import { IconFileImport } from '@pixelium/web-vue/icon-hn/es'
import { computed } from 'vue'

import { formatUnixSeconds } from '@/utils/date'

import { DOCUMENT_SUMMARY_FALLBACK } from '../constants'
import type { DocumentItem } from '../types'

/** 文档卡片（纯展示 + 事件上抛） */
const props = defineProps<{
  document: DocumentItem
  removing?: boolean
}>()

const emit = defineEmits<{ open: []; remove: [] }>()

const title = computed(() => props.document.summary.trim() || DOCUMENT_SUMMARY_FALLBACK)
</script>

<template>
  <PxCard class="document-card" shape="rect" :bordered="true">
    <template #header>
      <div class="document-card__header">
        <span class="document-card__icon"><IconFileImport /></span>
        <button class="document-card__title" type="button" :title="title" @click="emit('open')">
          {{ title }}
        </button>
      </div>
    </template>

    <dl class="document-card__meta">
      <div class="document-card__row">
        <dt class="document-card__label">文档 ID</dt>
        <dd class="document-card__value">{{ document.id }}</dd>
      </div>
      <div class="document-card__row">
        <dt class="document-card__label">创建时间</dt>
        <dd class="document-card__value">{{ formatUnixSeconds(document.create_at) }}</dd>
      </div>
      <div class="document-card__row">
        <dt class="document-card__label">更新时间</dt>
        <dd class="document-card__value">{{ formatUnixSeconds(document.update_at) }}</dd>
      </div>
    </dl>

    <template #footer>
      <div class="document-card__footer">
        <PxButton variant="text" size="small" native-type="button" @click="emit('open')">
          打开
        </PxButton>
        <PxPopconfirm
          content="删除后不可恢复，确定删除该文档？"
          ok-text="删除"
          cancel-text="取消"
          placement="top-end"
          @ok="emit('remove')"
        >
          <PxButton
            theme="danger"
            variant="text"
            size="small"
            native-type="button"
            :loading="removing"
            @click.stop
          >
            删除
          </PxButton>
        </PxPopconfirm>
      </div>
    </template>
  </PxCard>
</template>

<style scoped>
.document-card {
  height: 100%;
}

.document-card__header {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  min-width: 0;
}

.document-card__icon {
  display: inline-flex;
  flex: none;
  font-size: 18px;
  color: var(--md-color-primary);
}

.document-card__title {
  overflow: hidden;
  font-size: var(--md-font-size-md);
  font-weight: 600;
  color: var(--md-color-text);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-card__title:hover {
  color: var(--md-color-primary);
}

.document-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  margin: 0;
}

.document-card__row {
  display: flex;
  gap: var(--md-space-3);
  justify-content: space-between;
  font-size: var(--md-font-size-sm);
}

.document-card__label {
  flex: none;
  color: var(--md-color-text-secondary);
}

.document-card__value {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-card__footer {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  justify-content: space-between;
}
</style>
