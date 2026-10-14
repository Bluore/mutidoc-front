import type { RouteRecordRaw } from 'vue-router'

/**
 * 错误页模块路由。
 * `meta.layout = 'blank'` 会被 router/routes.ts 提升为顶层路由，不套用 DefaultLayout，
 * 因此 404 页是整屏独立页面，且未登录也可访问。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/err/404',
    name: 'error-not-found',
    component: () => import('./views/NotFoundView.vue'),
    meta: { title: '页面不存在', layout: 'blank' },
  },
]

export default routes
