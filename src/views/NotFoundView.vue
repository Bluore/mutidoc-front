<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="not-found">
    <p class="not-found__code">404</p>
    <h1 class="not-found__title">页面不存在</h1>
    <p class="not-found__desc">请检查地址是否正确，或返回首页。</p>
    <RouterLink class="not-found__link" :to="{ name: 'example-list' }">返回首页</RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
}

.not-found__code {
  font-size: 64px;
  font-weight: 700;
  color: var(--md-color-primary);
}

.not-found__title {
  font-size: var(--md-font-size-xl);
}

.not-found__desc {
  color: var(--md-color-text-secondary);
}

.not-found__link {
  margin-top: var(--md-space-4);
  color: var(--md-color-primary);
}
</style>
