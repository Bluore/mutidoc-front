<script setup lang="ts">
import { Button as PxButton, Input as PxInput } from '@pixelium/web-vue/es'
import { ref, watch } from 'vue'

import { NICKNAME_MAX_LENGTH } from '../constants'

/** 昵称编辑表单（纯展示，提交后由父级调用 store） */
const props = defineProps<{
  initialValue: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ submit: [value: string] }>()

const value = ref(props.initialValue)
const error = ref('')

watch(
  () => props.initialValue,
  (next) => {
    value.value = next
    error.value = ''
  },
)

function handleSubmit(): void {
  const trimmed = value.value.trim()
  if (!trimmed) {
    error.value = '昵称不能为空'
    return
  }
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    error.value = `昵称不超过 ${NICKNAME_MAX_LENGTH} 个字符`
    return
  }
  error.value = ''
  emit('submit', trimmed)
}
</script>

<template>
  <form class="user-profile-form" @submit.prevent="handleSubmit">
    <label class="user-profile-form__label" for="user-nick-name">昵称</label>
    <div class="user-profile-form__row">
      <PxInput
        id="user-nick-name"
        v-model="value"
        class="user-profile-form__input"
        :status="error ? 'error' : 'normal'"
        :disabled="disabled"
        :max-length="NICKNAME_MAX_LENGTH"
        placeholder="请输入昵称"
        @keyup.enter="handleSubmit"
      />
      <PxButton
        class="user-profile-form__button"
        native-type="button"
        :loading="loading"
        :disabled="disabled"
        @click="handleSubmit"
      >
        保存
      </PxButton>
    </div>
    <p v-if="error" class="user-profile-form__error">{{ error }}</p>
  </form>
</template>

<style scoped>
.user-profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
}

.user-profile-form__label {
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.user-profile-form__row {
  display: flex;
  gap: var(--md-space-2);
}

.user-profile-form__input {
  flex: 1;
}

.user-profile-form__button {
  flex: none;
}

.user-profile-form__error {
  margin: 0;
  font-size: var(--md-font-size-xs);
  color: var(--md-color-danger);
}
</style>
