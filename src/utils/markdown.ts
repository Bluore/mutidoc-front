import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

/**
 * Markdown 渲染（纯函数，与业务无关）。
 *
 * 用 markdown-it 解析、DOMPurify 消毒，产出可安全交给 `v-html` 的 HTML 字符串。
 * 关闭原始 HTML（`html: false`）后再消毒，双重防注入；`breaks: true` 让单个换行
 * 也渲染成 `<br>`，更贴合对话气泡的阅读习惯；`linkify: true` 自动识别裸链接。
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

// 链接统一新标签打开，并补 rel 防止反向跳转（tabnabbing）。
const renderLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer nofollow')
  return renderLinkOpen(tokens, idx, options, env, self)
}

/**
 * 渲染结果缓存：流式更新会反复渲染同一段文本前缀，缓存避免重复解析。
 * 用体积上限而非 LRU，超过即整体清空，逻辑简单且内存有界。
 */
const CACHE_LIMIT = 200
const cache = new Map<string, string>()

/** 把 Markdown 源文本渲染为已消毒的 HTML 字符串。 */
export function renderMarkdown(source: string): string {
  const text = source ?? ''
  const hit = cache.get(text)
  if (hit !== undefined) return hit

  const html = DOMPurify.sanitize(md.render(text), { ADD_ATTR: ['target'] })

  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(text, html)
  return html
}
