import { env } from '@/config/env'

/**
 * 协作编辑（WebSocket）API 层：只负责拼接端点 URL。
 *
 * 端点约定（后端接口仍在开发中）：
 * - 文档化路径为 `POST /api/doc/v1/document/edit?document_id=<id>`，浏览器
 *   `new WebSocket()` 只能发起 GET 握手，升级由服务端完成；
 * - 鉴权不放在请求头（浏览器无法给 WebSocket 设置 `Authorization`），而是按后端
 *   要求把 token 放进首帧 init 消息（见 `stores/collaboration.ts`）。
 *
 * 可用 `VITE_COLLAB_WS_URL` 覆盖默认地址（例如后端直连的 `ws://localhost:8888/ot`）；
 * 未配置时按当前页面 origin + `VITE_API_BASE_URL` 推导，生产环境与 REST 走同一网关。
 */

/** 默认端点：当前 origin + API 基础路径 + 协作编辑路径。 */
const COLLAB_EDIT_PATH = '/doc/v1/document/edit'

/** 把配置值规范成绝对 ws/wss 地址；支持绝对 http(s)/ws(s) 地址与以 `/` 开头的相对路径。 */
function toAbsoluteWsUrl(value: string): string {
  if (/^wss?:\/\//i.test(value)) return value
  if (/^https?:\/\//i.test(value)) return value.replace(/^http/i, 'ws')

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = value.startsWith('/') ? value : `/${value}`
  return `${protocol}//${window.location.host}${path}`
}

/**
 * 拼接协作编辑端点。
 *
 * @param documentId 目标文档 ID，作为 `document_id` 查询参数
 * @returns 形如 `ws://host/api/doc/v1/document/edit?document_id=1024`
 */
export function buildCollaborationUrl(documentId: string): string {
  const configured = env.collabWsUrl.trim()
  const base = toAbsoluteWsUrl(configured || `${env.apiBaseUrl}${COLLAB_EDIT_PATH}`)

  const url = new URL(base)
  url.searchParams.set('document_id', documentId)
  return url.toString()
}
