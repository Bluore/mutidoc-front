<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Dialog as PxDialog,
  Input as PxInput,
  Message,
  Spin as PxSpin,
} from '@pixelium/web-vue/es'
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconRefresh,
  IconUpload,
} from '@pixelium/web-vue/icon-hn/es'
import { computed, onBeforeUnmount, ref } from 'vue'

import { copyText } from '@/utils/clipboard'

import { DOCUMENT_SNAPSHOT_LINK_DAYS } from '../constants'
import { useDocumentStore } from '../stores/document'

/**
 * 发布快照弹窗：点击「发布快照」才会真正发布（不自动发布，避免误开弹窗产生无用快照）。
 * 每次发布都会生成新的快照与短链；发布后再编辑原文档不会影响已发布内容。
 */
const props = defineProps<{
  documentId: string
  visible: boolean
}>()

const emit = defineEmits<{ 'update:visible': [value: boolean] }>()

const documentStore = useDocumentStore()

/** 复制成功后的短暂反馈 */
const copied = ref(false)
let copiedTimer: ReturnType<typeof window.setTimeout> | undefined

const show = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

async function handlePublish(): Promise<void> {
  try {
    await documentStore.publishSnapshot(props.documentId)
    Message.success('快照已发布')
  } catch {
    // 失败原因由 snapshotError 内联展示，这里不再重复提示
  }
}

async function handleCopy(): Promise<void> {
  const link = documentStore.snapshot?.short_link
  if (!link) return

  if (!(await copyText(link))) {
    Message.error('复制失败，请手动选择链接复制')
    return
  }

  copied.value = true
  Message.success('快照短链已复制')
  if (copiedTimer) window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => {
    copied.value = false
  }, 2000)
}

/** 用短链打开快照公开页（短链会由 link 服务 302 到 `/public_documents/:id`） */
function openSnapshot(): void {
  const link = documentStore.snapshot?.short_link
  if (!link) return
  window.open(link, '_blank', 'noopener,noreferrer')
}

/** 关闭后清空结果与复制态，避免下次打开闪现旧链接 */
function handleAfterClose(): void {
  documentStore.resetSnapshot()
  copied.value = false
}

onBeforeUnmount(() => {
  if (copiedTimer) window.clearTimeout(copiedTimer)
  // 页面切换导致组件卸载时，丢弃未展示完的发布结果，避免下次进入闪现旧链接
  documentStore.resetSnapshot()
})
</script>

<template>
  <PxDialog
    v-model:visible="show"
    title="发布文档快照"
    :show-cancel="false"
    ok-text="关闭"
    @after-close="handleAfterClose"
  >
    <div class="snapshot-dialog">
      <p class="snapshot-dialog__hint">
        发布后会把文档<strong>当前内容</strong>冻结成一份只读快照，并生成一条
        {{ DOCUMENT_SNAPSHOT_LINK_DAYS }}
        天有效的分享短链。之后继续编辑原文档不会影响已发布的快照；每次发布都会生成新的快照与链接。
      </p>

      <PxSpin :loading="documentStore.snapshotPublishing">
        <PxAlert
          v-if="documentStore.snapshotError"
          class="snapshot-dialog__error"
          type="error"
          :title="documentStore.snapshotError"
        >
          <div class="snapshot-dialog__error-body">
            <span>{{ documentStore.snapshotError }}</span>
            <PxButton size="small" native-type="button" @click="handlePublish">
              <template #icon>
                <IconRefresh />
              </template>
              重试
            </PxButton>
          </div>
        </PxAlert>

        <div v-else-if="documentStore.snapshot" class="snapshot-dialog__result">
          <div class="snapshot-dialog__row">
            <PxInput :model-value="documentStore.snapshot.short_link" readonly />
            <PxButton native-type="button" @click="handleCopy">
              <template #icon>
                <IconCheck v-if="copied" />
                <IconCopy v-else />
              </template>
              {{ copied ? '已复制' : '复制' }}
            </PxButton>
          </div>

          <div class="snapshot-dialog__result-foot">
            <span class="snapshot-dialog__meta">
              快照 ID：{{ documentStore.snapshot.snapshot_id }}
            </span>
            <PxButton variant="outline" size="small" native-type="button" @click="openSnapshot">
              <template #icon>
                <IconExternalLink />
              </template>
              预览快照
            </PxButton>
          </div>
        </div>

        <div v-else class="snapshot-dialog__actions">
          <PxButton
            native-type="button"
            :loading="documentStore.snapshotPublishing"
            @click="handlePublish"
          >
            <template #icon>
              <IconUpload />
            </template>
            立即发布
          </PxButton>
        </div>
      </PxSpin>
    </div>
  </PxDialog>
</template>

<style scoped>
.snapshot-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  min-width: 320px;
  max-width: 100%;
}

.snapshot-dialog__hint {
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.snapshot-dialog__row {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
}

.snapshot-dialog__result {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
}

.snapshot-dialog__result-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}

.snapshot-dialog__meta {
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
  word-break: break-all;
}

.snapshot-dialog__error-body {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}

.snapshot-dialog__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
