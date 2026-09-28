<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Dialog as PxDialog,
  Input as PxInput,
  Message,
  Spin as PxSpin,
} from '@pixelium/web-vue/es'
import { IconCheck, IconCopy, IconRefresh } from '@pixelium/web-vue/icon-hn/es'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { copyText } from '@/utils/clipboard'

import { useDocumentStore } from '../stores/document'

/**
 * 授权链接分享弹窗：打开时向归属者生成（或复用）一条授权链接。
 * 仅负责展示与复制，权限授予发生在被授权用户打开链接时。
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

async function loadLink(): Promise<void> {
  try {
    await documentStore.generateGrantLink(props.documentId)
  } catch {
    // 失败原因由 grantLinkError 内联展示，这里不再重复提示
  }
}

watch(
  () => [props.visible, props.documentId] as const,
  ([visible]) => {
    if (visible) void loadLink()
  },
  { immediate: true },
)

async function handleCopy(): Promise<void> {
  const link = documentStore.grantLink
  if (!link) return

  if (!(await copyText(link))) {
    Message.error('复制失败，请手动选择链接复制')
    return
  }

  copied.value = true
  Message.success('授权链接已复制')
  if (copiedTimer) window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => {
    copied.value = false
  }, 2000)
}

/** 关闭后清空结果与复制态，避免下次打开闪现旧内容 */
function handleAfterClose(): void {
  documentStore.resetGrantLink()
  copied.value = false
}

onBeforeUnmount(() => {
  if (copiedTimer) window.clearTimeout(copiedTimer)
})
</script>

<template>
  <PxDialog
    v-model:visible="show"
    title="分享授权链接"
    :show-cancel="false"
    ok-text="完成"
    @after-close="handleAfterClose"
  >
    <div class="grant-link">
      <p class="grant-link__hint">
        把链接分享给协作成员，对方登录后打开即自动获得该文档的编辑权限。链接有效期为 7
        天，重复获取会复用同一条链接。
      </p>

      <PxSpin :loading="documentStore.grantLinkLoading">
        <PxAlert
          v-if="documentStore.grantLinkError"
          class="grant-link__error"
          type="error"
          :title="documentStore.grantLinkError"
        >
          <div class="grant-link__error-body">
            <span>{{ documentStore.grantLinkError }}</span>
            <PxButton size="small" native-type="button" @click="loadLink">
              <template #icon>
                <IconRefresh />
              </template>
              重试
            </PxButton>
          </div>
        </PxAlert>

        <div v-else-if="documentStore.grantLink" class="grant-link__row">
          <PxInput :model-value="documentStore.grantLink" readonly />
          <PxButton native-type="button" @click="handleCopy">
            <template #icon>
              <IconCheck v-if="copied" />
              <IconCopy v-else />
            </template>
            {{ copied ? '已复制' : '复制' }}
          </PxButton>
        </div>
      </PxSpin>
    </div>
  </PxDialog>
</template>

<style scoped>
.grant-link {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  min-width: 320px;
}

.grant-link__hint {
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.grant-link__row {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
}

.grant-link__error-body {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: space-between;
}
</style>
