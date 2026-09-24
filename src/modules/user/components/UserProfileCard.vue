<script setup lang="ts">
import { Avatar as PxAvatar, Card as PxCard, Tag as PxTag } from '@pixelium/web-vue/es'
import { IconEnvelope, IconUser } from '@pixelium/web-vue/icon-hn/es'

import type { UserInfo } from '../types'

/** 用户信息展示卡片（纯展示） */
defineProps<{
  user: UserInfo | null
  /** 昵称首字符，用于无头像时占位 */
  initial: string
}>()
</script>

<template>
  <PxCard class="user-profile-card" shape="rect" :bordered="true" title="基本信息">
    <div class="user-profile-card__identity">
      <PxAvatar class="user-profile-card__avatar" size="large" shape="circle" bordered>
        <img v-if="user?.avatar" :src="user.avatar" alt="用户头像" />
        <span v-else>{{ initial }}</span>
      </PxAvatar>

      <div class="user-profile-card__name">
        <p class="user-profile-card__nick">{{ user?.nick_name || '—' }}</p>
        <PxTag size="small" variant="outline" theme="info">ID {{ user?.id || '—' }}</PxTag>
      </div>
    </div>

    <dl class="user-profile-card__meta">
      <div class="user-profile-card__row">
        <dt class="user-profile-card__label">
          <IconUser />
          昵称
        </dt>
        <dd class="user-profile-card__value">{{ user?.nick_name || '—' }}</dd>
      </div>
      <div class="user-profile-card__row">
        <dt class="user-profile-card__label">
          <IconEnvelope />
          邮箱
        </dt>
        <dd class="user-profile-card__value">{{ user?.email || '—' }}</dd>
      </div>
    </dl>
  </PxCard>
</template>

<style scoped>
.user-profile-card__identity {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
  padding-bottom: var(--md-space-4);
  border-bottom: 1px solid var(--md-color-border);
}

.user-profile-card__avatar {
  flex: none;
}

.user-profile-card__name {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  align-items: flex-start;
}

.user-profile-card__nick {
  margin: 0;
  font-size: var(--md-font-size-xl);
  font-weight: 600;
}

.user-profile-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  margin: var(--md-space-4) 0 0;
}

.user-profile-card__row {
  display: flex;
  gap: var(--md-space-4);
  justify-content: space-between;
}

.user-profile-card__label {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.user-profile-card__value {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
