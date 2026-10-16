<script setup lang="ts">
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { Compartment, EditorState, StateEffect, StateField, Transaction } from '@codemirror/state'
import type { Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { byteOffsetToCodeUnits } from '../ot/ot'
import type { RemoteCursor } from '../types'

/**
 * 纯文本编辑器：基于 CodeMirror 6（模块化的轻量编辑器，非 Monaco）。
 *
 * 为什么不用手写 textarea：受控 textarea 会打断中文输入法合成、清空原生撤销栈，
 * 且远端更新只能按位置截断光标。CodeMirror 原生处理 IME、撤销、选区映射与无障碍。
 *
 * 组件只负责「显示 + 编辑 + 采样」：正文不再由输入事件上抛，store 每 500ms 调用
 * `getText()` 读取当前全文，与前端本地副本比较后决定是否成算子；远端改动以带
 * `Transaction.remote` 标注的事务回填，不进入撤销栈，光标自动映射。
 * 远端用户的选区与光标（`remoteCursors`，UTF-8 字节偏移）经 StateField 画成装饰，
 * 本地选区变化则通过 `cursor-change` 上抛，由 store 换算并节流上报。
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
  /** 远端用户的光标 / 选区（已换算为编辑器码元坐标） */
  remoteCursors?: RemoteCursor[]
}>()

const emit = defineEmits<{
  /** 本地选区变化，参数为编辑器码元坐标下的 anchor / head */
  'cursor-change': [anchor: number, head: number]
}>()

/** 可编辑开关用 Compartment 动态重配，避免重建整个 EditorView */
const editableCompartment = new Compartment()

function editableExtensions(disabled: boolean) {
  return [EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)]
}

/* -------------------------------------------------------------------------- */
/* 远端光标                                                                    */
/* -------------------------------------------------------------------------- */

/** 把位置夹在文档范围内，避免远端坐标系与本地文本暂时不一致时抛错。 */
function clampPosition(position: number, docLength: number): number {
  if (!Number.isFinite(position)) return 0
  return Math.max(0, Math.min(docLength, Math.trunc(position)))
}

/** 远端光标 widget：一根竖线加一个悬浮昵称。 */
class RemoteCaretWidget extends WidgetType {
  readonly name: string
  readonly color: string

  constructor(name: string, color: string) {
    super()
    this.name = name
    this.color = color
  }

  eq(other: RemoteCaretWidget): boolean {
    return other.name === this.name && other.color === this.color
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = 'document-editor__remote-caret'
    wrap.style.setProperty('--document-editor-remote-color', this.color)
    wrap.setAttribute('aria-hidden', 'true')

    if (this.name) {
      const label = document.createElement('span')
      label.className = 'document-editor__remote-caret-label'
      label.textContent = this.name
      wrap.appendChild(label)
    }

    return wrap
  }

  /** 光标 widget 不参与交互，点击 / 拖拽应落到下面的文本上。 */
  ignoreEvent(): boolean {
    return true
  }
}

/** 每次远端光标变化时，用一个 effect 整体替换装饰集合。 */
const setRemoteCursors = StateEffect.define<RemoteCursor[]>()

/**
 * 由远端光标列表构造 CodeMirror 装饰。
 *
 * 传入的偏移是 UTF-8 字节，这里按 `text`（即本事务后的文档）换算成码元并夹取范围，
 * 保证新文档与装饰位置在同一次事务里保持一致。
 */
function buildCursorDecorations(text: string, cursors: RemoteCursor[]): DecorationSet {
  const docLength = text.length
  const ranges: Range<Decoration>[] = []

  for (const cursor of cursors) {
    const anchor = clampPosition(byteOffsetToCodeUnits(text, cursor.anchor), docLength)
    const head = clampPosition(byteOffsetToCodeUnits(text, cursor.head), docLength)
    const from = Math.min(anchor, head)
    const to = Math.max(anchor, head)

    if (from < to) {
      ranges.push(
        Decoration.mark({
          class: 'document-editor__remote-selection',
          attributes: { style: `--document-editor-remote-color: ${cursor.color}` },
        }).range(from, to),
      )
    }

    // 普通光标与选区终点都画一根竖线。
    ranges.push(
      Decoration.widget({
        widget: new RemoteCaretWidget(cursor.name, cursor.color),
        side: 1,
      }).range(head, head),
    )
  }

  return Decoration.set(ranges, true)
}

/**
 * 远端光标装饰的状态字段：位置随本地事务自动映射，收到 effect 时整体替换。
 * 用 StateField 而不是直接操作 DOM，滚动 / 换行 / 撤销都交给 CodeMirror 处理。
 */
const remoteCursorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    decorations = decorations.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(setRemoteCursors)) {
        return buildCursorDecorations(transaction.state.doc.toString(), effect.value)
      }
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

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

/** 上抛选区变化；store 负责节流与换算成 UTF-8 字节偏移。 */
function emitCursor(): void {
  const editor = view
  if (!editor || props.disabled) return
  const selection = editor.state.selection.main
  emit('cursor-change', selection.anchor, selection.head)
}

function handleUpdate(update: ViewUpdate): void {
  // 本地改动不再上抛给 store：正文由 store 定时采样 `getText()` 与本地副本比较后
  // 自行决定是否成算子，输入事件不再参与计算。
  if (update.docChanged) {
    updateCursor()
    emitCursor()
    return
  }

  if (update.selectionSet) {
    updateCursor()
    emitCursor()
  }
}

/**
 * 读取编辑器当前全文，供 store 定时采样。
 *
 * 这是「文本框内容」的唯一出口：store 不依赖任何输入事件，只按固定间隔调用它并与
 * `OtClient` 的本地副本比较。
 */
function getText(): string {
  return view?.state.doc.toString() ?? props.modelValue
}

/**
 * 读取当前选区与选中文本（编辑器码元坐标），供上层组装 Agent 环境上下文
 * （`cursor_anchor` / `cursor_select`）。无编辑器时返回空选区。
 */
function getSelection(): { anchor: number; head: number; text: string } {
  const editor = view
  if (!editor) return { anchor: 0, head: 0, text: '' }
  const selection = editor.state.selection.main
  return {
    anchor: selection.anchor,
    head: selection.head,
    text: editor.state.sliceDoc(selection.from, selection.to),
  }
}

defineExpose({ getText, getSelection })

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
// 这里不动远端光标装饰：本地输入时交给 StateField 自行映射；远端帧带来的新光标
// 由下面的 remoteCursors watcher 单独刷新。
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

// 远端光标 / 在线用户变化时刷新装饰；此时文档已由上面的 watcher 更新到最新。
watch(
  () => props.remoteCursors,
  (cursors) => {
    view?.dispatch({ effects: setRemoteCursors.of(cursors ?? []) })
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
        remoteCursorField,
        EditorView.contentAttributes.of({ 'aria-label': props.fileName || '文档正文' }),
        editorTheme,
        EditorView.updateListener.of(handleUpdate),
      ],
    }),
    parent,
  })

  updateCursor()
  view.dispatch({ effects: setRemoteCursors.of(props.remoteCursors ?? []) })
  emitCursor()
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

/* CodeMirror 在运行时构造远端光标 DOM，不在组件模板内，scoped 选择器命不中，
   因此这里用 :deep 穿透第三方内部结构。 */
:deep(.document-editor__remote-caret) {
  position: relative;
  display: inline-block;
  width: 0;
  height: 1.4em;
  pointer-events: none;
  vertical-align: text-bottom;
}

:deep(.document-editor__remote-caret::before) {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 2px;
  height: 1.4em;
  content: '';
  background-color: var(--document-editor-remote-color, var(--md-color-primary));
}

:deep(.document-editor__remote-caret-label) {
  position: absolute;
  bottom: 100%;
  left: 0;
  padding: 0 var(--md-space-1);
  font-size: var(--md-font-size-xs);
  line-height: 1.5;
  color: var(--md-color-text-inverse);
  white-space: nowrap;
  background-color: var(--document-editor-remote-color, var(--md-color-primary));
  border-radius: var(--md-radius-sm) var(--md-radius-sm) var(--md-radius-sm) 0;
  transform: translateY(-2px);
}

:deep(.document-editor__remote-selection) {
  background-color: color-mix(
    in srgb,
    var(--document-editor-remote-color, var(--md-color-primary)) 30%,
    transparent
  );
}
</style>
