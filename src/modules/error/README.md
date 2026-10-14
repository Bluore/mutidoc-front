# 错误页模块（error）

集中放置整屏错误页，路由统一挂在 `/err/*` 下。

## 目录

```
modules/error/
├── views/
│   └── NotFoundView.vue    # 404 页（meta.layout = 'blank'）
├── routes.ts               # 路由（默认导出，会被自动收集）
├── index.ts                # 模块出口（Public API）
└── README.md
```

## 页面

| 路径 | name | 说明 |
| --- | --- | --- |
| `/err/404` | `error-not-found` | 页面不存在，整屏独立页，未登录可访问 |

## 说明

- 路由使用 `meta.layout = 'blank'`，由 `router/routes.ts` 提升为顶层路由，不套用 `DefaultLayout`，
  因此不依赖登录态，任何场景下都能直接访问。
- 页面展示当前访问地址（`route.fullPath`），并提供两个出口：
  - **返回上一页**：仅当存在站内跳转来源（`window.history.state.back`）时展示；
  - **返回工作台**：跳转 `home`（最终重定向到文档列表）。
- 与 `router/routes.ts` 里的兜底路由 `/:pathMatch(.*)*`（`src/views/NotFoundView.vue`）相互独立，
  两者互不影响：前者是显式地址，后者是未匹配地址的兜底。
