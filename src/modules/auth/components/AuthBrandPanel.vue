<script setup lang="ts">
import { IconBookHeart, IconRobot, IconUsersCrown } from '@pixelium/web-vue/icon-hn/es'

/** 鉴权页左侧品牌区（纯展示，无业务逻辑） */
const highlights = [
  { icon: IconBookHeart, title: '文档协作', desc: '多人在线共同编辑同一份文档' },
  { icon: IconUsersCrown, title: '团队协作', desc: '按账号隔离的私有文档空间' },
  { icon: IconRobot, title: '智能增强', desc: '为后续 AI 能力预留的扩展位' },
] as const
</script>

<template>
  <aside class="auth-brand">
    <div class="auth-brand__logo">
      <span class="auth-brand__logo-mark">M</span>
      <span class="auth-brand__logo-text">MutiDoc</span>
    </div>

    <h1 class="auth-brand__title">
      像素风格
      <br />
      多文档协作平台
    </h1>
    <p class="auth-brand__subtitle">创建、整理并在同一个工作台里管理你的全部文档。</p>

    <ul class="auth-brand__list">
      <li v-for="item in highlights" :key="item.title" class="auth-brand__item">
        <span class="auth-brand__item-icon">
          <component :is="item.icon" />
        </span>
        <span class="auth-brand__item-text">
          <strong class="auth-brand__item-title">{{ item.title }}</strong>
          <span class="auth-brand__item-desc">{{ item.desc }}</span>
        </span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.auth-brand {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-5);
  justify-content: center;
  padding: var(--md-space-8);
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
}

.auth-brand__logo {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-xl);
  font-weight: 700;
  letter-spacing: 1px;
}

.auth-brand__logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: var(--md-font-size-lg);
  background-color: var(--md-color-text-inverse);
  color: var(--md-color-primary);
}

.auth-brand__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.35;
}

.auth-brand__subtitle {
  margin: 0;
  opacity: 0.86;
}

.auth-brand__list {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
  margin: var(--md-space-2) 0 0;
}

.auth-brand__item {
  display: flex;
  gap: var(--md-space-3);
  align-items: flex-start;
}

.auth-brand__item-icon {
  display: inline-flex;
  font-size: 20px;
  line-height: 1;
  opacity: 0.95;
}

.auth-brand__item-text {
  display: flex;
  flex-direction: column;
}

.auth-brand__item-title {
  font-size: var(--md-font-size-md);
}

.auth-brand__item-desc {
  font-size: var(--md-font-size-sm);
  opacity: 0.82;
}
</style>
