# 授权链接模块（link）

文档授权链接的落地页：`/grant/{grantId}`。

归属者从文档详情页复制到的分享链接就是该地址（由 document-api 返回）。
被授权用户打开后，本模块调用 link-api 换取文档地址并跳转，真正的权限授予由服务端完成。

## 目录

```
modules/link/
├── api/
│   ├── link.ts                 # GET /link/v1/grant/{grantId}
│   └── mock.ts                 # 任意 grantId 授权成功；前缀可模拟错误态
├── stores/
│   └── grant.ts                # 授权状态机（exchanging / success / error）
├── views/
│   └── GrantView.vue           # 授权中间页
├── types/index.ts
├── constants.ts                # 错误码、跳转延时
├── routes.ts
├── index.ts
└── README.md
```

## 接口

| 功能 | 方法 | 路径 | 鉴权 |
| --- | --- | --- | --- |
| 换取文档地址 | GET | `/link/v1/grant/{grantId}` | 需要 JWT |

> `env.apiBaseUrl` 已是 `/api`，因此模块内只写 `/link/v1/grant/...`。
> 契约详见 [`docs/link/linkApi.md`](../../../docs/link/linkApi.md)。

成功返回 `{ link: "<BaseUrl>/documents/<documentId>/edit" }`；失败以 HTTP 200 +
非零 `code` 返回，由 `request()` 统一抛出 `ApiError`。

## 流程

1. 路由 `/grant/:grantId`：`meta.layout = 'blank'` + `meta.requiresAuth`。
   未登录时全局守卫跳转 `/login?redirect=/grant/:grantId`，登录 / 注册成功后自动回到本页
   （登录页的登录 ↔ 注册切换会保留 `redirect`）。
2. 页面挂载后调用 store 的 `exchange(grantId)`；成功后停留 500ms 展示成功态，再自动跳转。
3. 跳转只取后端返回地址的 **path + query + hash**，在当前前端 origin 内交给 vue-router。
   后端 `BaseUrl` 可能是网关地址（如开发环境的 `:8888`），整页跳转会切换 origin 并丢失登录态。

## 错误处理

| code | 含义 | 页面表现 |
| --- | --- | --- |
| `1034001` | 链接不存在（或文档已删除） | 展示原因，仅提供「返回工作台」 |
| `1034002` | 链接已过期 | 展示原因，提示联系归属者重新生成 |
| `1034003` | 授予权限失败 | 展示原因，仅提供「返回工作台」 |
| 其他（网络 / 500 等） | 临时失败 | 提供「重新验证」与「返回工作台」 |

`401` 由全局 axios 拦截器统一处理（清理凭证并跳转登录页）。

## mock

`.env` 中 `VITE_USE_MOCK=true` 时：

- 任意 `grantId` → 跳转 mock 文档 `1024` 的编辑页；
- `grantId` 以 `expired` / `missing` / `denied` 开头 → 分别触发 1034002 / 1034001 / 1034003。
