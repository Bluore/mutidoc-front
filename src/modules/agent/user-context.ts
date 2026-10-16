/**
 * 用户消息里的「环境上下文」块。
 *
 * 服务端会把本轮提问的环境上下文以 `<context>…</context>` 的形式拼在用户消息正文
 * 前（历史回放同样如此）。视图渲染时用 `splitUserContext` 把这段**字符串截取**出来：
 * 气泡只展示用户真正输入的内容，上下文收进一个折叠区。
 */

/** 上下文块的起止标记（后端约定，固定字面量） */
const CONTEXT_OPEN = '<context>'
const CONTEXT_CLOSE = '</context>'

/** `splitUserContext` 的拆分结果 */
export interface SplitUserContext {
  /** 剥离上下文块后的正文（已 trim） */
  text: string
  /** 截取出的上下文内容（不含标签、已 trim）；没有上下文块时为空串 */
  context: string
}

/**
 * 把一条用户消息拆成「正文 + 上下文」两部分（纯函数）。
 *
 * 只截取**第一次**出现的 `<context>…</context>`；标记不完整（缺开始或结束）时视为
 * 普通正文原样返回，避免误伤用户自己输入的同名文本。
 */
export function splitUserContext(raw: string): SplitUserContext {
  const start = raw.indexOf(CONTEXT_OPEN)
  if (start === -1) return { text: raw.trim(), context: '' }

  const end = raw.indexOf(CONTEXT_CLOSE, start + CONTEXT_OPEN.length)
  if (end === -1) return { text: raw.trim(), context: '' }

  const context = raw.slice(start + CONTEXT_OPEN.length, end).trim()
  const text = (raw.slice(0, start) + raw.slice(end + CONTEXT_CLOSE.length)).trim()
  return { text, context }
}
