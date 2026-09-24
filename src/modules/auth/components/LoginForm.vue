<script setup lang="ts">
import { Message, Button as PxButton, Form as PxForm, FormItem as PxFormItem, Input as PxInput } from '@pixelium/web-vue/es'
import { IconEnvelope, IconLock } from '@pixelium/web-vue/icon-hn/es'
import { reactive, ref } from 'vue'

import { env } from '@/config/env'
import { getErrorMessage } from '@/utils/error'

import { LOGIN_RULES, ROBOT_CODE_PLACEHOLDER } from '../constants'
import { useAuthStore } from '../stores/auth'

/** 登录表单：本地校验通过后调用 auth store，成功后通知父级跳转 */
const props = defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ success: [] }>()

const auth = useAuthStore()

interface FormRef {
  validate: () => Promise<{ isValid: boolean }>
}
const formRef = ref<FormRef | null>(null)

type LoginFormModel = { login: string; password: string }
const model = reactive<LoginFormModel>({ login: '', password: '' })

async function handleSubmit(): Promise<void> {
  const result = await formRef.value?.validate()
  if (!result?.isValid) return

  try {
    await auth.login({
      login: model.login.trim(),
      password: model.password,
      // 接口要求必填，后端暂未校验，统一传占位值
      robot_code: ROBOT_CODE_PLACEHOLDER,
    })
    Message.success('登录成功，欢迎回来')
    emit('success')
  } catch (error) {
    Message.error(getErrorMessage(error, '登录失败，请稍后重试'))
  }
}
</script>

<template>
  <PxForm
    ref="formRef"
    class="auth-login-form"
    :model="model"
    :rules="LOGIN_RULES"
    label-align="top"
    :show-asterisk="false"
  >
    <PxFormItem field="login" label="邮箱 / 登录名">
      <PxInput
        v-model="model.login"
        placeholder="邮箱或登录名"
        size="large"
        :max-length="64"
        @keyup.enter="handleSubmit"
      >
        <template #prefix>
          <IconEnvelope />
        </template>
      </PxInput>
    </PxFormItem>

    <PxFormItem field="password" label="密码">
      <PxInput
        v-model="model.password"
        password
        placeholder="请输入密码"
        size="large"
        @keyup.enter="handleSubmit"
      >
        <template #prefix>
          <IconLock />
        </template>
      </PxInput>
    </PxFormItem>

    <PxButton
      block
      size="large"
      native-type="button"
      :loading="props.loading"
      @click="handleSubmit"
    >
      登录
    </PxButton>

    <p v-if="env.useMock" class="auth-login-form__hint">
      演示账号：demo@mutidoc.dev（或 Demo）/ demo1234
    </p>
  </PxForm>
</template>

<style scoped>
.auth-login-form {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
}

.auth-login-form__hint {
  margin: 0;
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
  text-align: center;
}
</style>
