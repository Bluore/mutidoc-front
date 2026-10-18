import type { RouteRecordRaw } from 'vue-router'

/** 文档模块路由：作为 DefaultLayout 的子路由（相对路径） */
const routes: RouteRecordRaw[] = [
  {
    /**
     * 快照公开页（只读）。
     *
     * 路径与后端短链目标 `/public_documents/<snapshot_id>` 保持一致；
     * `meta.layout = 'blank'` 使其提升为顶层路由，**不套 DefaultLayout、不需要登录**。
     */
    path: '/public_documents/:snapshotId',
    name: 'document-snapshot',
    component: () => import('./views/SnapshotView.vue'),
    props: true,
    meta: { title: '文档快照', layout: 'blank' },
  },
  {
    path: 'documents',
    name: 'document-list',
    component: () => import('./views/WorkbenchView.vue'),
    meta: { title: '工作台' },
  },
  {
    path: 'documents/:id',
    name: 'document-detail',
    component: () => import('./views/DocumentDetailView.vue'),
    props: true,
    meta: { title: '文档详情' },
  },
  {
    path: 'documents/:id/edit',
    name: 'document-edit',
    component: () => import('./views/CollaborationEditView.vue'),
    props: true,
    meta: { title: '协作编辑' },
  },
]

export default routes
