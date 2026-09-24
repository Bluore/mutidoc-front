import 'vue-router'

/**
 * 扩展路由 meta 字段，各模块在 routes.ts 中即可获得类型提示。
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，用于 document.title 与面包屑 */
    title?: string
    /** 是否需要登录（全局守卫预留） */
    requiresAuth?: boolean
    /** 是否缓存页面（配合 KeepAlive 使用） */
    keepAlive?: boolean
  }
}
