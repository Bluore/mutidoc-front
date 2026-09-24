import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

import { createExample, deleteExample, fetchExampleDetail, fetchExampleList } from '../api/example'
import type { ExampleCreatePayload, ExampleItem, ExampleQuery, ExampleStatus } from '../types'

const DEFAULT_QUERY: ExampleQuery = {
  page: 1,
  pageSize: 5,
  keyword: '',
  status: '',
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/**
 * 模块级 store：管理列表、详情、查询条件与加载状态。
 * 视图层只调用 action，不直接碰 API。
 */
export const useExampleStore = defineStore('example', () => {
  // state
  const list = ref<ExampleItem[]>([])
  const total = ref(0)
  const detail = ref<ExampleItem | null>(null)
  const loading = ref(false)
  const submitting = ref(false)
  const error = ref<string | null>(null)
  const query = reactive<ExampleQuery>({ ...DEFAULT_QUERY })

  // getters
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / query.pageSize)))
  const isEmpty = computed(() => !loading.value && list.value.length === 0)

  // actions
  async function loadList(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await fetchExampleList({ ...query })
      list.value = result.list
      total.value = result.total
    } catch (e) {
      error.value = toMessage(e, '列表加载失败')
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(id: string): Promise<void> {
    loading.value = true
    error.value = null
    detail.value = null
    try {
      detail.value = await fetchExampleDetail(id)
    } catch (e) {
      error.value = toMessage(e, '详情加载失败')
    } finally {
      loading.value = false
    }
  }

  async function add(payload: ExampleCreatePayload): Promise<ExampleItem | null> {
    submitting.value = true
    error.value = null
    try {
      const item = await createExample(payload)
      await loadList()
      return item
    } catch (e) {
      error.value = toMessage(e, '创建失败')
      return null
    } finally {
      submitting.value = false
    }
  }

  async function remove(id: string): Promise<boolean> {
    error.value = null
    try {
      await deleteExample(id)
      if (detail.value?.id === id) detail.value = null
      await loadList()
      return true
    } catch (e) {
      error.value = toMessage(e, '删除失败')
      return false
    }
  }

  function setKeyword(keyword: string): void {
    query.keyword = keyword
    query.page = 1
  }

  function setStatus(status: ExampleStatus | ''): void {
    query.status = status
    query.page = 1
  }

  function setPage(page: number): void {
    query.page = page
  }

  function resetQuery(): void {
    Object.assign(query, DEFAULT_QUERY)
  }

  return {
    // state
    list,
    total,
    detail,
    loading,
    submitting,
    error,
    query,
    // getters
    totalPages,
    isEmpty,
    // actions
    loadList,
    loadDetail,
    add,
    remove,
    setKeyword,
    setStatus,
    setPage,
    resetQuery,
  }
})
