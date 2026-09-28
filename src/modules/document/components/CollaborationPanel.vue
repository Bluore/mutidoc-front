<script setup lang="ts">
import {
  Alert as PxAlert,
  Avatar as PxAvatar,
  Button as PxButton,
  Card as PxCard,
  Divider as PxDivider,
  Tag as PxTag,
} from '@pixelium/web-vue/es'
import { IconLogout, IconRefresh, IconUser } from '@pixelium/web-vue/icon-hn/es'
import { computed } from 'vue'

import { formatUnixSeconds } from '@/utils/date'

import { COLLABORATION_STATUS_META, DOCUMENT_SUMMARY_FALLBACK } from '../constants'
import type { CollaborationStatus, CollaborationUser, DocumentItem } from '../types'

/**
 * 协作编辑右侧操作面板（纯展示 + 事件上抛）。
 * 展示文档信息、连接状态、在线编辑人、当前用户与活动日志，并提供重连 / 退出操作。
 */
const props = defineProps<{
  document: DocumentItem | null
  status: CollaborationStatus
  revision: number
  users: CollaborationUser[]
  selfUserId: string
  desynced: boolean
  error: string | null
  logs: string[]
  selfName: string
  selfEmail: string
  selfAvatar: string
}>()

const emit = defineEmits<{ reconnect: []; exit: [] }>()

const statusMeta = computed(() => COLLABORATION_STATUS_META[props.status])
const documentTitle = computed(
  () => props.document?.summary.trim() || DOCUMENT_SUMMARY_FALLBACK,
)

/** 取名字首字符做头像占位 */
function toInitial(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?'
}

function isSelf(userId: string): boolean {
  return Boolean(userId) && userId === props.selfUserId
}
</script>

<template>
  <aside class="collab-panel" aria-label="协作操作面板">
    <PxCard class="collab-panel__card" shape="rect" :bordered="true" title="文档信息">
      <div class="collab-panel__doc-title">{{ documentTitle }}</div>
      <dl class="collab-panel__meta">
        <div class="collab-panel__row">
          <dt class="collab-panel__label">文档 ID</dt>
          <dd class="collab-panel__value">{{ document?.id ?? '—' }}</dd>
        </div>
        <div class="collab-panel__row">
          <dt class="collab-panel__label">归属者</dt>
          <dd class="collab-panel__value">{{ document?.owner_id ?? '—' }}</dd>
        </div>
        <div class="collab-panel__row">
          <dt class="collab-panel__label">创建时间</dt>
          <dd class="collab-panel__value">
            {{ document ? formatUnixSeconds(document.create_at) : '—' }}
          </dd>
        </div>
        <div class="collab-panel__row">
          <dt class="collab-panel__label">更新时间</dt>
          <dd class="collab-panel__value">
            {{ document ? formatUnixSeconds(document.update_at) : '—' }}
          </dd>
        </div>
      </dl>
    </PxCard>

    <PxCard class="collab-panel__card" shape="rect" :bordered="true" title="连接状态">
      <div class="collab-panel__status">
        <PxTag :theme="statusMeta.theme" variant="outline" size="small">
          {{ statusMeta.label }}
        </PxTag>
        <span class="collab-panel__revision">版本号 reversion = {{ revision }}</span>
      </div>

      <PxAlert v-if="error" class="collab-panel__alert" type="error" :title="error">
        {{ error }}
      </PxAlert>
      <PxAlert v-else-if="desynced" class="collab-panel__alert" type="warning" title="本地与服务器失步">
        算子无法合并，建议退出后重新进入以重新同步。
      </PxAlert>

      <PxButton
        v-if="status !== 'connected' && status !== 'connecting'"
        class="collab-panel__action"
        variant="outline"
        native-type="button"
        @click="emit('reconnect')"
      >
        <template #icon>
          <IconRefresh />
        </template>
        重新连接
      </PxButton>
    </PxCard>

    <PxCard class="collab-panel__card" shape="rect" :bordered="true" title="在线编辑人">
      <ul v-if="users.length > 0" class="collab-panel__users">
        <li
          v-for="(user, index) in users"
          :key="`${index}-${user.id || user.name}`"
          class="collab-panel__user"
        >
          <PxAvatar size="small" shape="circle" bordered>
            {{ toInitial(user.name || user.id) }}
          </PxAvatar>
          <span class="collab-panel__user-name">{{ user.name || '匿名用户' }}</span>
          <PxTag v-if="isSelf(user.id)" theme="primary" variant="outline" size="small">我</PxTag>
        </li>
      </ul>
      <p v-else class="collab-panel__empty">
        <IconUser class="collab-panel__empty-icon" />
        暂无在线成员（连接成功后将由服务端下发）
      </p>
    </PxCard>

    <PxCard class="collab-panel__card" shape="rect" :bordered="true" title="当前用户">
      <div class="collab-panel__self">
        <PxAvatar size="medium" shape="circle" bordered>
          <img v-if="selfAvatar" :src="selfAvatar" alt="当前用户头像" />
          <span v-else>{{ toInitial(selfName) }}</span>
        </PxAvatar>
        <div class="collab-panel__self-info">
          <span class="collab-panel__self-name">{{ selfName || '未登录' }}</span>
          <span class="collab-panel__self-email">{{ selfEmail || '—' }}</span>
        </div>
      </div>
    </PxCard>

    <PxCard class="collab-panel__card" shape="rect" :bordered="true" title="活动日志">
      <ul v-if="logs.length > 0" class="collab-panel__logs">
        <li v-for="(log, index) in logs" :key="`${index}-${log}`" class="collab-panel__log">
          {{ log }}
        </li>
      </ul>
      <p v-else class="collab-panel__empty">暂无活动记录</p>
    </PxCard>

    <PxDivider :margin="4" />

    <PxButton theme="danger" variant="outline" native-type="button" @click="emit('exit')">
      <template #icon>
        <IconLogout />
      </template>
      退出编辑
    </PxButton>
  </aside>
</template>

<style scoped>
.collab-panel {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-3);
  width: 320px;
  flex: none;
}

.collab-panel__card {
  flex: none;
}

.collab-panel__doc-title {
  margin-bottom: var(--md-space-3);
  font-size: var(--md-font-size-md);
  font-weight: 600;
}

.collab-panel__meta {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  margin: 0;
}

.collab-panel__row {
  display: flex;
  gap: var(--md-space-3);
  justify-content: space-between;
  font-size: var(--md-font-size-sm);
}

.collab-panel__label {
  flex: none;
  color: var(--md-color-text-secondary);
}

.collab-panel__value {
  margin: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collab-panel__status {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  justify-content: space-between;
}

.collab-panel__revision {
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
}

.collab-panel__alert {
  margin-top: var(--md-space-3);
}

.collab-panel__action {
  width: 100%;
  margin-top: var(--md-space-3);
}

.collab-panel__users {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  margin: 0;
  padding: 0;
}

.collab-panel__user {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
}

.collab-panel__user-name {
  flex: 1;
  overflow: hidden;
  font-size: var(--md-font-size-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collab-panel__empty {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.collab-panel__empty-icon {
  flex: none;
}

.collab-panel__self {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
}

.collab-panel__self-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.collab-panel__self-name {
  font-size: var(--md-font-size-sm);
  font-weight: 600;
}

.collab-panel__self-email {
  overflow: hidden;
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collab-panel__logs {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-1);
  max-height: 180px;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.collab-panel__log {
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-xs);
  line-height: 1.5;
  color: var(--md-color-text-secondary);
  overflow-wrap: anywhere;
}

@media (max-width: 900px) {
  .collab-panel {
    width: 100%;
  }
}
</style>
