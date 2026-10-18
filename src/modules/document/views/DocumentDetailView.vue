<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Card as PxCard,
  Divider as PxDivider,
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
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getErrorMessage } from '@/utils/error'
import { formatUnixSeconds } from '@/utils/date'

import GrantLinkDialog from '../components/GrantLinkDialog.vue'
import SnapshotDialog from '../components/SnapshotDialog.vue'
import { DOCUMENT_SUMMARY_FALLBACK } from '../constants'
import { useDocumentStore } from '../stores/document'

/** 文档详情：展示元信息，并说明协作编辑（WebSocket）的当前状态 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const documentStore = useDocumentStore()
const grantVisible = ref(false)
const snapshotVisible = ref(false)

const editNotes = [
  '浏览器无法为 WebSocket 设置 Authorization 头，因此按后端约定把 token 放进首帧 init 消息完成鉴权。',
  '正文不通过 REST 返回，进入编辑页后由 WebSocket 的 init 消息下发，并以 OT 算子实时同步。',
  '后端当前把正文保存在进程内存中，重启即丢失，且暂不支持多副本水平扩展。',
] as const

onMounted(() => {
  void documentStore.loadDetail(props.id)
})

watch(
  () => props.id,
  (id) => {
    void documentStore.loadDetail(id)
  },
)

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
          :loading="documentStore.detailLoading"
          @click="documentStore.loadDetail(props.id)"
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

      <PxCard class="document-detail__card" shape="rect" :bordered="true" title="协作编辑">
        <ul class="document-detail__list">
          <li v-for="item in editNotes" :key="item" class="document-detail__list-item">
            {{ item }}
          </li>
        </ul>

        <PxDivider :margin="16" />

        <div class="document-detail__editor-placeholder">
          <p class="document-detail__editor-hint">
            进入后左侧为纯文本编辑器，右侧为操作面板（在线编辑人、连接状态、退出编辑等）。
          </p>
          <PxButton native-type="button" @click="enterEdit">
            <template #icon>
              <IconShare />
            </template>
            进入协作编辑
          </PxButton>
        </div>
      </PxCard>
    </PxSpin>

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

.document-detail__list {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  margin: var(--md-space-4) 0 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.document-detail__list-item {
  padding-left: var(--md-space-4);
  list-style: disc;
}

.document-detail__editor-placeholder {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  align-items: flex-start;
}

.document-detail__editor-hint {
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}
</style>
