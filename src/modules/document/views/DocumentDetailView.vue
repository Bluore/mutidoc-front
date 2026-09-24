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
import { IconAngleLeft, IconRefresh, IconShare } from '@pixelium/web-vue/icon-hn/es'
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getErrorMessage } from '@/utils/error'
import { formatUnixSeconds } from '@/utils/date'

import { DOCUMENT_SUMMARY_FALLBACK } from '../constants'
import { useDocumentStore } from '../stores/document'

/** 文档详情：展示元信息，并说明协作编辑（WebSocket）的当前状态 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const documentStore = useDocumentStore()

const editLimitations = [
  '浏览器无法为 WebSocket 设置 Authorization 头，后端暂未提供票据 / 查询参数方案。',
  '文档正文保存在服务端进程内存中，重启即丢失，且不能多副本水平扩展。',
  '协作身份取自客户端首帧上报的 user_id，后端尚未与 JWT 校验。',
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
        <PxAlert type="warning" title="当前暂不可用">
          浏览器直连 WebSocket 会被后端鉴权拦截，需后端补充票据 / 查询参数方案后再接入 OT 协作。
        </PxAlert>

        <ul class="document-detail__list">
          <li v-for="item in editLimitations" :key="item" class="document-detail__list-item">
            {{ item }}
          </li>
        </ul>

        <PxDivider :margin="16" />

        <div class="document-detail__editor-placeholder">
          <p class="document-detail__editor-hint">
            正文不通过 REST 接口返回，仅在 WebSocket 协作连接中下发（后端初始内容为
            <code>helloworld</code>）。
          </p>
          <PxButton native-type="button" disabled>
            <template #icon>
              <IconShare />
            </template>
            进入协作编辑（暂未开放）
          </PxButton>
        </div>
      </PxCard>
    </PxSpin>
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

.document-detail__editor-hint code {
  padding: 0 var(--md-space-1);
  font-family: var(--md-font-mono);
  color: var(--md-color-text);
  background-color: var(--md-color-bg);
}
</style>
