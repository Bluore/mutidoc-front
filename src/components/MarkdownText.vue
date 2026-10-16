<script setup lang="ts">
import { computed } from 'vue'

import { renderMarkdown } from '@/utils/markdown'

/**
 * Markdown 文本渲染（跨模块复用组件）。
 *
 * 把 Markdown 源文本渲染成已消毒的 HTML（见 `@/utils/markdown`），供对话气泡、
 * 说明文字等场景复用。内容样式来自全局 `.md-markdown`（`src/styles/markdown.css`）：
 * `v-html` 注入的节点不带组件 scoped 属性，无法被局部样式命中，故样式放在全局。
 */
const props = withDefaults(
  defineProps<{
    /** Markdown 源文本 */
    source?: string
  }>(),
  { source: '' },
)

// renderMarkdown 内部已用 markdown-it + DOMPurify 双重处理，输出可安全交由 v-html。
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <div class="md-markdown" v-html="html" />
</template>
