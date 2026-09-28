<script setup lang="ts">
import { Button as PxButton, Input as PxInput } from '@pixelium/web-vue/es'
import { IconCheck, IconEdit, IconX } from '@pixelium/web-vue/icon-hn/es'
import { computed, nextTick, ref, watch } from 'vue'

/**
 * 文档标题的展示与编辑（纯展示 + 事件上抛）。
 *
 * 标题不参与 OT：本组件只负责收集新标题并 `submit`，真正上送由父级调用
 * `collaboration.setTitle`；本地展示值等服务端 `set_title` 广播回来后再更新，
 * 以保证所有客户端（含设置者自己）收敛到同一标题。
 */
const props = defineProps<{
  /** 服务端维护的协作标题，从未设置过时为空串 */
  title: string
  /** 标题为空时展示的兜底文案（如 REST 的 summary） */
  fallback?: string
  /** 连接未就绪时禁止编辑 */
  disabled?: boolean
}>()

const emit = defineEmits<{ submit: [value: string] }>()

const editing = ref(false)
const draft = ref('')
const inputRef = ref<{ focus: () => void } | null>(null)

const displayTitle = computed(
  () => props.title.trim() || (props.fallback ?? '').trim() || '未命名文档',
)

// 服务端标题变化（含其他协作者修改）时同步草稿；正在编辑时不打断输入。
watch(
  () => props.title,
  (next) => {
    if (!editing.value) draft.value = next
  },
)

function startEdit(): void {
  if (props.disabled) return
  draft.value = props.title
  editing.value = true
  void nextTick(() => inputRef.value?.focus())
}

function cancelEdit(): void {
  editing.value = false
}

function confirmEdit(): void {
  const value = draft.value.trim()
  editing.value = false
  if (value === props.title.trim()) return
  emit('submit', value)
}
</script>

<template>
  <div class="document-title-field">
    <template v-if="editing">
      <PxInput
        ref="inputRef"
        v-model="draft"
        class="document-title-field__input"
        size="small"
        :placeholder="fallback || '未命名文档'"
        @keyup.enter="confirmEdit"
        @keyup.esc="cancelEdit"
      />
      <PxButton
        class="document-title-field__action"
        size="small"
        variant="outline"
        native-type="button"
        @click="confirmEdit"
      >
        <template #icon>
          <IconCheck />
        </template>
        保存
      </PxButton>
      <PxButton
        class="document-title-field__action"
        size="small"
        variant="text"
        native-type="button"
        @click="cancelEdit"
      >
        <template #icon>
          <IconX />
        </template>
        取消
      </PxButton>
    </template>

    <template v-else>
      <span class="document-title-field__text">{{ displayTitle }}</span>
      <PxButton
        class="document-title-field__edit"
        size="small"
        variant="text"
        native-type="button"
        :disabled="disabled"
        @click="startEdit"
      >
        <template #icon>
          <IconEdit />
        </template>
        修改标题
      </PxButton>
    </template>
  </div>
</template>

<style scoped>
.document-title-field {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  margin-bottom: var(--md-space-3);
}

.document-title-field__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--md-font-size-md);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-title-field__edit {
  flex: none;
}

.document-title-field__input {
  flex: 1;
  min-width: 0;
}

.document-title-field__action {
  flex: none;
}
</style>
