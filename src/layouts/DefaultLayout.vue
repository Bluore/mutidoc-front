<script setup lang="ts">
import {
  Avatar as PxAvatar,
  Button as PxButton,
  Dialog as PxDialog,
  DropDown as PxDropDown,
  Message,
} from '@pixelium/web-vue/es'
import { IconEnvelope, IconFolder, IconLogout, IconUser } from '@pixelium/web-vue/icon-hn/es'
import { onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { env } from '@/config/env'
import { useAuthStore } from '@/modules/auth'
import { useUserStore } from '@/modules/user'
import type { DropDownOption } from '@pixelium/web-vue/es'

/** 应用外壳：顶部导航 + 用户菜单 + 内容区 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const user = useUserStore()

const logoutVisible = ref(false)

const navItems = [
  { name: 'document-list', label: '工作台', icon: IconFolder },
  { name: 'user-profile', label: '个人中心', icon: IconUser },
] as const

const userMenuOptions: DropDownOption[] = [
  { index: 'profile', label: '个人中心' },
  { index: 'logout', label: '退出登录' },
]

onMounted(() => {
  if (auth.isAuthenticated) void user.ensureLoaded()
})

function handleUserMenuSelect(index: string | number | symbol): void {
  if (index === 'profile') {
    void router.push({ name: 'user-profile' })
    return
  }
  if (index === 'logout') requestLogout()
}

function requestLogout(): void {
  logoutVisible.value = true
}

function confirmLogout(): void {
  auth.logout()
  user.reset()
  Message.success('已退出登录')
  void router.push({ name: 'auth-login' })
}
</script>

<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <RouterLink class="app-shell__brand" :to="{ name: 'home' }">
        <span class="app-shell__brand-mark">M</span>
        <span class="app-shell__brand-text">{{ env.appTitle }}</span>
      </RouterLink>

      <nav class="app-shell__nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          class="app-shell__link"
          :to="{ name: item.name }"
        >
          <component :is="item.icon" class="app-shell__link-icon" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="app-shell__user">
        <PxDropDown
          :options="userMenuOptions"
          trigger="click"
          placement="bottom-end"
          @select="handleUserMenuSelect"
        >
          <button class="app-shell__user-trigger" type="button">
            <PxAvatar size="small" shape="circle" bordered>
              <img v-if="user.hasAvatar" :src="user.profile?.avatar" alt="用户头像" />
              <span v-else>{{ user.initials }}</span>
            </PxAvatar>
            <span class="app-shell__user-name">{{ user.displayName }}</span>
          </button>
        </PxDropDown>
      </div>
    </header>

    <main class="app-shell__main">
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="route.fullPath" />
      </RouterView>
    </main>

    <footer class="app-shell__footer">
      <span class="app-shell__footer-item">
        <IconEnvelope class="app-shell__footer-icon" />
        MutiDoc · 像素风多文档协作
      </span>
      <span class="app-shell__footer-item">
        <IconLogout class="app-shell__footer-icon" />
        <PxButton variant="text" size="small" native-type="button" @click="requestLogout">
          退出登录
        </PxButton>
      </span>
    </footer>

    <PxDialog
      v-model:visible="logoutVisible"
      title="退出登录"
      :mask-closable="false"
      ok-text="退出"
      cancel-text="取消"
      @ok="confirmLogout"
    >
      确定要退出登录吗？
    </PxDialog>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-shell__header {
  position: sticky;
  top: 0;
  z-index: var(--md-z-header);
  display: flex;
  gap: var(--md-space-6);
  align-items: center;
  height: var(--md-header-height);
  padding: 0 var(--md-space-6);
  background-color: var(--md-color-surface);
  border-bottom: 1px solid var(--md-color-border);
}

.app-shell__brand {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-lg);
  font-weight: 700;
  color: var(--md-color-text);
}

.app-shell__brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.app-shell__nav {
  display: flex;
  gap: var(--md-space-2);
}

.app-shell__link {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  padding: var(--md-space-2) var(--md-space-3);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  transition: color var(--md-transition-fast);
}

.app-shell__link-icon {
  font-size: 16px;
}

.app-shell__link.router-link-active {
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.app-shell__user {
  margin-left: auto;
}

.app-shell__user-trigger {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  padding: var(--md-space-1) var(--md-space-2);
  border: 1px solid transparent;
}

.app-shell__user-trigger:hover {
  border-color: var(--md-color-border);
}

.app-shell__user-name {
  max-width: 140px;
  overflow: hidden;
  font-size: var(--md-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-shell__main {
  flex: 1;
  width: 100%;
  max-width: var(--md-layout-max-width);
  padding: var(--md-space-8) var(--md-space-6);
  margin: 0 auto;
}

.app-shell__footer {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
  justify-content: space-between;
  padding: var(--md-space-4) var(--md-space-6);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  border-top: 1px solid var(--md-color-border);
}

.app-shell__footer-item {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
}

.app-shell__footer-icon {
  font-size: 16px;
}

@media (max-width: 720px) {
  .app-shell__brand-text,
  .app-shell__user-name {
    display: none;
  }
}
</style>
