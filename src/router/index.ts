import { createRouter, createWebHistory } from 'vue-router'

import { env } from '@/config/env'

import { routes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/** 全局前置守卫：设置页面标题，鉴权逻辑后续在此扩展 */
router.beforeEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} · ${env.appTitle}` : env.appTitle
  return true
})

export default router
