import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getErrorMessage } from '@/utils/error'

import {
  createDocument as createDocumentApi,
  deleteDocument as deleteDocumentApi,
  fetchDocumentInfo as fetchDocumentInfoApi,
  fetchDocumentList,
  fetchGrantLink as fetchGrantLinkApi,
} from '../api/document'
import { DOCUMENT_PAGE_SIZE } from '../constants'
import type { DocumentItem, DocumentSort } from '../types'

/**
 * 文档 store：管理列表、分页、筛选与排序。
 * 删除 / 创建失败会向上抛出，由视图决定提示方式。
 */
export const useDocumentStore = defineStore('document', () => {
  // state
  const list = ref<DocumentItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(DOCUMENT_PAGE_SIZE)
  const keyword = ref('')
  const sort = ref<DocumentSort>('create')
  const loading = ref(false)
  const creating = ref(false)
  const removingId = ref<string | null>(null)
  const error = ref<string | null>(null)
  const detail = ref<DocumentItem | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<string | null>(null)
  /** 当前生成/复用的授权链接；未请求或失败时为 null */
  const grantLink = ref<string | null>(null)
  const grantLinkLoading = ref(false)
  const grantLinkError = ref<string | null>(null)

  // getters
  /** 当前页数据的前端筛选 + 排序 */
  const filteredList = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    const matched = kw
      ? list.value.filter(
          (doc) => doc.summary.toLowerCase().includes(kw) || doc.id.toLowerCase().includes(kw),
        )
      : list.value

    return [...matched].sort((a, b) =>
      sort.value === 'update' ? b.update_at - a.update_at : b.create_at - a.create_at,
    )
  })

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const isEmpty = computed(() => !loading.value && filteredList.value.length === 0)
  const isFiltering = computed(() => keyword.value.trim().length > 0)

  // actions
  async function loadList(targetPage = page.value): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const result = await fetchDocumentList(targetPage, pageSize.value)
      list.value = result.list
      total.value = result.total
      page.value = result.page
    } catch (e) {
      error.value = getErrorMessage(e, '文档列表加载失败')
      list.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  async function create(): Promise<string> {
    creating.value = true
    try {
      const id = await createDocumentApi()
      // 回到第一页，确保新建的文档可见（后端按创建时间倒序）
      await loadList(1)
      return id
    } finally {
      creating.value = false
    }
  }

  async function remove(documentId: string): Promise<void> {
    removingId.value = documentId
    try {
      await deleteDocumentApi(documentId)
      // 删除当前页最后一条时回退一页
      const targetPage = list.value.length === 1 && page.value > 1 ? page.value - 1 : page.value
      await loadList(targetPage)
    } finally {
      removingId.value = null
    }
  }

  function setKeyword(value: string): void {
    keyword.value = value
  }

  function setSort(value: DocumentSort): void {
    sort.value = value
  }

  async function loadDetail(documentId: string): Promise<void> {
    detailLoading.value = true
    detailError.value = null
    detail.value = null
    try {
      detail.value = await fetchDocumentInfoApi(documentId)
    } catch (e) {
      detailError.value = getErrorMessage(e, '文档信息加载失败')
    } finally {
      detailLoading.value = false
    }
  }

  async function generateGrantLink(documentId: string): Promise<string> {
    grantLinkLoading.value = true
    grantLinkError.value = null
    grantLink.value = null
    try {
      grantLink.value = await fetchGrantLinkApi(documentId)
      return grantLink.value
    } catch (e) {
      grantLinkError.value = getErrorMessage(e, '授权链接生成失败')
      throw e
    } finally {
      grantLinkLoading.value = false
    }
  }

  /** 关闭分享弹窗时清空上一次的结果，避免下次打开闪现旧链接 */
  function resetGrantLink(): void {
    grantLink.value = null
    grantLinkError.value = null
  }

  async function changePage(targetPage: number): Promise<void> {
    await loadList(targetPage)
  }

  async function changePageSize(size: number): Promise<void> {
    pageSize.value = size
    await loadList(1)
  }

  return {
    list,
    total,
    page,
    pageSize,
    keyword,
    sort,
    loading,
    creating,
    removingId,
    error,
    detail,
    detailLoading,
    detailError,
    grantLink,
    grantLinkLoading,
    grantLinkError,
    filteredList,
    totalPages,
    isEmpty,
    isFiltering,
    loadList,
    create,
    remove,
    setKeyword,
    setSort,
    loadDetail,
    generateGrantLink,
    resetGrantLink,
    changePage,
    changePageSize,
  }
})
