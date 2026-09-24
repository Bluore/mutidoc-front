import { createRouter, createWebHistory } from 'vue-router'

import { env } from '@/config/env'
import { useAuthStore } from '@/modules/auth'
import { pinia } from '@/stores'

import { routes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

/**
 * 全局前置守卫：
 * 1. 设置页面标题；
 * 2. 校验登录态——需要登录的页面未登录时跳登录页；已登录访问登录/注册页时回首页。
 */
router.beforeEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} · ${env.appTitle}` : env.appTitle

  const auth = useAuthStore(pinia)
  // 清理已过期凭证，避免带着失效 token 访问受限页面
  auth.ensureFresh()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    const redirect = to.fullPath === '/' ? undefined : to.fullPath
    return { name: 'auth-login', query: redirect ? { redirect } : {} }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})

export default router
