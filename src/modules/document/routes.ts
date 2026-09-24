import type { RouteRecordRaw } from 'vue-router'

/** 文档模块路由：作为 DefaultLayout 的子路由（相对路径） */
const routes: RouteRecordRaw[] = [
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
]

export default routes
