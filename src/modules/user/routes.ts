import type { RouteRecordRaw } from 'vue-router'

/** 用户模块路由：作为 DefaultLayout 的子路由（相对路径） */
const routes: RouteRecordRaw[] = [
  {
    path: 'profile',
    name: 'user-profile',
    component: () => import('./views/UserProfileView.vue'),
    meta: { title: '个人中心' },
  },
]

export default routes
