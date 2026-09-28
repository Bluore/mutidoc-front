import type { PageResult } from '@/api'

import type { DocumentItem } from '../types'

/**
 * 模块内置 mock：内存中的文档列表。
 * 真实后端正文不落库（初始 "helloworld"），这里只模拟元信息。
 */
const DELAY = 400
const delay = (ms = DELAY) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const nowMs = Date.now()
const nowSec = Math.floor(nowMs / 1000)
const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

let sequence = 1024
const nextId = () => String((sequence += 1))

let db: DocumentItem[] = [
  {
    id: '1028',
    owner_id: '1001',
    summary: '产品需求评审纪要',
    create_at: nowSec - 2 * HOUR,
    update_at: nowSec - 30 * MINUTE,
  },
  {
    id: '1027',
    owner_id: '1001',
    summary: '前端架构设计草案',
    create_at: nowSec - DAY,
    update_at: nowSec - 5 * HOUR,
  },
  {
    id: '1026',
    owner_id: '1001',
    summary: '接口联调问题清单',
    create_at: nowSec - 2 * DAY,
    update_at: nowSec - DAY,
  },
  {
    id: '1025',
    owner_id: '1001',
    summary: '',
    create_at: nowSec - 3 * DAY,
    update_at: nowSec - 3 * DAY,
  },
  {
    id: '1024',
    owner_id: '1001',
    summary: 'helloworld',
    create_at: nowSec - 7 * DAY,
    update_at: nowSec - 6 * DAY,
  },
]

export async function mockFetchDocumentList(
  page: number,
  pageSize: number,
): Promise<PageResult<DocumentItem>> {
  await delay()
  // 与后端一致：按 create_at 倒序
  const sorted = [...db].sort((a, b) => b.create_at - a.create_at)
  const start = (page - 1) * pageSize
  return {
    list: sorted.slice(start, start + pageSize).map((item) => ({ ...item })),
    total: sorted.length,
    page,
    pageSize,
  }
}

export async function mockCreateDocument(): Promise<string> {
  await delay(300)
  const id = nextId()
  const timestamp = Math.floor(Date.now() / 1000)
  db = [{ id, owner_id: '1001', summary: '', create_at: timestamp, update_at: timestamp }, ...db]
  return id
}

export async function mockDeleteDocument(id: string): Promise<void> {
  await delay(300)
  db = db.filter((item) => item.id !== id)
}

export async function mockFetchDocumentInfo(id: string): Promise<DocumentItem> {
  await delay(300)
  const item = db.find((doc) => doc.id === id)
  if (!item) throw new Error('文档不存在')
  return { ...item }
}

/** 授权链接按 document_id 复用，与后端「同文档重复调用复用同一链接」的语义一致 */
const grantLinks = new Map<string, string>()

export async function mockFetchGrantLink(documentId: string): Promise<string> {
  await delay(300)
  const existing = grantLinks.get(documentId)
  if (existing) return existing

  const grantId = Math.random().toString(16).slice(2, 14)
  const link = `${window.location.origin}/grant/${grantId}`
  grantLinks.set(documentId, link)
  return link
}
