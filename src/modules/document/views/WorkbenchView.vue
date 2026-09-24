<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Empty as PxEmpty,
  Message,
  Pagination as PxPagination,
  Spin as PxSpin,
} from '@pixelium/web-vue/es'
import { IconPlus } from '@pixelium/web-vue/icon-hn/es'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { getErrorMessage } from '@/utils/error'

import DocumentCard from '../components/DocumentCard.vue'
import DocumentToolbar from '../components/DocumentToolbar.vue'
import { DOCUMENT_PAGE_SIZE_OPTIONS } from '../constants'
import { useDocumentStore } from '../stores/document'
import type { DocumentItem, DocumentSort } from '../types'

/** 工作台：查看并管理当前用户的全部文档 */
const router = useRouter()
const documentStore = useDocumentStore()

onMounted(() => {
  void documentStore.loadList(1)
})

function openDetail(document: DocumentItem): void {
  void router.push({ name: 'document-detail', params: { id: document.id } })
}

async function handleCreate(): Promise<void> {
  try {
    const id = await documentStore.create()
    Message.success('文档已创建')
    // 后端建议：创建成功后跳转到文档页
    void router.push({ name: 'document-detail', params: { id } })
  } catch (error) {
    Message.error(getErrorMessage(error, '创建文档失败'))
  }
}

async function handleRemove(document: DocumentItem): Promise<void> {
  try {
    await documentStore.remove(document.id)
    Message.success('文档已删除')
  } catch (error) {
    Message.error(getErrorMessage(error, '删除文档失败'))
  }
}

function handleKeyword(value: string): void {
  documentStore.setKeyword(value)
}

function handleSort(value: DocumentSort): void {
  documentStore.setSort(value)
}
</script>

<template>
  <section class="workbench">
    <header class="workbench__header">
      <div>
        <h1 class="workbench__title">工作台</h1>
        <p class="workbench__subtitle">这里汇总了你的全部文档，可新建、筛选或进入查看。</p>
      </div>
      <PxButton native-type="button" :loading="documentStore.creating" @click="handleCreate">
        <template #icon>
          <IconPlus />
        </template>
        新建文档
      </PxButton>
    </header>

    <DocumentToolbar
      :keyword="documentStore.keyword"
      :sort="documentStore.sort"
      :total="documentStore.total"
      :loading="documentStore.loading"
      :creating="documentStore.creating"
      @update:keyword="handleKeyword"
      @update:sort="handleSort"
      @refresh="documentStore.loadList()"
      @create="handleCreate"
    />

    <PxAlert v-if="documentStore.error" type="error" :title="documentStore.error">
      {{ documentStore.error }}
    </PxAlert>

    <PxSpin :loading="documentStore.loading && documentStore.filteredList.length === 0">
      <div v-if="documentStore.isEmpty" class="workbench__empty">
        <PxEmpty
          :description="
            documentStore.isFiltering ? '没有匹配的文档，换个关键词试试' : '还没有任何文档'
          "
        />
        <PxButton v-if="!documentStore.isFiltering" variant="outline" @click="handleCreate">
          创建第一篇文档
        </PxButton>
      </div>

      <ul v-else class="workbench__grid">
        <li v-for="doc in documentStore.filteredList" :key="doc.id" class="workbench__grid-item">
          <DocumentCard
            :document="doc"
            :removing="documentStore.removingId === doc.id"
            @open="openDetail(doc)"
            @remove="handleRemove(doc)"
          />
        </li>
      </ul>
    </PxSpin>

    <footer v-if="!documentStore.isEmpty" class="workbench__footer">
      <PxPagination
        :page="documentStore.page"
        :page-size="documentStore.pageSize"
        :total="documentStore.total"
        :page-size-options="DOCUMENT_PAGE_SIZE_OPTIONS"
        show-size
        show-total
        @update:page="documentStore.changePage"
        @update:page-size="documentStore.changePageSize"
      />
    </footer>
  </section>
</template>

<style scoped>
.workbench {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-5);
}

.workbench__header {
  display: flex;
  gap: var(--md-space-4);
  align-items: flex-end;
  justify-content: space-between;
}

.workbench__title {
  margin: 0;
  font-size: var(--md-font-size-2xl);
}

.workbench__subtitle {
  margin: var(--md-space-2) 0 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.workbench__empty {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
  align-items: center;
  padding: var(--md-space-10) 0;
}

.workbench__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--md-space-4);
}

.workbench__grid-item {
  display: flex;
}

.workbench__footer {
  display: flex;
  justify-content: flex-end;
}
</style>
