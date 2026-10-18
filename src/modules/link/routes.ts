import type { RouteRecordRaw } from 'vue-router'

/**
 * 授权链接模块路由。
 *
 * `/grant/:grantId` 是分享链接的落地页（前端授权中间页）：
 * 需要登录，但使用整屏布局，不套用 DefaultLayout。
 * 未登录时全局守卫会跳转 `/login?redirect=/grant/:grantId`，登录后自动回到本页。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/grant/:grantId',
    name: 'link-grant',
    component: () => import('./views/GrantView.vue'),
    props: true,
    meta: { title: '文档授权', layout: 'blank', requiresAuth: true },
  },
]

export default routes
