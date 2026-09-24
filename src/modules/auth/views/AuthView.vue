<script setup lang="ts">
import { Card as PxCard } from '@pixelium/web-vue/es'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AuthBrandPanel from '../components/AuthBrandPanel.vue'
import LoginForm from '../components/LoginForm.vue'
import RegisterForm from '../components/RegisterForm.vue'
import type { AuthMode } from '../types'

/** 登录 / 注册整屏页面（meta.layout = 'blank'，不套用 DefaultLayout） */
const props = defineProps<{ mode: AuthMode }>()

const route = useRoute()
const router = useRouter()

const isLogin = computed(() => props.mode === 'login')

function handleSuccess(): void {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  router.replace(redirect || { name: 'home' })
}
</script>

<template>
  <div class="auth-view">
    <AuthBrandPanel class="auth-view__brand" />

    <section class="auth-view__panel">
      <PxCard class="auth-view__card" shape="rect" :bordered="true">
        <header class="auth-view__header">
          <div class="auth-view__switch" role="tablist">
            <RouterLink
              class="auth-view__switch-item"
              :class="{ 'is-active': isLogin }"
              :to="{ name: 'auth-login' }"
            >
              登录
            </RouterLink>
            <RouterLink
              class="auth-view__switch-item"
              :class="{ 'is-active': !isLogin }"
              :to="{ name: 'auth-register' }"
            >
              注册
            </RouterLink>
          </div>
          <h2 class="auth-view__title">{{ isLogin ? '登录账号' : '创建账号' }}</h2>
          <p class="auth-view__subtitle">
            {{ isLogin ? '使用邮箱登录，继续你的文档工作台。' : '填写邮箱验证码即可快速注册。' }}
          </p>
        </header>

        <LoginForm v-if="isLogin" @success="handleSuccess" />
        <RegisterForm v-else @success="handleSuccess" />

        <template #footer>
          <div class="auth-view__footer">
            <span class="auth-view__footer-text">
              {{ isLogin ? '还没有账号？' : '已经有账号了？' }}
            </span>
            <RouterLink
              class="auth-view__footer-link"
              :to="{ name: isLogin ? 'auth-register' : 'auth-login' }"
            >
              {{ isLogin ? '立即注册' : '返回登录' }}
            </RouterLink>
          </div>
        </template>
      </PxCard>
    </section>
  </div>
</template>

<style scoped>
.auth-view {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  min-height: 100vh;
  background-color: var(--md-color-bg);
}

.auth-view__brand {
  min-height: 100vh;
}

.auth-view__panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--md-space-8) var(--md-space-6);
}

.auth-view__card {
  width: 100%;
  max-width: 420px;
}

.auth-view__header {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  margin-bottom: var(--md-space-5);
}

.auth-view__switch {
  display: inline-flex;
  align-self: flex-start;
  padding: var(--md-space-1);
  background-color: var(--md-color-bg);
  border: 1px solid var(--md-color-border);
}

.auth-view__switch-item {
  padding: var(--md-space-2) var(--md-space-5);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.auth-view__switch-item.is-active {
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.auth-view__title {
  margin: 0;
  font-size: var(--md-font-size-2xl);
}

.auth-view__subtitle {
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.auth-view__footer {
  display: flex;
  gap: var(--md-space-1);
  align-items: center;
  justify-content: center;
  font-size: var(--md-font-size-sm);
}

.auth-view__footer-text {
  color: var(--md-color-text-secondary);
}

.auth-view__footer-link {
  color: var(--md-color-primary);
}

@media (max-width: 900px) {
  .auth-view {
    grid-template-columns: minmax(0, 1fr);
  }

  .auth-view__brand {
    display: none;
  }
}
</style>
