import type { RouteRecordRaw } from 'vue-router'

import DefaultLayout from '@/layouts/DefaultLayout.vue'

/**
 * 模块路由自动收集。
 * 约定：每个业务模块在 `src/modules/<name>/routes.ts` 中默认导出一组路由，
 * 它们会被自动挂载到 DefaultLayout 之下（子路由，path 写相对路径即可）。
 * 新增模块无需改动本文件。
 */
const moduleRouteModules = import.meta.glob<{ default: RouteRecordRaw[] }>(
  '../modules/*/routes.ts',
  { eager: true },
)

const moduleRoutes = Object.values(moduleRouteModules).flatMap((module) => module.default)

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    children: [
      {
        path: '',
        name: 'home',
        redirect: { name: 'example-list' },
      },
      ...moduleRoutes,
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
]
