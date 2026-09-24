/**
 * 文档模块出口（Public API）。
 */
export { default as documentRoutes } from './routes'
export { useDocumentStore } from './stores/document'
export type { CreateDocumentResult, DocumentItem, DocumentSort } from './types'
export {
  DOCUMENT_PAGE_SIZE,
  DOCUMENT_PAGE_SIZE_OPTIONS,
  DOCUMENT_SORT_OPTIONS,
  DOCUMENT_SUMMARY_FALLBACK,
} from './constants'
