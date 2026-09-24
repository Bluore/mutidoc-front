<script setup lang="ts">
import {
  Alert as PxAlert,
  Button as PxButton,
  Card as PxCard,
  Divider as PxDivider,
  Message,
  Spin as PxSpin,
} from '@pixelium/web-vue/es'
import { IconRefresh } from '@pixelium/web-vue/icon-hn/es'
import { computed, onMounted } from 'vue'

import { env } from '@/config/env'
import { getErrorMessage } from '@/utils/error'

import UserAvatarField from '../components/UserAvatarField.vue'
import UserProfileCard from '../components/UserProfileCard.vue'
import UserProfileForm from '../components/UserProfileForm.vue'
import { useUserStore } from '../stores/user'

/** 个人中心：查看用户信息 + 修改昵称 / 头像 */
const userStore = useUserStore()

const loadError = computed(() => userStore.error)
const notice = computed(() =>
  env.useMock
    ? '当前为 Mock 模式：昵称与头像的修改仅在本地内存中生效，刷新后重置。'
    : '后端目前仅实现「获取用户信息」；修改资料与头像上传接口尚未实现，保存会返回明确的提示。',
)

onMounted(() => {
  void userStore.load()
})

async function handleProfileSubmit(nickName: string): Promise<void> {
  try {
    await userStore.updateProfile(nickName)
    Message.success('昵称已更新')
  } catch (error) {
    Message.error(getErrorMessage(error, '昵称更新失败'))
  }
}

async function handleAvatarSelect(dataUrl: string): Promise<void> {
  try {
    await userStore.updateAvatar(dataUrl)
    Message.success('头像已更新')
  } catch (error) {
    Message.error(getErrorMessage(error, '头像更新失败'))
  }
}
</script>

<template>
  <section class="user-profile-view">
    <header class="user-profile-view__header">
      <div>
        <h1 class="user-profile-view__title">个人中心</h1>
        <p class="user-profile-view__subtitle">查看账号信息，并维护你的昵称与头像。</p>
      </div>
      <PxButton
        variant="outline"
        native-type="button"
        :loading="userStore.loading"
        @click="userStore.load()"
      >
        <template #icon>
          <IconRefresh />
        </template>
        刷新
      </PxButton>
    </header>

    <PxSpin :loading="userStore.loading && !userStore.profile">
      <PxAlert v-if="loadError" class="user-profile-view__error" type="error" :title="loadError">
        {{ loadError }}
      </PxAlert>

      <div class="user-profile-view__grid">
        <UserProfileCard :user="userStore.profile" :initial="userStore.initials" />

        <div class="user-profile-view__side">
          <PxCard shape="rect" :bordered="true" title="编辑资料">
            <UserProfileForm
              :initial-value="userStore.profile?.nick_name ?? ''"
              :loading="userStore.saving"
              :disabled="!userStore.profile"
              @submit="handleProfileSubmit"
            />

            <PxDivider :margin="20" />

            <section class="user-profile-view__avatar">
              <h3 class="user-profile-view__avatar-title">头像</h3>
              <UserAvatarField
                :src="userStore.profile?.avatar ?? ''"
                :initial="userStore.initials"
                :loading="userStore.avatarUpdating"
                :disabled="!userStore.profile"
                @select="handleAvatarSelect"
              />
            </section>
          </PxCard>

          <PxAlert type="info" :title="env.useMock ? 'Mock 模式' : '接口说明'">
            {{ notice }}
          </PxAlert>
        </div>
      </div>
    </PxSpin>
  </section>
</template>

<style scoped>
.user-profile-view {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-6);
}

.user-profile-view__header {
  display: flex;
  gap: var(--md-space-4);
  align-items: flex-end;
  justify-content: space-between;
}

.user-profile-view__title {
  margin: 0;
  font-size: var(--md-font-size-2xl);
}

.user-profile-view__subtitle {
  margin: var(--md-space-2) 0 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.user-profile-view__error {
  margin-bottom: var(--md-space-4);
}

.user-profile-view__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: var(--md-space-6);
  align-items: start;
}

.user-profile-view__side {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-4);
}

.user-profile-view__avatar-title {
  margin: 0 0 var(--md-space-3);
  font-size: var(--md-font-size-md);
}

@media (max-width: 900px) {
  .user-profile-view__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
