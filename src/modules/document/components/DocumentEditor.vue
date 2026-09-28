<script setup lang="ts">
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 纯文本编辑器：基于 CodeMirror 6（模块化的轻量编辑器，非 Monaco）。
 *
 * 为什么不用手写 textarea：受控 textarea 会打断中文输入法合成、清空原生撤销栈，
 * 且远端更新只能按位置截断光标。CodeMirror 原生处理 IME、撤销、选区映射与无障碍。
 *
 * 组件只负责「显示 + 编辑 + 上抛」：本地改动通过 `update:modelValue` 上抛完整文本，
 * 远端改动以带 `Transaction.remote` 标注的事务回填，不进入撤销栈，光标自动映射。
 * 本地改动**同步上抛**（含 IME 合成过程），保证 store 里的文本始终与编辑器一致，
 * 否则远端帧到达时会把尚未上抛的输入覆盖掉。
 * 不引入 `@codemirror/collab`：它的冲突合并规则与后端 `pkg/ot` 不一致，协作仍以
 * `ot/ot-client.ts` 的状态机为准。
 */
const props = defineProps<{
  /** 编辑器文本（受控） */
  modelValue: string
  /** 只读态：未进入协作会话时禁止编辑 */
  disabled?: boolean
  /** 标题栏展示的文件名 */
  fileName?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/** 可编辑开关用 Compartment 动态重配，避免重建整个 EditorView */
const editableCompartment = new Compartment()

function editableExtensions(disabled: boolean) {
  return [EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)]
}

/** 用设计令牌适配明暗主题 */
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--md-font-size-sm)',
    backgroundColor: 'var(--md-color-surface)',
    color: 'var(--md-color-text)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--md-font-mono)',
    lineHeight: 'var(--md-line-height)',
  },
  '.cm-content': { caretColor: 'var(--md-color-primary)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--md-color-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--md-color-bg)',
    color: 'var(--md-color-text-disabled)',
    borderRight: '1px solid var(--md-color-border)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--md-color-primary-soft)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--md-color-primary-soft)',
    color: 'var(--md-color-text)',
  },
  // 选中态走 CodeMirror 的主题钩子，不穿透第三方内部 DOM
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--md-color-selection)',
  },
})

const containerRef = ref<HTMLElement | null>(null)
const cursorLine = ref(1)
const cursorColumn = ref(1)
const charCount = ref(0)

let view: EditorView | null = null

/** 光标 / 字数状态栏刷新 */
function updateCursor(): void {
  const editor = view
  if (!editor) return

  const head = editor.state.selection.main.head
  const line = editor.state.doc.lineAt(head)
  cursorLine.value = line.number
  cursorColumn.value = head - line.from + 1
  charCount.value = editor.state.doc.length
}

function handleUpdate(update: ViewUpdate): void {
  if (update.docChanged) {
    const remote = update.transactions.some((transaction) =>
      transaction.annotation(Transaction.remote),
    )
    // 本地改动同步上抛；远端改动由 watch 触发，不能回抛形成环。
    if (!remote && !props.disabled) {
      const text = update.state.doc.toString()
      if (text !== props.modelValue) emit('update:modelValue', text)
    }
    updateCursor()
    return
  }

  if (update.selectionSet) updateCursor()
}

/**
 * 计算把 `oldText` 变成 `newText` 的最小替换区间，交给 CodeMirror 应用。
 * 只按「公共前缀 / 后缀」裁剪，并保证不切开代理对（emoji 等）。
 */
function minimalChange(oldText: string, newText: string): { from: number; to: number; insert: string } {
  const oldLength = oldText.length
  const newLength = newText.length
  const limit = Math.min(oldLength, newLength)

  let start = 0
  while (start < limit && oldText.charCodeAt(start) === newText.charCodeAt(start)) start += 1
  if (start > 0 && isLowSurrogate(newText.charCodeAt(start))) start -= 1

  let end = 0
  while (
    end < limit - start &&
    oldText.charCodeAt(oldLength - 1 - end) === newText.charCodeAt(newLength - 1 - end)
  ) {
    end += 1
  }
  if (end > 0 && isLowSurrogate(newText.charCodeAt(newLength - end))) end -= 1

  return { from: start, to: oldLength - end, insert: newText.slice(start, newLength - end) }
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

// 外部文本变化（init 或远端算子）：作为 remote 事务回填，不进入撤销栈。
watch(
  () => props.modelValue,
  (value) => {
    const editor = view
    if (!editor || value === editor.state.doc.toString()) return

    editor.dispatch({
      changes: minimalChange(editor.state.doc.toString(), value),
      annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
    })
    updateCursor()
  },
)

// 只读态切换
watch(
  () => props.disabled,
  (disabled) => {
    view?.dispatch({
      effects: editableCompartment.reconfigure(editableExtensions(Boolean(disabled))),
    })
  },
)

onMounted(() => {
  const parent = containerRef.value
  if (!parent) return

  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        editableCompartment.of(editableExtensions(Boolean(props.disabled))),
        EditorView.contentAttributes.of({ 'aria-label': props.fileName || '文档正文' }),
        editorTheme,
        EditorView.updateListener.of(handleUpdate),
      ],
    }),
    parent,
  })

  updateCursor()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div class="document-editor" :class="{ 'document-editor--disabled': disabled }">
    <header class="document-editor__titlebar">
      <span class="document-editor__dots" aria-hidden="true">
        <i class="document-editor__dot document-editor__dot--red" />
        <i class="document-editor__dot document-editor__dot--yellow" />
        <i class="document-editor__dot document-editor__dot--green" />
      </span>
      <span class="document-editor__filename">{{ fileName || 'document.txt' }}</span>
      <span class="document-editor__badge">纯文本</span>
    </header>

    <div ref="containerRef" class="document-editor__surface" />

    <footer class="document-editor__statusbar">
      <span class="document-editor__status-item">
        {{ disabled ? '只读（等待连接）' : '编辑中' }}
      </span>
      <span class="document-editor__status-item">行 {{ cursorLine }}，列 {{ cursorColumn }}</span>
      <span class="document-editor__status-item">{{ charCount }} 字符 · UTF-8</span>
    </footer>
  </div>
</template>

<style scoped>
.document-editor {
  display: flex;
  flex-direction: column;
  height: min(70vh, 720px);
  min-height: 420px;
  overflow: hidden;
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border-strong);
  border-radius: var(--md-radius-md);
}

.document-editor--disabled {
  opacity: 0.85;
}

.document-editor__titlebar {
  display: flex;
  gap: var(--md-space-3);
  align-items: center;
  padding: var(--md-space-2) var(--md-space-3);
  background-color: var(--md-color-bg);
  border-bottom: 1px solid var(--md-color-border);
}

.document-editor__dots {
  display: inline-flex;
  gap: var(--md-space-1);
}

.document-editor__dot {
  width: 10px;
  height: 10px;
  border-radius: var(--md-radius-full);
}

.document-editor__dot--red {
  background-color: var(--md-color-danger);
}

.document-editor__dot--yellow {
  background-color: var(--md-color-warning);
}

.document-editor__dot--green {
  background-color: var(--md-color-success);
}

.document-editor__filename {
  font-family: var(--md-font-mono);
  font-size: var(--md-font-size-sm);
  color: var(--md-color-text);
}

.document-editor__badge {
  padding: 0 var(--md-space-2);
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
  background-color: var(--md-color-surface);
  border: 1px solid var(--md-color-border);
  border-radius: var(--md-radius-full);
}

.document-editor__surface {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.document-editor__statusbar {
  display: flex;
  gap: var(--md-space-4);
  align-items: center;
  padding: var(--md-space-1) var(--md-space-3);
  font-size: var(--md-font-size-xs);
  color: var(--md-color-text-secondary);
  background-color: var(--md-color-bg);
  border-top: 1px solid var(--md-color-border);
}

.document-editor__status-item:last-child {
  margin-left: auto;
}
</style>
