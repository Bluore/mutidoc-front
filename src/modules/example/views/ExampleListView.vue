<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/BaseButton.vue'
import { useDebounceFn } from '@/composables/useDebounceFn'

import ExampleCard from '../components/ExampleCard.vue'
import { EXAMPLE_STATUS_OPTIONS } from '../constants'
import { useExampleStore } from '../stores/example'
import type { ExampleCreatePayload, ExampleStatus } from '../types'

const router = useRouter()
const store = useExampleStore()

const keyword = ref('')
const statusFilter = ref<ExampleStatus | ''>('')
const form = reactive<ExampleCreatePayload>({ title: '', description: '', status: 'draft' })
const formError = ref('')

const { run: search } = useDebounceFn(() => {
  store.setKeyword(keyword.value)
  void store.loadList()
})

function handleKeywordInput() {
  search()
}

function handleStatusChange() {
  store.setStatus(statusFilter.value)
  void store.loadList()
}

function handlePage(page: number) {
  if (page < 1 || page > store.totalPages) return
  store.setPage(page)
  void store.loadList()
}

function goDetail(id: string) {
  void router.push({ name: 'example-detail', params: { id } })
}

async function handleRemove(id: string) {
  await store.remove(id)
}

async function handleCreate() {
  if (!form.title.trim()) {
    formError.value = '标题不能为空'
    return
  }
  formError.value = ''
  const created = await store.add({ ...form, title: form.title.trim() })
  if (created) {
    form.title = ''
    form.description = ''
    form.status = 'draft'
  }
}

onMounted(() => {
  void store.loadList()
})
</script>

<template>
  <section class="example-list">
    <header class="example-list__header">
      <h1 class="example-list__title">示例模块</h1>
      <p class="example-list__subtitle">
        本模块是新增业务模块的参考模板：api / stores / components / views / routes 全部自包含。
      </p>
    </header>

    <form class="example-list__form" @submit.prevent="handleCreate">
      <input
        v-model="form.title"
        class="example-list__input"
        type="text"
        placeholder="标题"
        aria-label="标题"
      />
      <input
        v-model="form.description"
        class="example-list__input example-list__input--wide"
        type="text"
        placeholder="描述"
        aria-label="描述"
      />
      <select v-model="form.status" class="example-list__select" aria-label="状态">
        <option v-for="option in EXAMPLE_STATUS_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <BaseButton type="submit" variant="primary" :loading="store.submitting">新建</BaseButton>
    </form>
    <p v-if="formError" class="example-list__error">{{ formError }}</p>

    <div class="example-list__toolbar">
      <input
        v-model="keyword"
        class="example-list__input example-list__input--wide"
        type="search"
        placeholder="搜索标题或描述"
        aria-label="搜索"
        @input="handleKeywordInput"
      />
      <select
        v-model="statusFilter"
        class="example-list__select"
        aria-label="状态筛选"
        @change="handleStatusChange"
      >
        <option value="">全部状态</option>
        <option v-for="option in EXAMPLE_STATUS_OPTIONS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <p v-if="store.error" class="example-list__error">{{ store.error }}</p>

    <p v-if="store.loading" class="example-list__hint">加载中…</p>
    <p v-else-if="store.isEmpty" class="example-list__hint">暂无数据</p>
    <div v-else class="example-list__items">
      <ExampleCard
        v-for="item in store.list"
        :key="item.id"
        :item="item"
        @select="goDetail"
        @remove="handleRemove"
      />
    </div>

    <div class="example-list__pagination">
      <BaseButton
        size="sm"
        :disabled="store.query.page <= 1"
        @click="handlePage(store.query.page - 1)"
      >
        上一页
      </BaseButton>
      <span class="example-list__page">
        第 {{ store.query.page }} / {{ store.totalPages }} 页 · 共 {{ store.total }} 条
      </span>
      <BaseButton
        size="sm"
        :disabled="store.query.page >= store.totalPages"
        @click="handlePage(store.query.page + 1)"
      >
        下一页
      </BaseButton>
    </div>
  </section>
</template>

<style scoped>
.example-list {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-5);
}

.example-list__title {
  font-size: var(--md-font-size-2xl);
  font-weight: 700;
}

.example-list__subtitle {
  margin-top: var(--md-space-2);
  color: var(--md-color-text-secondary);
}

.example-list__form,
.example-list__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3);
  align-items: center;
  padding: var(--md-space-4);
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-lg);
}

.example-list__input,
.example-list__select {
  height: 36px;
  padding: 0 var(--md-space-3);
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border-strong);
  border-radius: var(--md-radius-md);
  transition: border-color var(--md-transition-fast);
}

.example-list__input:focus,
.example-list__select:focus {
  outline: none;
  border-color: var(--md-color-primary);
}

.example-list__input--wide {
  flex: 1;
  min-width: 180px;
}

.example-list__items {
  display: grid;
  gap: var(--md-space-4);
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.example-list__hint {
  padding: var(--md-space-6);
  color: var(--md-color-text-secondary);
  text-align: center;
}

.example-list__error {
  color: var(--md-color-danger);
}

.example-list__pagination {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
  justify-content: center;
}

.example-list__page {
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}
</style>
