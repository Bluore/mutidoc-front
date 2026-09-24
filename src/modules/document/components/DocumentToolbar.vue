<script setup lang="ts">
import { Button as PxButton, Input as PxInput } from '@pixelium/web-vue/es'
import { IconPlus, IconRefresh, IconSearch } from '@pixelium/web-vue/icon-hn/es'

import { DOCUMENT_SORT_OPTIONS } from '../constants'
import type { DocumentSort } from '../types'

/** 工作台工具栏：筛选 / 排序 / 刷新 / 新建（纯展示 + 事件上抛） */
defineProps<{
  keyword: string
  sort: DocumentSort
  total: number
  loading?: boolean
  creating?: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:sort': [value: DocumentSort]
  refresh: []
  create: []
}>()
</script>

<template>
  <div class="document-toolbar">
    <PxInput
      class="document-toolbar__search"
      :model-value="keyword"
      placeholder="筛选当前页（标题或 ID）"
      clearable
      @update:model-value="(value: string) => emit('update:keyword', value)"
    >
      <template #prefix>
        <IconSearch />
      </template>
    </PxInput>

    <div class="document-toolbar__sort" role="group" aria-label="排序方式">
      <PxButton
        v-for="option in DOCUMENT_SORT_OPTIONS"
        :key="option.value"
        size="small"
        :variant="sort === option.value ? 'primary' : 'outline'"
        native-type="button"
        @click="emit('update:sort', option.value)"
      >
        {{ option.label }}
      </PxButton>
    </div>

    <span class="document-toolbar__count">共 {{ total }} 篇</span>

    <div class="document-toolbar__actions">
      <PxButton
        variant="outline"
        native-type="button"
        :loading="loading"
        @click="emit('refresh')"
      >
        <template #icon>
          <IconRefresh />
        </template>
        刷新
      </PxButton>
      <PxButton native-type="button" :loading="creating" @click="emit('create')">
        <template #icon>
          <IconPlus />
        </template>
        新建文档
      </PxButton>
    </div>
  </div>
</template>

<style scoped>
.document-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3);
  align-items: center;
}

.document-toolbar__search {
  width: 260px;
  max-width: 100%;
}

.document-toolbar__sort {
  display: inline-flex;
  gap: var(--md-space-1);
}

.document-toolbar__count {
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.document-toolbar__actions {
  display: inline-flex;
  gap: var(--md-space-2);
  margin-left: auto;
}

@media (max-width: 720px) {
  .document-toolbar__actions {
    margin-left: 0;
  }
}
</style>
