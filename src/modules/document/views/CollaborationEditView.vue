<script setup lang="ts">
import { Alert as PxAlert, Button as PxButton, Message, Tag as PxTag } from '@pixelium/web-vue/es'
import { IconAngleLeft } from '@pixelium/web-vue/icon-hn/es'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useUserStore } from '@/modules/user'

import CollaborationPanel from '../components/CollaborationPanel.vue'
import DocumentEditor from '../components/DocumentEditor.vue'
import {
  COLLABORATION_FILE_EXTENSION,
  COLLABORATION_STATUS_META,
  DOCUMENT_SUMMARY_FALLBACK,
} from '../constants'
import { useCollaborationStore } from '../stores/collaboration'
import { useDocumentStore } from '../stores/document'

/**
 * 协作编辑页：左侧纯文本编辑器，右侧操作面板。
 * 页面负责编排「加载元信息 / 建连 / 断开」与事件转发，不直接接触 OT 协议或 socket。
 */
const props = defineProps<{ id: string }>()

const router = useRouter()
const documentStore = useDocumentStore()
const collaboration = useCollaborationStore()
const userStore = useUserStore()

const statusMeta = computed(() => COLLABORATION_STATUS_META[collaboration.status])
const title = computed(
  () => documentStore.detail?.summary.trim() || DOCUMENT_SUMMARY_FALLBACK,
)
const fileName = computed(() => `document-${props.id}${COLLABORATION_FILE_EXTENSION}`)
const disconnected = computed(
  () => collaboration.status === 'closed' || collaboration.status === 'error',
)

onMounted(() => {
  void documentStore.loadDetail(props.id)
  void userStore.ensureLoaded()
  collaboration.connect(props.id)
})

onBeforeUnmount(() => {
  collaboration.disconnect()
})

/** 返回详情页（同时断开协作连接） */
function backToDetail(): void {
  collaboration.disconnect()
  void router.push({ name: 'document-detail', params: { id: props.id } })
}

function handleExit(): void {
  Message.success('已退出协作编辑')
  backToDetail()
}
</script>

<template>
  <section class="collab-edit">
    <header class="collab-edit__header">
      <PxButton variant="text" native-type="button" @click="backToDetail">
        <template #icon>
          <IconAngleLeft />
        </template>
        返回文档详情
      </PxButton>

      <div class="collab-edit__heading">
        <h1 class="collab-edit__title">{{ title }}</h1>
        <PxTag :theme="statusMeta.theme" variant="outline" size="small">
          {{ statusMeta.label }}
        </PxTag>
      </div>

      <span class="collab-edit__hint">纯文本 · 实时协作</span>
    </header>

    <PxAlert
      v-if="disconnected"
      type="warning"
      title="协作连接不可用"
    >
      当前为只读状态，正文可能不是最新的，可在右侧面板「重新连接」。
    </PxAlert>

    <div class="collab-edit__body">
      <DocumentEditor
        class="collab-edit__editor"
        :model-value="collaboration.content"
        :disabled="!collaboration.canEdit"
        :file-name="fileName"
        @update:model-value="collaboration.setContent"
      />

      <CollaborationPanel
        :document="documentStore.detail"
        :status="collaboration.status"
        :revision="collaboration.revision"
        :users="collaboration.users"
        :self-user-id="collaboration.selfUserId"
        :desynced="collaboration.desynced"
        :error="collaboration.error"
        :logs="collaboration.logs"
        :self-name="userStore.displayName"
        :self-email="userStore.profile?.email ?? ''"
        :self-avatar="userStore.profile?.avatar ?? ''"
        @reconnect="collaboration.reconnect"
        @exit="handleExit"
      />
    </div>
  </section>
</template>

<style scoped>
.collab-edit {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
}

.collab-edit__header {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
}

.collab-edit__heading {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  min-width: 0;
}

.collab-edit__title {
  margin: 0;
  overflow: hidden;
  font-size: var(--md-font-size-xl);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collab-edit__hint {
  margin-left: auto;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.collab-edit__body {
  display: flex;
  gap: var(--md-space-4);
  align-items: flex-start;
}

.collab-edit__editor {
  flex: 1;
  min-width: 0;
}

@media (max-width: 900px) {
  .collab-edit__body {
    flex-direction: column;
  }

  .collab-edit__editor {
    width: 100%;
  }
}
</style>
