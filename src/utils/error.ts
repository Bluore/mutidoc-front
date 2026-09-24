/**
 * 统一的错误信息提取：业务层 catch 后只需要拿到可展示的中文文案。
 * 纯函数，不依赖 Vue / Pinia / Router，可被任意模块复用。
 */
export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}
