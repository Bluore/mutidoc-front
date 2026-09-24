# 文档模块（document）

工作台（文档列表）与文档详情。

## 目录

```
modules/document/
├── api/
│   ├── document.ts             # 列表 / 创建 / 删除 / 元信息
│   └── mock.ts
├── components/
│   ├── DocumentCard.vue        # 文档卡片（展示 + 事件上抛）
│   └── DocumentToolbar.vue     # 筛选 / 排序 / 刷新 / 新建
├── stores/
│   └── document.ts             # 列表分页 + 详情
├── views/
│   ├── WorkbenchView.vue       # 工作台（主页）
│   └── DocumentDetailView.vue  # 文档详情
├── types/index.ts
├── constants.ts
├── routes.ts
└── index.ts
```

## 接口映射（详见 `docs/document-api.md`）

| 功能 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 获取我的文档列表 | GET | `/doc/v1/document/list` | 返回 `documents_info` + `documents_len` |
| 创建文档 | POST | `/doc/v1/document` | 返回 `document_id` |
| 删除文档 | DELETE | `/doc/v1/document` | body 传 `document_id`，仅归属者可删 |
| 获取文档元信息 | GET | `/doc/v1/document/info` | 返回 `{ document_info }` |

> `Document` **不含正文**；正文只在 WebSocket 协作连接中下发。

## 关键适配

- 后端列表结构为 `documents_info` + `documents_len`，API 层统一适配为 `PageResult{ list, total, page, pageSize }`。
- 文档没有「标题」字段，卡片用 `summary` 作为标题，为空时显示「未命名文档」。
- 时间字段是秒级 Unix 时间戳，统一用 `formatUnixSeconds` 格式化。

## 协作编辑（WebSocket）

见 `docs/websocket-edit.md`。当前浏览器直连会被后端 JWT 拦截（无法给 WebSocket 设置
`Authorization` 头），且后端尚未提供票据 / 查询参数方案，因此详情页仅展示状态说明，暂不接入 OT 协议。

## 真实后端实测（2026-09）

- ✅ `POST /doc/v1/document`（创建）正常。
- ✅ `GET /doc/v1/document/list`、`GET /doc/v1/document/info`：后端入参声明为 **JSON 请求体**，
  但浏览器规范禁止 GET 携带 body；前端改用**查询参数**发送，由开发服务器（`dev-get-body-shim`）
  在本地联调时转成 JSON body 转发。生产环境需后端把这两个 GET 入参改为 `form:` 或改为 POST。
- ⚠️ `DELETE /doc/v1/document`（body 传 `document_id`）当前返回 HTTP 500 且文档未被删除，
  疑似后端删除逻辑报错，待后端修复；前端已按 `docs/document-api.md` 对接，修复后无需改动。

