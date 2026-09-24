import type { RouteRecordRaw } from 'vue-router'

import DefaultLayout from '@/layouts/DefaultLayout.vue'

/**
 * 模块路由自动收集。
 * 约定：每个业务模块在 `src/modules/<name>/routes.ts` 中默认导出一组路由，
 * 它们会被自动挂载到 DefaultLayout 之下（子路由，path 写相对路径即可）。
 *
 * 若某条路由需要「独立整屏布局」（例如登录 / 注册，不需要顶部导航），
 * 在其 `meta` 上标记 `layout: 'blank'`，它会被提升为顶层路由，不受 DefaultLayout 包裹。
 * 新增模块无需改动本文件。
 */
const moduleRouteModules = import.meta.glob<{ default: RouteRecordRaw[] }>(
  '../modules/*/routes.ts',
  { eager: true },
)

const collectedRoutes = Object.values(moduleRouteModules).flatMap((module) => module.default)

const standaloneRoutes = collectedRoutes.filter((route) => route.meta?.layout === 'blank')
const layoutRoutes = collectedRoutes.filter((route) => route.meta?.layout !== 'blank')

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    // 布局内所有页面默认需要登录，登录 / 注册等独立路由用 meta.layout 排除
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'home',
        redirect: { name: 'document-list' },
      },
      ...layoutRoutes,
    ],
  },
  ...standaloneRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
]
