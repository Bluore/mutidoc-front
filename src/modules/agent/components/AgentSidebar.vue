<script setup lang="ts">
import {
  Alert as PxAlert,
  Avatar as PxAvatar,
  Button as PxButton,
  Spin as PxSpin,
  Tag as PxTag,
  Textarea as PxTextarea,
} from '@pixelium/web-vue/es'
import {
  IconAngleLeft,
  IconClock,
  IconExpand,
  IconMessageDots,
  IconRefresh,
  IconRobot,
  IconSparkles,
  IconWindowClose,
} from '@pixelium/web-vue/icon-hn/es'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  AGENT_EMPTY_HINT,
  AGENT_HISTORY_EMPTY,
  AGENT_HISTORY_LABEL,
  AGENT_HISTORY_LOADING_HINT,
  AGENT_PANEL_TITLE,
  AGENT_QUERY_MAX_LENGTH,
  AGENT_REASONING_LABEL,
  AGENT_RESET_LABEL,
  AGENT_RESTORING_HINT,
  AGENT_ROLE_LABEL,
  AGENT_SESSION_TITLE_FALLBACK,
  AGENT_STATUS_META,
  AGENT_THINKING_HINT,
  AGENT_TOOL_ARGS_LABEL,
  AGENT_TOOL_CALLS_LABEL,
  AGENT_TOOL_RESULT_LABEL,
} from '../constants'
import { useAgentStore } from '../stores/agent'
import type { AgentMessage, AgentMessageSegment, AgentSession } from '../types'

/**
 * Agent 助手：右下角悬浮按钮 + 右侧浮层侧栏。
 *
 * 侧栏以 `position: fixed` 浮在页面上（Teleport 到 body），**不参与文档流、不挤占
 * 页面空间**；默认收起，由右下角悬浮按钮打开。组件只负责展示与交互，会话编排都在
 * `stores/agent.ts` 中完成，不直接接触 REST / SSE。
 *
 * 侧栏有两个视图：对话（默认）与历史会话；历史视图里选择会话即恢复该会话。
 */
const agent = useAgentStore()

/** 侧栏展开状态（本地 UI 状态，不进 store） */
const open = ref(false)
/** 是否全屏（宽度铺满视口） */
const fullscreen = ref(false)
/** 当前视图：对话 / 历史会话 */
const view = ref<'chat' | 'history'>('chat')

/** 输入草稿 */
const draft = ref('')
const messageListRef = ref<HTMLElement | null>(null)

const statusMeta = computed(() => AGENT_STATUS_META[agent.status])
const canSend = computed(() => draft.value.trim().length > 0 && !agent.busy)

/**
 * 滚动信号：消息条数 / 末尾片段长度 / 等待态任一变化都触发滚动到底部。
 * 用轻量字符串而不是深监听整个消息数组，避免流式更新时反复深度遍历。
 */
const scrollSignal = computed(() => {
  const last = agent.messages[agent.messages.length - 1]
  const tail = last?.segments[last.segments.length - 1]
  const tailLength = tail
    ? tail.kind === 'tool'
      ? tail.call.arguments.length + tail.call.result.length
      : tail.text.length
    : 0
  return `${agent.messages.length}:${agent.pendingQuery.length}:${agent.thinking ? 1 : 0}:${
    last?.segments.length ?? 0
  }:${tailLength}`
})

function roleLabel(message: AgentMessage): string {
  return AGENT_ROLE_LABEL[message.role] ?? message.role
}

function isUser(message: AgentMessage): boolean {
  return message.role === 'user'
}

/** 拼接消息里的正文片段（用户消息通常只有一个）。 */
function messageContent(message: AgentMessage): string {
  return message.segments
    .filter((segment): segment is Extract<AgentMessageSegment, { kind: 'content' }> => segment.kind === 'content')
    .map((segment) => segment.text)
    .join('')
}

/** 工具参数 / 结果是原文（通常是 JSON），能解析时格式化，便于阅读；否则原样展示。 */
function formatToolPayload(raw: string): string {
  const text = raw.trim()
  if (!text) return raw
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return raw
  }
}

/** 正在输出正文的助手气泡：显示打字动画（思考 / 工具调用阶段也复用） */
function isAnswering(message: AgentMessage, index: number): boolean {
  return (
    agent.busy &&
    message.role === 'assistant' &&
    !messageContent(message) &&
    index === agent.messages.length - 1
  )
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = messageListRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function toggle(): void {
  open.value = !open.value
  if (open.value) {
    view.value = 'chat'
    void scrollToBottom()
  } else {
    // 收起时恢复默认宽度，下次打开保持窄栏
    fullscreen.value = false
  }
}

/** 在窄栏与全屏之间切换。 */
function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value
  void scrollToBottom()
}

function openHistory(): void {
  view.value = 'history'
  void agent.loadSessions()
}

function refreshHistory(): void {
  void agent.loadSessions()
}

/** 选择历史会话：切回对话视图并恢复该会话（服务端会回放历史）。 */
function handleRestore(session: AgentSession): void {
  view.value = 'chat'
  void agent.restore(session.id)
}

async function submit(): Promise<void> {
  if (!canSend.value) return
  const query = draft.value
  draft.value = ''
  await agent.ask(query)
}

/** Enter 发送、Shift+Enter 换行；输入法合成期间的回车不发送。 */
function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  void submit()
}

/** Esc：先退出全屏，再关闭侧栏。 */
function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  if (fullscreen.value) {
    fullscreen.value = false
    return
  }
  open.value = false
}

function handleReset(): void {
  agent.reset()
  draft.value = ''
}

watch(scrollSignal, () => {
  void scrollToBottom()
})

onMounted(() => {
  window.addEventListener('keydown', handleWindowKeydown)
})

// 离开协作编辑页时中止事件流并结束会话，避免遗留后台连接。
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown)
  agent.reset()
})
</script>

<template>
  <Teleport to="body">
    <PxButton
      v-if="!open"
      class="agent-fab"
      shape="circle"
      size="large"
      theme="primary"
      native-type="button"
      aria-label="打开 Agent 助手"
      @click="toggle"
    >
      <template #icon>
        <IconMessageDots />
      </template>
    </PxButton>

    <Transition name="agent-panel">
      <aside
        v-if="open"
        class="agent-panel"
        :class="{ 'agent-panel--full': fullscreen }"
        aria-label="Agent 助手侧栏"
      >
        <header class="agent-panel__header">
          <PxButton
            v-if="view === 'history'"
            variant="text"
            size="small"
            native-type="button"
            aria-label="返回对话"
            @click="view = 'chat'"
          >
            <template #icon>
              <IconAngleLeft />
            </template>
          </PxButton>

          <span class="agent-panel__heading">
            <component
              :is="view === 'chat' ? IconRobot : IconClock"
              class="agent-panel__heading-icon"
            />
            {{ view === 'chat' ? AGENT_PANEL_TITLE : AGENT_HISTORY_LABEL }}
            <PxTag
              v-if="view === 'chat'"
              :theme="statusMeta.theme"
              variant="outline"
              size="small"
            >
              {{ statusMeta.label }}
            </PxTag>
          </span>

          <span class="agent-panel__header-actions">
            <PxButton
              v-if="view === 'chat'"
              variant="text"
              size="small"
              native-type="button"
              aria-label="历史会话"
              @click="openHistory"
            >
              <template #icon>
                <IconClock />
              </template>
            </PxButton>
            <PxButton
              v-else
              variant="text"
              size="small"
              native-type="button"
              aria-label="刷新历史会话"
              @click="refreshHistory"
            >
              <template #icon>
                <IconRefresh />
              </template>
            </PxButton>
            <PxButton
              variant="text"
              size="small"
              native-type="button"
              :aria-label="fullscreen ? '退出全屏' : '全屏'"
              @click="toggleFullscreen"
            >
              <template #icon>
                <span
                  class="agent-panel__icon"
                  :class="{ 'agent-panel__icon--flip': fullscreen }"
                >
                  <IconExpand />
                </span>
              </template>
            </PxButton>
            <PxButton
              variant="text"
              size="small"
              native-type="button"
              aria-label="关闭 Agent 助手"
              @click="toggle"
            >
              <template #icon>
                <IconWindowClose />
              </template>
            </PxButton>
          </span>
        </header>

        <!-- 对话视图 -->
        <template v-if="view === 'chat'">
          <div
            ref="messageListRef"
            class="agent-panel__messages"
            role="log"
            aria-live="polite"
            aria-label="对话记录"
          >
            <p
              v-if="!agent.hasConversation && !agent.thinking && !agent.restoring"
              class="agent-panel__empty"
            >
              <IconSparkles class="agent-panel__empty-icon" />
              {{ AGENT_EMPTY_HINT }}
            </p>

            <div
              v-for="(message, index) in agent.messages"
              :key="`${index}-${message.role}`"
              class="agent-panel__message"
              :class="{ 'agent-panel__message--user': isUser(message) }"
            >
              <PxAvatar class="agent-panel__avatar" size="small" shape="circle" bordered>
                {{ isUser(message) ? '我' : 'AI' }}
              </PxAvatar>
              <div class="agent-panel__bubble">
                <span class="agent-panel__role">{{ roleLabel(message) }}</span>
                <template v-for="(segment, segIndex) in message.segments" :key="segIndex">
                  <details
                    v-if="segment.kind === 'reasoning'"
                    class="agent-panel__reasoning"
                  >
                    <summary class="agent-panel__reasoning-summary">
                      {{ AGENT_REASONING_LABEL }}
                    </summary>
                    <p class="agent-panel__reasoning-text">{{ segment.text }}</p>
                  </details>
                  <details v-else-if="segment.kind === 'tool'" class="agent-panel__tools">
                    <summary class="agent-panel__tools-summary">
                      {{
                        segment.call.name
                          ? `${AGENT_TOOL_CALLS_LABEL} · ${segment.call.name}`
                          : AGENT_TOOL_CALLS_LABEL
                      }}
                    </summary>
                    <div class="agent-panel__tool">
                      <p v-if="segment.call.arguments" class="agent-panel__tool-block">
                        <span class="agent-panel__tool-label">{{ AGENT_TOOL_ARGS_LABEL }}</span>
                        <span class="agent-panel__tool-text">{{
                          formatToolPayload(segment.call.arguments)
                        }}</span>
                      </p>
                      <p v-if="segment.call.result" class="agent-panel__tool-block">
                        <span class="agent-panel__tool-label">{{ AGENT_TOOL_RESULT_LABEL }}</span>
                        <span class="agent-panel__tool-text">{{
                          formatToolPayload(segment.call.result)
                        }}</span>
                      </p>
                    </div>
                  </details>
                  <p v-else class="agent-panel__content">{{ segment.text }}</p>
                </template>
                <span
                  v-if="isAnswering(message, index)"
                  class="agent-panel__dots"
                  aria-hidden="true"
                >
                  <i class="agent-panel__dot" />
                  <i class="agent-panel__dot" />
                  <i class="agent-panel__dot" />
                </span>
              </div>
            </div>

            <div
              v-if="agent.pendingQuery"
              class="agent-panel__message agent-panel__message--user"
            >
              <PxAvatar class="agent-panel__avatar" size="small" shape="circle" bordered>
                我
              </PxAvatar>
              <div class="agent-panel__bubble">
                <span class="agent-panel__role">我</span>
                <p class="agent-panel__content">{{ agent.pendingQuery }}</p>
              </div>
            </div>

            <div v-if="agent.thinking" class="agent-panel__message">
              <PxAvatar class="agent-panel__avatar" size="small" shape="circle" bordered>
                AI
              </PxAvatar>
              <div class="agent-panel__bubble agent-panel__bubble--thinking">
                <span class="agent-panel__dots" aria-hidden="true">
                  <i class="agent-panel__dot" />
                  <i class="agent-panel__dot" />
                  <i class="agent-panel__dot" />
                </span>
                {{ AGENT_THINKING_HINT }}
              </div>
            </div>

            <p v-if="agent.restoring" class="agent-panel__empty">
              <PxSpin class="agent-panel__spin" size="small" />
              {{ AGENT_RESTORING_HINT }}
            </p>
          </div>

          <PxAlert
            v-if="agent.error"
            class="agent-panel__alert"
            type="error"
            :title="agent.error"
          >
            {{ agent.error }}
          </PxAlert>

          <footer class="agent-panel__composer">
            <div class="agent-panel__input" @keydown="handleKeydown">
              <PxTextarea
                v-model="draft"
                :rows="3"
                :max-length="AGENT_QUERY_MAX_LENGTH"
                :show-count="true"
                :disabled="agent.busy"
                placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              />
            </div>

            <div class="agent-panel__actions">
              <PxButton variant="text" size="small" native-type="button" @click="handleReset">
                <template #icon>
                  <IconRefresh />
                </template>
                {{ AGENT_RESET_LABEL }}
              </PxButton>

              <PxButton
                v-if="agent.busy"
                class="agent-panel__action"
                theme="warning"
                variant="outline"
                native-type="button"
                @click="agent.stop"
              >
                停止
              </PxButton>
              <PxButton
                v-else
                class="agent-panel__action"
                variant="primary"
                native-type="button"
                :disabled="!canSend"
                @click="submit"
              >
                发送
              </PxButton>
            </div>
          </footer>
        </template>

        <!-- 历史会话视图 -->
        <div v-else class="agent-panel__history">
          <div v-if="agent.sessionsLoading" class="agent-panel__empty">
            <PxSpin class="agent-panel__spin" size="small" />
            {{ AGENT_HISTORY_LOADING_HINT }}
          </div>

          <PxAlert
            v-else-if="agent.sessionsError"
            type="error"
            :title="agent.sessionsError"
          >
            {{ agent.sessionsError }}
          </PxAlert>

          <ul v-else-if="agent.sessions.length > 0" class="agent-panel__sessions">
            <li v-for="session in agent.sessions" :key="session.id">
              <button
                class="agent-panel__session"
                :class="{ 'agent-panel__session--active': session.id === agent.sessionId }"
                type="button"
                :disabled="agent.busy"
                @click="handleRestore(session)"
              >
                <span class="agent-panel__session-title">
                  {{ session.title.trim() || AGENT_SESSION_TITLE_FALLBACK }}
                </span>
                <span class="agent-panel__session-meta">
                  <PxTag
                    v-if="session.id === agent.sessionId"
                    theme="primary"
                    variant="outline"
                    size="small"
                  >
                    当前
                  </PxTag>
                  <span class="agent-panel__session-id">#{{ session.id }}</span>
                </span>
              </button>
            </li>
          </ul>

          <p v-else class="agent-panel__empty">{{ AGENT_HISTORY_EMPTY }}</p>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 右下角悬浮按钮：始终浮在页面之上，不占文档流空间 */
.agent-fab {
  position: fixed;
  right: var(--md-space-6);
  bottom: var(--md-space-6);
  z-index: var(--md-z-dropdown);
  box-shadow: var(--md-shadow-md);
}

/* 浮层侧栏：固定定位，覆盖在页面右侧，不挤占内容区 */
.agent-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--md-z-dropdown);
  display: flex;
  flex-direction: column;
  width: min(380px, 100vw);
  background-color: var(--md-color-surface);
  border-left: 1px solid var(--md-color-border);
  box-shadow: var(--md-shadow-md);
  transition: width var(--md-transition-base);
}

/* 全屏：宽度铺满视口 */
.agent-panel--full {
  width: 100vw;
}

/* 全屏时把内容收在中轴阅读带内，避免长文本横跨整个屏幕 */
.agent-panel--full .agent-panel__header,
.agent-panel--full .agent-panel__messages,
.agent-panel--full .agent-panel__history,
.agent-panel--full .agent-panel__composer {
  padding-inline: max(var(--md-space-6), calc((100% - 900px) / 2));
}

.agent-panel--full .agent-panel__alert {
  margin-inline: max(var(--md-space-6), calc((100% - 900px) / 2));
}

/* 全屏按钮：展开 / 收起共用一个图标，收起时旋转 180° */
.agent-panel__icon {
  display: inline-flex;
}

.agent-panel__icon--flip {
  transform: rotate(180deg);
}

.agent-panel__header {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  flex: none;
  padding: var(--md-space-3) var(--md-space-4);
  border-bottom: 1px solid var(--md-color-border);
}

.agent-panel__heading {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  flex: 1;
  min-width: 0;
  font-weight: 600;
}

.agent-panel__heading-icon {
  font-size: 16px;
}

.agent-panel__header-actions {
  display: inline-flex;
  gap: var(--md-space-1);
  align-items: center;
  flex: none;
}

.agent-panel__messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--md-space-3);
  min-height: 0;
  padding: var(--md-space-4);
  overflow-y: auto;
}

.agent-panel__empty {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  margin: 0;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.agent-panel__empty-icon {
  flex: none;
}

.agent-panel__spin {
  flex: none;
}

.agent-panel__message {
  display: flex;
  gap: var(--md-space-2);
  align-items: flex-start;
}

/* 自己发的消息靠右排布，与 Agent 的回复区分开 */
.agent-panel__message--user {
  flex-direction: row-reverse;
}

.agent-panel__avatar {
  flex: none;
  font-size: var(--md-font-size-xs);
}

.agent-panel__bubble {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-1);
  max-width: 84%;
  padding: var(--md-space-2) var(--md-space-3);
  background-color: var(--md-color-surface-hover);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-md);
}

.agent-panel__message--user .agent-panel__bubble {
  background-color: var(--md-color-primary-soft);
  border-color: transparent;
}

.agent-panel__role {
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
}

.agent-panel__content {
  margin: 0;
  font-size: var(--md-font-size-sm);
  line-height: var(--md-line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* 思考过程：默认折叠，避免长思维链淹没正文 */
.agent-panel__reasoning {
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
}

.agent-panel__reasoning-summary {
  color: var(--md-color-text-disabled);
  cursor: pointer;
  user-select: none;
}

.agent-panel__reasoning-text {
  margin: var(--md-space-1) 0 0;
  padding-left: var(--md-space-2);
  line-height: var(--md-line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border-left: 2px solid var(--md-color-border);
}

/* 工具调用：与思考过程一样默认折叠，展开后按「名称 / 参数 / 返回结果」分组 */
.agent-panel__tools {
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
}

.agent-panel__tools-summary {
  color: var(--md-color-text-disabled);
  cursor: pointer;
  user-select: none;
}

.agent-panel__tool {
  margin-top: var(--md-space-1);
  padding-left: var(--md-space-2);
  border-left: 2px solid var(--md-color-border);
}

.agent-panel__tool-block {
  margin: var(--md-space-1) 0 0;
}

.agent-panel__tool-label {
  margin-right: var(--md-space-1);
  color: var(--md-color-text-disabled);
}

.agent-panel__tool-text {
  display: inline-block;
  max-height: 220px;
  overflow: auto;
  font-family: var(--md-font-mono);
  line-height: var(--md-line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  vertical-align: top;
}

.agent-panel__bubble--thinking {
  flex-direction: row;
  gap: var(--md-space-2);
  align-items: center;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text-secondary);
}

.agent-panel__dots {
  display: inline-flex;
  gap: 3px;
}

.agent-panel__dot {
  width: 5px;
  height: 5px;
  background-color: var(--md-color-text-secondary);
  border-radius: var(--md-radius-full);
  animation: agent-panel-blink 1.2s infinite ease-in-out;
}

.agent-panel__dot:nth-child(2) {
  animation-delay: 0.2s;
}

.agent-panel__dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes agent-panel-blink {
  0%,
  80%,
  100% {
    opacity: 0.25;
  }

  40% {
    opacity: 1;
  }
}

.agent-panel__alert {
  flex: none;
  margin: 0 var(--md-space-4) var(--md-space-3);
}

.agent-panel__composer {
  display: flex;
  flex-direction: column;
  flex: none;
  gap: var(--md-space-2);
  padding: var(--md-space-3) var(--md-space-4);
  border-top: 1px solid var(--md-color-border);
}

.agent-panel__actions {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
}

.agent-panel__action {
  margin-left: auto;
}

/* 历史会话列表 */
.agent-panel__history {
  flex: 1;
  min-height: 0;
  padding: var(--md-space-4);
  overflow-y: auto;
}

.agent-panel__sessions {
  display: flex;
  flex-direction: column;
  gap: var(--md-space-2);
  padding: 0;
  margin: 0;
  list-style: none;
}

.agent-panel__session {
  display: flex;
  gap: var(--md-space-2);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--md-space-2) var(--md-space-3);
  text-align: left;
  background-color: var(--md-color-surface-hover);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-md);
  transition: border-color var(--md-transition-fast);
}

.agent-panel__session:hover:not(:disabled) {
  border-color: var(--md-color-primary);
}

.agent-panel__session:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.agent-panel__session--active {
  border-color: var(--md-color-primary);
}

.agent-panel__session-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-panel__session-meta {
  display: inline-flex;
  gap: var(--md-space-2);
  align-items: center;
  flex: none;
}

.agent-panel__session-id {
  max-width: 10ch;
  overflow: hidden;
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 侧栏滑入 / 滑出 */
.agent-panel-enter-active,
.agent-panel-leave-active {
  transition: transform var(--md-transition-base);
}

.agent-panel-enter-from,
.agent-panel-leave-to {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .agent-panel__dot {
    animation: none;
  }

  .agent-panel-enter-active,
  .agent-panel-leave-active {
    transition: none;
  }
}
</style>
