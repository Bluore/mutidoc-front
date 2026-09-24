<script setup lang="ts">
/**
 * 全局基础按钮（跨模块复用组件）。
 * 通过 variant / size 控制外观，样式全部 scoped，不会影响使用方的其它元素。
 */
interface Props {
  variant?: 'primary' | 'default' | 'danger'
  size?: 'sm' | 'md'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

function handleClick(event: MouseEvent) {
  if (props.loading || props.disabled) return
  emit('click', event)
}
</script>

<template>
  <button
    class="base-button"
    :class="[`base-button--${variant}`, `base-button--${size}`, { 'is-loading': loading }]"
    :type="type"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="base-button__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--md-space-2);
  font-weight: 500;
  line-height: 1;
  color: var(--md-color-text);
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border-strong);
  border-radius: var(--md-radius-md);
  transition:
    background-color var(--md-transition-fast),
    border-color var(--md-transition-fast),
    color var(--md-transition-fast);
}

.base-button:hover:not(:disabled) {
  background-color: var(--md-color-surface-hover);
  border-color: var(--md-color-primary);
}

.base-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.base-button--md {
  height: 36px;
  padding: 0 var(--md-space-4);
  font-size: var(--md-font-size-md);
}

.base-button--sm {
  height: 28px;
  padding: 0 var(--md-space-3);
  font-size: var(--md-font-size-sm);
}

.base-button--primary {
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-primary);
  border-color: var(--md-color-primary);
}

.base-button--primary:hover:not(:disabled) {
  background-color: var(--md-color-primary-hover);
  border-color: var(--md-color-primary-hover);
}

.base-button--danger {
  color: var(--md-color-danger);
  background-color: transparent;
  border-color: var(--md-color-danger);
}

.base-button--danger:hover:not(:disabled) {
  color: var(--md-color-text-inverse);
  background-color: var(--md-color-danger);
  border-color: var(--md-color-danger);
}

.base-button__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentcolor;
  border-top-color: transparent;
  border-radius: var(--md-radius-full);
  animation: base-button-spin 0.6s linear infinite;
}

@keyframes base-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
