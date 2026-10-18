<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Card as PxCard,
  Message,
  Popconfirm as PxPopconfirm,
  Spin as PxSpin,
  Tag as PxTag,
} from '@pixelium/web-vue/es'
import {
  IconAngleLeft,
  IconLink,
  IconRefresh,
  IconShare,
  IconUpload,
} from '@pixelium/web-vue/icon-hn/es'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import MarkdownText from '@/components/MarkdownText.vue'
import { formatUnixSeconds } from '@/utils/date'
import { getErrorMessage } from '@/utils/error'

import GrantLinkDialog from '../components/GrantLinkDialog.vue'
import SnapshotDialog from '../components/SnapshotDialog.vue'
import { DOCUMENT_CONTENT_EMPTY_TEXT, DOCUMENT_SUMMARY_FALLBACK } from '../constants'
import { useDocumentStore } from '../stores/document'

/** 文档详情：展示元信息与当前正文（GET /doc/v1/document/content），并提供协作编辑入口 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const documentStore = useDocumentStore()
const grantVisible = ref(false)
const snapshotVisible = ref(false)

const content = computed(() => documentStore.content)
const hasContent = computed(() => (content.value?.content ?? '').length > 0)

onMounted(reload)

watch(() => props.id, reload)

/** 元信息与正文分别请求：正文失败不影响文档信息展示 */
function reload(): void {
  void documentStore.loadDetail(props.id)
  void documentStore.loadContent(props.id)
}

function reloadContent(): void {
  void documentStore.loadContent(props.id)
}

function backToList(): void {
  void router.push({ name: 'document-list' })
}

function enterEdit(): void {
  void router.push({ name: 'document-edit', params: { id: props.id } })
}

async function handleRemove(): Promise<void> {
  try {
    await documentStore.remove(props.id)
    Message.success('文档已删除')
    backToList()
  } catch (error) {
    Message.error(getErrorMessage(error, '删除文档失败'))
  }
}
</script>

<template>
  <section class="document-detail">
    <header class="document-detail__header">
      <PxButton variant="text" native-type="button" @click="backToList">
        <template #icon>
          <IconAngleLeft />
        </template>
        返回工作台
      </PxButton>

      <div class="document-detail__actions">
        <PxButton variant="outline" native-type="button" @click="snapshotVisible = true">
          <template #icon>
            <IconUpload />
          </template>
          发布快照
        </PxButton>
        <PxButton variant="outline" native-type="button" @click="grantVisible = true">
          <template #icon>
            <IconLink />
          </template>
          分享授权链接
        </PxButton>
        <PxButton
          variant="outline"
          native-type="button"
          :loading="documentStore.detailLoading || documentStore.contentLoading"
          @click="reload"
        >
          <template #icon>
            <IconRefresh />
          </template>
          刷新
        </PxButton>
        <PxPopconfirm
          content="删除后不可恢复，确定删除该文档？"
          ok-text="删除"
          cancel-text="取消"
          placement="bottom-end"
          @ok="handleRemove"
        >
          <PxButton theme="danger" variant="outline" native-type="button">删除</PxButton>
        </PxPopconfirm>
      </div>
    </header>

    <PxAlert v-if="documentStore.detailError" type="error" :title="documentStore.detailError">
      {{ documentStore.detailError }}
    </PxAlert>

    <PxSpin :loading="documentStore.detailLoading">
      <PxCard
        v-if="documentStore.detail"
        class="document-detail__card"
        shape="rect"
        :bordered="true"
        title="文档信息"
      >
        <div class="document-detail__title-row">
          <h1 class="document-detail__title">
            {{ documentStore.detail.summary.trim() || DOCUMENT_SUMMARY_FALLBACK }}
          </h1>
          <PxTag size="small" variant="outline" theme="info">ID {{ documentStore.detail.id }}</PxTag>
        </div>

        <dl class="document-detail__meta">
          <div class="document-detail__row">
            <dt class="document-detail__label">归属者</dt>
            <dd class="document-detail__value">{{ documentStore.detail.owner_id }}</dd>
          </div>
          <div class="document-detail__row">
            <dt class="document-detail__label">创建时间</dt>
            <dd class="document-detail__value">
              {{ formatUnixSeconds(documentStore.detail.create_at) }}
            </dd>
          </div>
          <div class="document-detail__row">
            <dt class="document-detail__label">更新时间</dt>
            <dd class="document-detail__value">
              {{ formatUnixSeconds(documentStore.detail.update_at) }}
            </dd>
          </div>
        </dl>
      </PxCard>
    </PxSpin>

    <PxCard class="document-detail__card" shape="rect" :bordered="true">
      <template #header>
        <div class="document-detail__card-header">
          <h2 class="document-detail__card-title">文档正文</h2>
          <div class="document-detail__card-tools">
            <PxTag v-if="content" size="small" variant="outline" theme="info">
              版本 v{{ content.version }}
            </PxTag>
            <PxButton variant="outline" size="small" native-type="button" @click="enterEdit">
              <template #icon>
                <IconShare />
              </template>
              进入协作编辑
            </PxButton>
          </div>
        </div>
      </template>

      <PxAlert
        v-if="documentStore.contentError"
        type="error"
        :title="documentStore.contentError"
      >
        <div class="document-detail__content-error">
          <PxButton size="small" native-type="button" @click="reloadContent">
            <template #icon>
              <IconRefresh />
            </template>
            重新加载
          </PxButton>
        </div>
      </PxAlert>

      <PxSpin v-else :loading="documentStore.contentLoading">
        <MarkdownText v-if="hasContent" :source="content?.content ?? ''" />
        <p v-else-if="content" class="document-detail__content-empty">
          {{ DOCUMENT_CONTENT_EMPTY_TEXT }}
        </p>
      </PxSpin>
    </PxCard>

    <GrantLinkDialog v-model:visible="grantVisible" :document-id="props.id" />
    <SnapshotDialog v-model:visible="snapshotVisible" :document-id="props.id" />
  </section>
</template>

<style scoped>
.document-detail {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
}

.document-detail__header {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
  justify-content: space-between;
}

.document-detail__actions {
  display: inline-flex;
  gap: var(--md-space-2);
}

.document-detail__card {
  margin-bottom: var(--md-space-4);
}

.document-detail__title-row {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}

.document-detail__title {
  margin: 0;
  font-size: var(--md-font-size-xl);
}

.document-detail__meta {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  margin: var(--md-space-4) 0 0;
}

.document-detail__row {
  display: flex;
  gap: var(--md-space-3);
  justify-content: space-between;
  font-size: var(--md-font-size-sm);
}

.document-detail__label {
  color: var(--md-color-text-secondary);
}

.document-detail__value {
  margin: 0;
}

.document-detail__card-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}

.document-detail__card-title {
  margin: 0;
  font-size: var(--md-font-size-lg);
}

.document-detail__card-tools {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
}

.document-detail__content-error {
  display: flex;
  justify-content: flex-end;
}

.document-detail__content-empty {
  margin: 0;
  padding: var(--md-space-6) 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  text-align: center;
}
</style>
