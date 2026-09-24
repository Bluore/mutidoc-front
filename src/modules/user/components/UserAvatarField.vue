<script setup lang="ts">
import { Avatar as PxAvatar, Button as PxButton, Message } from '@pixelium/web-vue/es'
import { IconUpload } from '@pixelium/web-vue/icon-hn/es'
import { ref } from 'vue'

/** 头像选择器：读取本地图片为 dataURL 后交给父级处理（纯展示 + 文件读取） */
const props = defineProps<{
  src: string
  initial: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ select: [dataUrl: string] }>()

const MAX_SIZE = 2 * 1024 * 1024
const fileInputRef = ref<HTMLInputElement | null>(null)

function openPicker(): void {
  if (props.disabled || props.loading) return
  fileInputRef.value?.click()
}

function handleChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // 允许重复选择同一文件
  input.value = ''
  if (!file) return

  if (!file.type.startsWith('image/')) {
    Message.warning('请选择图片文件')
    return
  }
  if (file.size > MAX_SIZE) {
    Message.warning('图片大小不能超过 2MB')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') emit('select', reader.result)
  }
  reader.onerror = () => Message.error('图片读取失败，请重试')
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="user-avatar-field">
    <PxAvatar class="user-avatar-field__avatar" size="large" shape="circle" bordered>
      <img v-if="src" :src="src" alt="用户头像" />
      <span v-else>{{ initial }}</span>
    </PxAvatar>

    <div class="user-avatar-field__actions">
      <PxButton
        variant="outline"
        size="small"
        native-type="button"
        :loading="loading"
        :disabled="disabled"
        @click="openPicker"
      >
        <template #icon>
          <IconUpload />
        </template>
        选择图片
      </PxButton>
      <p class="user-avatar-field__hint">支持 JPG / PNG，大小不超过 2MB</p>
    </div>

    <input
      ref="fileInputRef"
      class="user-avatar-field__input"
      type="file"
      accept="image/*"
      @change="handleChange"
    />
  </div>
</template>

<style scoped>
.user-avatar-field {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
}

.user-avatar-field__avatar {
  flex: none;
}

.user-avatar-field__actions {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-1);
  align-items: flex-start;
}

.user-avatar-field__hint {
  margin: 0;
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
}

.user-avatar-field__input {
  display: none;
}
</style>
