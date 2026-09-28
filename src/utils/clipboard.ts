/**
 * 复制文本到剪贴板。
 *
 * 优先使用异步 Clipboard API；该 API 只在**安全上下文**（https / localhost）可用，
 * 局域网 http 调试时不可用，此时退回 `document.execCommand('copy')` 兜底。
 * 纯浏览器能力封装，不依赖 Vue / Pinia / Router，可被任意模块复用。
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 用户拒绝授权等异常，继续走兜底方案
    }
  }
  return legacyCopy(text)
}

/** 已废弃但兼容性好的兜底方案：借临时 textarea + execCommand 完成复制 */
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)

  let ok = false
  try {
    textarea.select()
    ok = document.execCommand('copy')
  } catch {
    ok = false
  } finally {
    document.body.removeChild(textarea)
  }
  return ok
}
