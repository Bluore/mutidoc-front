import { request } from '@/api'
import type { PageResult } from '@/api'
import { env } from '@/config/env'

import type { DocumentItem } from '../types'
import {
  mockCreateDocument,
  mockDeleteDocument,
  mockFetchDocumentInfo,
  mockFetchDocumentList,
} from './mock'

/**
 * 文档模块 API 层。
 * 注意：文档服务接口全部需要 JWT，token 由全局 request() 自动注入。
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
