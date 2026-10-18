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

import MarkdownText from '@/components/MarkdownText.vue'

import {
  AGENT_APPROVE_LABEL,
  AGENT_CONTEXT_LABEL,
  AGENT_EMPTY_HINT,
  AGENT_FEEDBACK_MAX_LENGTH,
  AGENT_FEEDBACK_PLACEHOLDER,
  AGENT_HISTORY_EMPTY,
  AGENT_HISTORY_LABEL,
  AGENT_HISTORY_LOADING_HINT,
  AGENT_INTERRUPT_FALLBACK,
  AGENT_INTERRUPT_LABEL,
  AGENT_PANEL_TITLE,
  AGENT_QUERY_MAX_LENGTH,
  AGENT_REASONING_LABEL,
  AGENT_REJECT_LABEL,
  AGENT_RESET_LABEL,
  AGENT_RESTORING_HINT,
  AGENT_ROLE_LABEL,
  AGENT_SESSION_TITLE_FALLBACK,
  AGENT_STATUS_META,
  AGENT_THINKING_HINTS,
  AGENT_TOOL_ARGS_LABEL,
  AGENT_TOOL_CALLS_LABEL,
  AGENT_TOOL_RESULT_LABEL,
} from '../constants'
import { useAgentStore } from '../stores/agent'
import type {
  AgentCondition,
  AgentInterrupt,
  AgentMessage,
  AgentMessageSegment,
  AgentSession,
} from '../types'
import { splitUserContext } from '../user-context'

/**
 * MuDo 智能助手：右下角悬浮按钮 + 右侧浮层侧栏。
 *
 * 侧栏以 `position: fixed` 浮在页面上（Teleport 到 body），**不参与文档流、不挤占
 * 页面空间**；默认收起，由右下角悬浮按钮打开。组件只负责展示与交互，会话编排都在
 * `stores/agent.ts` 中完成，不直接接触 REST / SSE。
 *
 * 侧栏有两个视图：对话（默认）与历史会话；历史视图里选择会话即恢复该会话。
 */
const props = defineProps<{
  /**
   * 宿主页面提供的环境上下文解析器：每次追问时调用一次，返回本轮 `condition`。
   * 组件本身不感知文档 / 用户，从而保持可复用；缺省时不携带上下文（等价于 `{}`）。
   */
  resolveCondition?: () => AgentCondition
  /**
   * 当前用户的展示名：用户消息用它代替泛称「我」，缺省时回退到 `AGENT_ROLE_LABEL.user`。
   * 由宿主页面传入（组件不直接依赖用户 store，保持可复用）。
   */
  selfName?: string
}>()

const agent = useAgentStore()

/** 用户消息的角色名：优先当前用户名 */
const userLabel = computed(() => props.selfName?.trim() || AGENT_ROLE_LABEL.user)
/** 用户头像占位：取用户名首字符（与用户模块头像占位规则一致） */
const userInitial = computed(() => userLabel.value.slice(0, 1).toUpperCase() || '?')

/** 侧栏展开状态（本地 UI 状态，不进 store） */
const open = ref(false)
/** 是否全屏（宽度铺满视口） */
const fullscreen = ref(false)
/** 当前视图：对话 / 历史会话 */
const view = ref<'chat' | 'history'>('chat')

/** 输入草稿 */
const draft = ref('')
/** 人工确认的补充意见草稿 */
const feedbackDraft = ref('')
/** 本次点击的确认按钮：用于只让被点击的那个按钮显示 loading */
const feedbackDecision = ref<boolean | null>(null)
const messageListRef = ref<HTMLElement | null>(null)

/** 等待回复时的随机文案：每次进入思考态时重新挑一条 */
const thinkingHint = ref(AGENT_THINKING_HINTS[0])

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
  }:${tailLength}:${agent.interrupts.length}`
})

function roleLabel(message: AgentMessage): string {
  if (message.role === 'user') return userLabel.value
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

/**
 * 消息的渲染视图：用户消息把正文与「环境上下文」拆开，其余消息原样透传。
 * 在 computed 里一次性完成字符串截取，模板直接取字段，避免每处重复解析。
 */
interface AgentMessageView {
  key: string
  message: AgentMessage
  user: boolean
  /** 仅用户消息：剥离 `<context>` 块后的正文 */
  text: string
  /** 仅用户消息：截取出的上下文（去标签）；为空表示没有 */
  context: string
}

const messageViews = computed<AgentMessageView[]>(() =>
  agent.messages.map((message, index) => {
    const user = isUser(message)
    const parsed = user ? splitUserContext(messageContent(message)) : null
    return {
      key: `${index}-${message.role}`,
      message,
      user,
      text: parsed ? parsed.text : '',
      context: parsed ? parsed.context : '',
    }
  }),
)

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

/** 正在输出正文的助手气泡：显示打字动画（思考 / 工具调用阶段也复用；待确认时停下） */
function isAnswering(message: AgentMessage, index: number): boolean {
  return (
    agent.busy &&
    !agent.awaiting &&
    message.role === 'assistant' &&
    !messageContent(message) &&
    index === agent.messages.length - 1
  )
}

/** 打断卡片文案：优先使用触发方给的 message，缺失时用通用询问。 */
function interruptMessage(interrupt: AgentInterrupt): string {
  return interrupt.info.message?.trim() || AGENT_INTERRUPT_FALLBACK
}

/** 同意 / 拒绝当前待确认操作，并附带可选的补充意见。 */
async function respondInterrupt(approved: boolean): Promise<void> {
  if (agent.feedbackSubmitting) return
  feedbackDecision.value = approved
  try {
    await agent.submitFeedback(approved, feedbackDraft.value)
  } finally {
    feedbackDecision.value = null
  }
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
  // 携带宿主页面解析出的环境上下文（create / resume 均透传）
  await agent.ask(query, props.resolveCondition?.())
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

/** 待确认项变化（新的打断 / 已处理）时清空补充意见草稿 */
watch(
  () => agent.interrupts.map((item) => item.id).join(','),
  () => {
    feedbackDraft.value = ''
    feedbackDecision.value = null
  },
)

/** 每次进入「等待回复」时换一条随机文案，让等待过程更有趣 */
watch(
  () => agent.thinking,
  (thinking) => {
    if (!thinking) return
    thinkingHint.value =
      AGENT_THINKING_HINTS[Math.floor(Math.random() * AGENT_THINKING_HINTS.length)]
  },
)

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
      :aria-label="`打开 ${AGENT_PANEL_TITLE}`"
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
        :aria-label="`${AGENT_PANEL_TITLE}侧栏`"
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
              :aria-label="`关闭 ${AGENT_PANEL_TITLE}`"
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
              v-if="!agent.hasConversation && !agent.thinking && !agent.restoring && !agent.awaiting"
              class="agent-panel__empty"
            >
              <IconSparkles class="agent-panel__empty-icon" />
              {{ AGENT_EMPTY_HINT }}
            </p>

            <div
              v-for="(item, index) in messageViews"
              :key="item.key"
              class="agent-panel__message"
              :class="{ 'agent-panel__message--user': item.user }"
            >
              <PxAvatar class="agent-panel__avatar" size="small" shape="circle" bordered>
                <template v-if="item.user">{{ userInitial }}</template>
                <IconRobot v-else />
              </PxAvatar>
              <div class="agent-panel__bubble">
                <span class="agent-panel__role">{{ roleLabel(item.message) }}</span>

                <!-- 用户消息：正文与「环境上下文」拆开，上下文默认折叠 -->
                <template v-if="item.user">
                  <details v-if="item.context" class="agent-panel__context">
                    <summary class="agent-panel__context-summary">
                      {{ AGENT_CONTEXT_LABEL }}
                    </summary>
                    <p class="agent-panel__context-text">{{ item.context }}</p>
                  </details>
                  <MarkdownText
                    v-if="item.text"
                    class="agent-panel__content"
                    :source="item.text"
                  />
                </template>

                <!-- 助手 / 其它消息：按片段顺序穿插渲染 -->
                <template v-else>
                  <template v-for="(segment, segIndex) in item.message.segments" :key="segIndex">
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
                    <MarkdownText
                      v-else
                      class="agent-panel__content"
                      :source="segment.text"
                    />
                  </template>
                </template>
                <span
                  v-if="isAnswering(item.message, index)"
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
                {{ userInitial }}
              </PxAvatar>
              <div class="agent-panel__bubble">
                <span class="agent-panel__role">{{ userLabel }}</span>
                <MarkdownText class="agent-panel__content" :source="agent.pendingQuery" />
              </div>
            </div>

            <!-- 人工确认（Human-in-the-Loop）：同意 / 拒绝后会话从打断点继续 -->
            <div
              v-if="agent.awaiting"
              class="agent-panel__message agent-panel__message--interrupt"
            >
              <PxAvatar class="agent-panel__avatar" size="small" shape="circle" bordered>
                <IconRobot />
              </PxAvatar>
              <div class="agent-panel__bubble agent-panel__bubble--interrupt">
                <span class="agent-panel__role">{{ AGENT_INTERRUPT_LABEL }}</span>
                <p
                  v-for="interrupt in agent.interrupts"
                  :key="interrupt.id"
                  class="agent-panel__interrupt-text"
                >
                  {{ interruptMessage(interrupt) }}
                </p>

                <div class="agent-panel__interrupt-feedback">
                  <PxTextarea
                    v-model="feedbackDraft"
                    :rows="2"
                    :max-length="AGENT_FEEDBACK_MAX_LENGTH"
                    :show-count="true"
                    :disabled="agent.feedbackSubmitting"
                    :placeholder="AGENT_FEEDBACK_PLACEHOLDER"
                  />
                </div>

                <div class="agent-panel__interrupt-actions">
                  <PxButton
                    theme="danger"
                    variant="outline"
                    size="small"
                    native-type="button"
                    :disabled="agent.feedbackSubmitting"
                    :loading="agent.feedbackSubmitting && feedbackDecision === false"
                    @click="respondInterrupt(false)"
                  >
                    {{ AGENT_REJECT_LABEL }}
                  </PxButton>
                  <PxButton
                    size="small"
                    native-type="button"
                    :disabled="agent.feedbackSubmitting"
                    :loading="agent.feedbackSubmitting && feedbackDecision === true"
                    @click="respondInterrupt(true)"
                  >
                    {{ AGENT_APPROVE_LABEL }}
                  </PxButton>
                </div>
              </div>
            </div>

            <div v-if="agent.thinking" class="agent-panel__message">
              <PxAvatar class="agent-panel__avatar" size="small" shape="circle" bordered>
                <IconRobot />
              </PxAvatar>
              <div class="agent-panel__bubble agent-panel__bubble--thinking">
                <span class="agent-panel__dots" aria-hidden="true">
                  <i class="agent-panel__dot" />
                  <i class="agent-panel__dot" />
                  <i class="agent-panel__dot" />
                </span>
                {{ thinkingHint }}
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
                v-if="agent.busy && !agent.awaiting"
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

/* 自己发的消息靠右排布，与 MuDo 的回复区分开 */
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

/* 正文气泡：具体排版（段落 / 标题 / 列表 / 代码等）由全局 .md-markdown 负责 */
.agent-panel__content {
  margin: 0;
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

/* 用户消息里的「环境上下文」：默认折叠，气泡只留用户真正输入的内容 */
.agent-panel__context {
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
}

.agent-panel__context-summary {
  color: var(--md-color-text-disabled);
  cursor: pointer;
  user-select: none;
}

.agent-panel__context-text {
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

/* 人工确认卡片：沿用消息气泡布局，整宽展示说明、补充意见与操作按钮 */
.agent-panel__message--interrupt .agent-panel__bubble {
  flex: 1;
  max-width: 100%;
  border-color: var(--md-color-warning);
}

.agent-panel__interrupt-text {
  margin: 0;
  font-size: var(--md-font-size-sm);
  line-height: var(--md-line-height);
  overflow-wrap: anywhere;
}

.agent-panel__interrupt-feedback {
  margin-top: var(--md-space-1);
}

.agent-panel__interrupt-actions {
  display: flex;
  gap: var(--md-space-2);
  justify-content: flex-end;
  margin-top: var(--md-space-1);
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
