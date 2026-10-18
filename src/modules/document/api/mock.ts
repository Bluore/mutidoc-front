import { ApiError } from '@/api'
import type { PageResult } from '@/api'

import {
  DOCUMENT_NOT_FOUND_CODE,
  DOCUMENT_SNAPSHOT_NOT_FOUND_CODE,
  DOCUMENT_SUMMARY_FALLBACK,
} from '../constants'
import type {
  DocumentContent,
  DocumentItem,
  DocumentSnapshot,
  SnapshotPublishResult,
} from '../types'

/**
 * 模块内置 mock：内存中的文档列表。
 * 真实后端正文由 `GET /doc/v1/document/content` 返回，这里按标题生成一段 Markdown 代替。
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

/**
 * 获取文档正文：mock 没有数据库正文，按标题生成一段 Markdown 代替；
 * 真实后端返回的是「数据库正文 + 已落库版本」。
 */
export async function mockFetchDocumentContent(id: string): Promise<DocumentContent> {
  await delay(300)
  const item = db.find((doc) => doc.id === id)
  if (!item) throw new ApiError('文档不存在', DOCUMENT_NOT_FOUND_CODE)

  const title = item.summary.trim() || DOCUMENT_SUMMARY_FALLBACK
  const content = [
    `# ${title}`,
    '',
    '这是 Mock 环境返回的文档正文（Markdown 格式）。',
    '',
    '- 真实后端会返回已落库的正文与版本号；',
    '- 进入协作编辑页后，正文改由 WebSocket 的 init 消息下发；',
    '- 协作中尚未落库的变更不会立即反映在这里。',
  ].join('\n')

  return { content, summary: item.summary, version: 1 }
}

/**
 * 快照按 snapshot_id 存放，模拟 `public_documents` 表：发布后与文档列表互相独立。
 * 每次发布都会写入一条新记录，不复用旧快照。
 */
const snapshots = new Map<string, DocumentSnapshot>()

let snapshotSequence = 0

/** 发布快照：mock 没有正文存储，用一段固定说明代替「发布时的正文」 */
export async function mockPublishDocumentSnapshot(
  documentId: string,
): Promise<SnapshotPublishResult> {
  await delay(300)
  const doc = db.find((item) => item.id === documentId)
  if (!doc) throw new ApiError('文档不存在', DOCUMENT_NOT_FOUND_CODE)

  snapshotSequence += 1
  const snapshotId = `snapshot-mock-${snapshotSequence}`
  const timestamp = Math.floor(Date.now() / 1000)
  snapshots.set(snapshotId, {
    id: snapshotId,
    owner_id: doc.owner_id,
    summary: doc.summary,
    content: [
      `# ${doc.summary.trim() || '未命名文档'}`,
      '',
      '这是一份只读文档快照（Mock 数据）。',
      '',
      '真实后端会把「数据库正文 + redis 中尚未落库的协作变更」合并后写入快照；',
      '快照发布后继续编辑原文档不会影响这里的内容。',
    ].join('\n'),
    version: 1,
    create_at: timestamp,
    update_at: timestamp,
  })

  // mock 环境没有 link 服务，直接给出可访问的公开页地址，便于本地走通完整流程
  return {
    snapshot_id: snapshotId,
    short_link: `${window.location.origin}/public_documents/${snapshotId}`,
  }
}

/** 读取快照正文：快照不存在时抛出与后端一致的业务错误码 */
export async function mockFetchSnapshotContent(snapshotId: string): Promise<DocumentSnapshot> {
  await delay(300)
  const snapshot = snapshots.get(snapshotId)
  if (!snapshot) throw new ApiError('文档快照不存在', DOCUMENT_SNAPSHOT_NOT_FOUND_CODE)
  return { ...snapshot }
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
