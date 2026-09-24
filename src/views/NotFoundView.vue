<script setup lang="ts">
import { Button as PxButton } from '@pixelium/web-vue/es'
import { IconHome } from '@pixelium/web-vue/icon-hn/es'
import { useRouter } from 'vue-router'

const router = useRouter()

function backHome(): void {
  void router.push({ name: 'home' })
}
</script>

<template>
  <section class="not-found">
    <p class="not-found__code">404</p>
    <h1 class="not-found__title">页面不存在</h1>
    <p class="not-found__desc">请检查地址是否正确，或返回工作台继续。</p>
    <PxButton native-type="button" @click="backHome">
      <template #icon>
        <IconHome />
      </template>
      返回工作台
    </PxButton>
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
  margin: 0;
  font-size: 64px;
  font-weight: 700;
  color: var(--md-color-primary);
}

.not-found__title {
  margin: 0;
  font-size: var(--md-font-size-xl);
}

.not-found__desc {
  margin: 0 0 var(--md-space-2);
  color: var(--md-color-text-secondary);
}
</style>
