<script setup lang="ts">
import { computed } from 'vue'

import BaseButton from '@/components/BaseButton.vue'
import { formatDateTime } from '@/utils/date'

import { EXAMPLE_STATUS_LABEL } from '../constants'
import type { ExampleItem } from '../types'

const props = defineProps<{ item: ExampleItem }>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
}>()

const statusText = computed(() => EXAMPLE_STATUS_LABEL[props.item.status])
const createdAtText = computed(() => formatDateTime(props.item.createdAt))
</script>

<template>
  <article class="example-card">
    <header class="example-card__header">
      <h3 class="example-card__title">{{ item.title }}</h3>
      <span class="example-card__status" :class="`example-card__status--${item.status}`">
        {{ statusText }}
      </span>
    </header>

    <p class="example-card__desc">{{ item.description }}</p>

    <footer class="example-card__footer">
      <time class="example-card__time">{{ createdAtText }}</time>
      <div class="example-card__actions">
        <BaseButton size="sm" @click="emit('select', item.id)">查看</BaseButton>
        <BaseButton size="sm" variant="danger" @click="emit('remove', item.id)">删除</BaseButton>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.example-card {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  padding: var(--md-space-4);
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-lg);
  transition:
    box-shadow var(--md-transition-fast),
    border-color var(--md-transition-fast);
}

.example-card:hover {
  border-color: var(--md-color-border-strong);
  box-shadow: var(--md-shadow-sm);
}

.example-card__header {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}

.example-card__title {
  font-size: var(--md-font-size-lg);
  font-weight: 600;
}

.example-card__status {
  flex-shrink: 0;
  padding: var(--md-space-1) var(--md-space-2);
  font-size: var(--md-font-size-xs);
  border-radius: var(--md-radius-full);
}

.example-card__status--draft {
  color: var(--md-color-text-secondary);
  background-color: var(--md-color-surface-hover);
}

.example-card__status--published {
  color: var(--md-color-success);
  background-color: var(--md-color-primary-soft);
}

.example-card__status--archived {
  color: var(--md-color-warning);
  background-color: rgba(245, 158, 11, 0.12);
}

.example-card__desc {
  color: var(--md-color-text-secondary);
}

.example-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--md-space-1);
}

.example-card__time {
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-disabled);
}

.example-card__actions {
  display: flex;
  gap: var(--md-space-2);
}
</style>
