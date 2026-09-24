import type { RouteRecordRaw } from 'vue-router'

/**
 * 鉴权模块路由。
 * `meta.layout = 'blank'` 会被 router/routes.ts 提升为顶层路由，不套用 DefaultLayout。
 * `meta.guestOnly` 表示「已登录用户不应再访问」，由路由守卫重定向回首页。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'auth-login',
    component: () => import('./views/AuthView.vue'),
    props: { mode: 'login' },
    meta: { title: '登录', layout: 'blank', guestOnly: true },
  },
  {
    path: '/register',
    name: 'auth-register',
    component: () => import('./views/AuthView.vue'),
    props: { mode: 'register' },
    meta: { title: '注册', layout: 'blank', guestOnly: true },
  },
]

export default routes
