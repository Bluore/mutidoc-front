<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { env } from '@/config/env'

const route = useRoute()
</script>

<template>
  <div class="default-layout">
    <header class="default-layout__header">
      <RouterLink class="default-layout__brand" to="/">{{ env.appTitle }}</RouterLink>
      <nav class="default-layout__nav">
        <RouterLink class="default-layout__link" :to="{ name: 'example-list' }">
          示例模块
        </RouterLink>
      </nav>
    </header>

    <main class="default-layout__main">
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="route.fullPath" />
      </RouterView>
    </main>

    <footer class="default-layout__footer">MutiDoc · 模块化前端基座</footer>
  </div>
</template>

<style scoped>
.default-layout {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.default-layout__header {
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

.default-layout__brand {
  font-size: var(--md-font-size-lg);
  font-weight: 600;
  color: var(--md-color-text);
}

.default-layout__nav {
  display: flex;
  gap: var(--md-space-4);
}

.default-layout__link {
  padding: var(--md-space-2) var(--md-space-3);
  border-radius: var(--md-radius-md);
  transition: background-color var(--md-transition-fast);
}

.default-layout__link:hover {
  background-color: var(--md-color-surface-hover);
}

/* 当前激活路由：router-link-active 与 .default-layout__link 在同一个 <a> 上，
   用复合选择器即可命中，无需 :deep（:deep 会变成后代选择器而失效）。 */
.default-layout__link.router-link-active {
  color: var(--md-color-primary);
  background-color: var(--md-color-primary-soft);
}

.default-layout__main {
  flex: 1;
  width: 100%;
  max-width: var(--md-layout-max-width);
  padding: var(--md-space-8) var(--md-space-6);
  margin: 0 auto;
}

.default-layout__footer {
  padding: var(--md-space-6);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
  text-align: center;
  border-top: 1px solid var(--md-color-border);
}
</style>
