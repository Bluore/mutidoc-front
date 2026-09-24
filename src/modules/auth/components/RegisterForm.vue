<script setup lang="ts">
import { Message, Button as PxButton, Form as PxForm, FormItem as PxFormItem, Input as PxInput } from '@pixelium/web-vue/es'
import type { RuleItem } from '@pixelium/web-vue/es'
import { IconEnvelope, IconLock, IconUser, IconCheckBox } from '@pixelium/web-vue/icon-hn/es'
import { reactive, ref } from 'vue'

import { getErrorMessage } from '@/utils/error'

import { useEmailCountdown } from '../composables/useEmailCountdown'
import { EMAIL_CODE_COOLDOWN, EMAIL_PATTERN, REGISTER_RULES } from '../constants'
import { useAuthStore } from '../stores/auth'

/** 注册表单：先获取邮箱验证码，再提交注册 */
const props = defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ success: [] }>()

const auth = useAuthStore()
const { remaining, counting, start: startCountdown } = useEmailCountdown(EMAIL_CODE_COOLDOWN)
const sendingCode = ref(false)

interface FormRef {
  validate: () => Promise<{ isValid: boolean }>
}
const formRef = ref<FormRef | null>(null)

type RegisterFormModel = {
  email: string
  email_code: string
  nick_name: string
  password: string
  confirm_password: string
}
const model = reactive<RegisterFormModel>({
  email: '',
  email_code: '',
  nick_name: '',
  password: '',
  confirm_password: '',
})

/**
 * 表单规则 = 公共规则 + 「确认密码」跨字段校验。
 * 注意：pixelium 的 validator 第二个参数运行时是 form 的 model Ref（与类型声明不符），
 * 因此这里直接闭包引用组件内的 model，避免读取到 undefined。
 */
const rules: Record<string, RuleItem | RuleItem[]> = {
  ...REGISTER_RULES,
  confirm_password: [
    { required: true, message: '请再次输入密码' },
    {
      validator: (value: string) =>
        value === model.password ? undefined : '两次输入的密码不一致',
    },
  ],
}

async function handleSendCode(): Promise<void> {
  if (counting.value || sendingCode.value) return
  if (!EMAIL_PATTERN.test(model.email.trim())) {
    Message.warning('请先输入正确的邮箱')
    return
  }

  sendingCode.value = true
  try {
    await auth.sendEmailCode(model.email.trim())
    startCountdown()
    Message.success('验证码已发送，请查收邮件（10 分钟内有效）')
  } catch (error) {
    Message.error(getErrorMessage(error, '验证码发送失败，请稍后重试'))
  } finally {
    sendingCode.value = false
  }
}

async function handleSubmit(): Promise<void> {
  const result = await formRef.value?.validate()
  if (!result?.isValid) return

  try {
    await auth.register({
      email: model.email.trim(),
      email_code: model.email_code.trim(),
      nick_name: model.nick_name.trim(),
      password: model.password,
    })
    Message.success('注册成功，已自动登录')
    emit('success')
  } catch (error) {
    Message.error(getErrorMessage(error, '注册失败，请稍后重试'))
  }
}
</script>

<template>
  <PxForm
    ref="formRef"
    class="auth-register-form"
    :model="model"
    :rules="rules"
    label-align="top"
    :show-asterisk="false"
  >
    <PxFormItem field="email" label="邮箱">
      <PxInput
        v-model="model.email"
        placeholder="you@example.com"
        size="large"
        :max-length="64"
      >
        <template #prefix>
          <IconEnvelope />
        </template>
      </PxInput>
    </PxFormItem>

    <PxFormItem field="email_code" label="邮箱验证码">
      <div class="auth-register-form__code">
        <PxInput
          v-model="model.email_code"
          placeholder="6 位数字验证码"
          size="large"
          :max-length="6"
          @keyup.enter="handleSubmit"
        >
          <template #prefix>
            <IconCheckBox />
          </template>
        </PxInput>
        <PxButton
          class="auth-register-form__code-button"
          variant="outline"
          size="large"
          native-type="button"
          :disabled="counting"
          :loading="sendingCode"
          @click="handleSendCode"
        >
          {{ counting ? `${remaining}s 后重发` : '获取验证码' }}
        </PxButton>
      </div>
    </PxFormItem>

    <PxFormItem field="nick_name" label="昵称">
      <PxInput v-model="model.nick_name" placeholder="请输入昵称" size="large" :max-length="20">
        <template #prefix>
          <IconUser />
        </template>
      </PxInput>
    </PxFormItem>

    <PxFormItem field="password" label="密码">
      <PxInput
        v-model="model.password"
        password
        placeholder="请输入密码"
        size="large"
      >
        <template #prefix>
          <IconLock />
        </template>
      </PxInput>
    </PxFormItem>

    <PxFormItem field="confirm_password" label="确认密码">
      <PxInput
        v-model="model.confirm_password"
        password
        placeholder="请再次输入密码"
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
      注册并登录
    </PxButton>
  </PxForm>
</template>

<style scoped>
.auth-register-form {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
}

.auth-register-form__code {
  display: flex;
  gap: var(--md-space-2);
}

.auth-register-form__code-button {
  flex: none;
  white-space: nowrap;
}
</style>
