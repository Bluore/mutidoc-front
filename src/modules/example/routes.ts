import type { RouteRecordRaw } from 'vue-router'

/**
 * 模块路由：默认导出，会被 src/router/routes.ts 自动收集为 DefaultLayout 的子路由。
 * - path 写相对路径（不要以 / 开头）
 * - name 使用「模块名-动作」格式，保证全局唯一
 */
const routes: RouteRecordRaw[] = [
  {
    path: 'examples',
    name: 'example-list',
    component: () => import('./views/ExampleListView.vue'),
    meta: { title: '示例模块' },
  },
  {
    path: 'examples/:id',
    name: 'example-detail',
    component: () => import('./views/ExampleDetailView.vue'),
    props: true,
    meta: { title: '示例详情' },
  },
]

export default routes
