import { request } from '@/api'
import type { PageResult } from '@/api'
import { env } from '@/config/env'

import type {
  DocumentContent,
  DocumentItem,
  DocumentSnapshot,
  GrantLinkResult,
  SnapshotPublishResult,
} from '../types'
import {
  mockCreateDocument,
  mockDeleteDocument,
  mockFetchDocumentContent,
  mockFetchDocumentInfo,
  mockFetchDocumentList,
  mockFetchGrantLink,
  mockFetchSnapshotContent,
  mockPublishDocumentSnapshot,
} from './mock'

/**
 * 文档模块 API 层。
 * 注意：除快照正文（公开读取）外，文档服务接口都需要 JWT，token 由全局 request() 自动注入。
 */

/** 后端列表原始结构：documents_info + documents_len */
interface RawDocumentList {
  documents_info: DocumentItem[]
  documents_len: number
}

/**
 * 获取我的文档列表：GET /doc/v1/document/list
 * 后端返回 documents_info / documents_len，这里适配为统一的 PageResult。
 *
 * 注意：该 GET 接口要求 `page` / `size` 放在 JSON 请求体中，而浏览器不允许 GET 携带 body；
 * 故前端用查询参数发送，由开发服务器（dev-get-body-shim）转成 JSON body 转发。
 */
export async function fetchDocumentList(
  page: number,
  pageSize: number,
): Promise<PageResult<DocumentItem>> {
  if (env.useMock) return mockFetchDocumentList(page, pageSize)

  const data = await request<RawDocumentList>({
    url: '/doc/v1/document/list',
    method: 'get',
    params: { page, size: pageSize },
  })
  return {
    list: data.documents_info ?? [],
    total: data.documents_len ?? 0,
    page,
    pageSize,
  }
}

/** 创建文档：POST /doc/v1/document（返回 document_id） */
export async function createDocument(): Promise<string> {
  if (env.useMock) return mockCreateDocument()

  const data = await request<{ document_id: string }>({
    url: '/doc/v1/document',
    method: 'post',
  })
  return data.document_id
}

/** 删除文档：DELETE /doc/v1/document */
export function deleteDocument(documentId: string): Promise<void> {
  if (env.useMock) return mockDeleteDocument(documentId)

  return request<void>({
    url: '/doc/v1/document',
    method: 'delete',
    data: { document_id: documentId },
  })
}

/** 获取文档元信息：GET /doc/v1/document/info（参数经开发服务器转换后以 JSON body 转发） */
export async function fetchDocumentInfo(documentId: string): Promise<DocumentItem> {
  if (env.useMock) return mockFetchDocumentInfo(documentId)

  const data = await request<{ document_info: DocumentItem }>({
    url: '/doc/v1/document/info',
    method: 'get',
    params: { document_id: documentId },
  })
  return data.document_info
}

/**
 * 获取文档正文：GET /doc/v1/document/content
 *
 * 返回数据库中的正文、标题与当前版本号。仅归属者 / 被授权者可读；
 * 协作连接中尚未落库的变更不会出现在这里，实时正文以 WebSocket 的 init 消息为准。
 */
export async function fetchDocumentContent(documentId: string): Promise<DocumentContent> {
  if (env.useMock) return mockFetchDocumentContent(documentId)

  return request<DocumentContent>({
    url: '/doc/v1/document/content',
    method: 'get',
    params: { document_id: documentId },
  })
}

/**
 * 生成（或复用）文档授权链接：GET /doc/v1/document/grant
 *
 * 仅文档归属者可调用；同一 `document_id` 重复调用会复用已有链接。
 * 该接口只返回链接，真正的授权发生在被授权用户打开链接时，由 link 服务完成。
 */
export async function fetchGrantLink(documentId: string): Promise<string> {
  if (env.useMock) return mockFetchGrantLink(documentId)

  const data = await request<GrantLinkResult>({
    url: '/doc/v1/document/grant',
    method: 'get',
    params: { document_id: documentId },
  })
  return data.link
}

/**
 * 发布文档快照：POST /doc/v1/document/snapshot
 *
 * 仅文档归属者可调用；把文档**当前内容**冻结成一份只读快照，返回快照 ID 与短链。
 * 每次调用都会生成新的快照与短链，不会复用旧快照。
 */
export async function publishDocumentSnapshot(
  documentId: string,
): Promise<SnapshotPublishResult> {
  if (env.useMock) return mockPublishDocumentSnapshot(documentId)

  return request<SnapshotPublishResult>({
    url: '/doc/v1/document/snapshot',
    method: 'post',
    data: { document_id: documentId },
  })
}

/**
 * 读取快照正文：GET /doc/v1/document/snapshot/content
 *
 * 公开接口，无需登录，供短链落地页（`/public_documents/:snapshotId`）渲染。
 */
export async function fetchSnapshotContent(snapshotId: string): Promise<DocumentSnapshot> {
  if (env.useMock) return mockFetchSnapshotContent(snapshotId)

  return request<DocumentSnapshot>({
    url: '/doc/v1/document/snapshot/content',
    method: 'get',
    params: { snapshot_id: snapshotId },
  })
}
