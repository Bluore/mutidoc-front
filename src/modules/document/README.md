# 文档模块（document）

工作台（文档列表）、文档详情与协作编辑。

## 目录

```
modules/document/
├── api/
│   ├── document.ts             # 列表 / 创建 / 删除 / 元信息
│   ├── collaboration.ts        # 协作编辑端点 URL 拼接
│   └── mock.ts
├── components/
│   ├── DocumentCard.vue        # 文档卡片（展示 + 事件上抛）
│   ├── DocumentToolbar.vue     # 筛选 / 排序 / 刷新 / 新建
│   ├── DocumentEditor.vue      # 纯文本编辑器（CodeMirror 6，仅展示 + 编辑）
│   └── CollaborationPanel.vue  # 右侧操作面板（信息 / 状态 / 退出）
├── ot/
│   ├── ot.ts                   # OT 核心（retain / insert / delete + transform）
│   ├── ot-client.ts            # OT 客户端状态机（无 I/O、无 DOM）
│   └── connection.ts           # WebSocket 传输层（回调式）
├── stores/
│   ├── document.ts             # 列表分页 + 详情
│   └── collaboration.ts        # 协作会话编排（OT 客户端 + 传输 + 响应式状态）
├── views/
│   ├── WorkbenchView.vue           # 工作台（主页）
│   ├── DocumentDetailView.vue      # 文档详情
│   └── CollaborationEditView.vue   # 协作编辑（左编辑器 + 右面板）
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
| 协作编辑 | WS | `/doc/v1/document/edit?document_id=` | 升级为 WebSocket，走 OT 协议 |

> `Document` **不含正文**；正文只在 WebSocket 协作连接中下发。

## 关键适配

- 后端列表结构为 `documents_info` + `documents_len`，API 层统一适配为 `PageResult{ list, total, page, pageSize }`。
- 文档没有「标题」字段，卡片用 `summary` 作为标题，为空时显示「未命名文档」。
- 时间字段是秒级 Unix 时间戳，统一用 `formatUnixSeconds` 格式化。

## 协作编辑（WebSocket）

路由 `documents/:id/edit`（`document-edit`），页面为左侧纯文本编辑器 + 右侧操作面板。
实现以 `reference/ts` 的示例代码为蓝本移植，数据流为：
**View → `stores/collaboration.ts` → `api/collaboration.ts` / `ot/*` → 后端**，
视图不直接接触 socket 或 OT 客户端，OT 客户端也不感知 DOM / Router。

### 连接与鉴权

- 端点留空时按 `ws(s)://<origin> + VITE_API_BASE_URL + /doc/v1/document/edit?document_id=<id>` 推导，
  可用 `VITE_COLLAB_WS_URL` 覆盖（例如后端直连 `ws://localhost:8888/ot`）。
- 浏览器无法给 WebSocket 设置 `Authorization` 头，因此按后端约定把 token 放进**首帧 init 消息**：
  `{ "token": "<access_token>" }`（不是参考代码里的 `user_id` / `user_name`）。
- 身份改由服务端 `init` 响应回传的 `user_id` 采用，用于识别「自己的算子」。
- 开发服务器已为 `/api` 代理开启 `ws: true`，并让 `dev-get-body-shim` 跳过 WebSocket 握手。

### 本地编辑 → 远端

编辑器每次输入都交给 `OtClient.calculate()` 折算成算子；若当前没有在途算子就直接发送，
否则进入等待槽，等回声确认后再自动补发。远端帧到达后立即消费并把 `apply_text` 回填到编辑器。

### 编辑器选型（CodeMirror 6）

`components/DocumentEditor.vue` 基于 **CodeMirror 6**（`@codemirror/state` / `view` / `commands`），
而非手写 `textarea`：受控 `textarea` 会打断中文输入法合成、清空原生撤销栈，远端更新时也只能
按位置截断光标。CodeMirror 原生处理 IME、撤销、选区映射与无障碍，基础体积约 100KB（gzip），
远小于 Monaco。

- 本地改动**同步上抛**完整文本（含 IME 合成过程），保证 store 里的文本与编辑器一致——
  否则远端帧到达时会把尚未上抛的输入覆盖掉。逐键生成算子的合并由 `OtClient` 的
  `send` / `wait` 槽承担。
- 远端改动以带 `Transaction.remote` + `Transaction.addToHistory.of(false)` 的事务回填：
  光标自动映射、不污染撤销栈。
- **不使用 `@codemirror/collab`**：它的冲突合并规则与后端 `pkg/ot` 不一致，
  协作仍以 `ot/ot-client.ts` 的状态机为唯一事实来源。

### 协议要点

- 发送：`{ edit: { reversion, operator: [ops...] } }`（`operator` 是**裸原子数组**）。
- 接收：`{ init: { reversion, content, user_id, users } }` 或 `{ edit: { reversion, operator: [...] } }`。
- 算子里所有位置 / 长度都是 **UTF-8 字节**偏移（见 `ot/ot.ts` 顶部说明）。

### 后端现状（开发阶段）

- 正文仅存于服务端进程内存，重启即丢、无法水平扩展；前端不假设正文会持久化。
- `users` 目前只在 `init` 中下发，断线重连后以服务端最新 `content` / `reversion` 整体替换本地状态。
- 右侧面板内置「活动日志」，便于联调时观察协议收发（后端接口完善后可移除）。

## 真实后端实测（2026-09）

- ✅ `POST /doc/v1/document`（创建）正常。
- ✅ `GET /doc/v1/document/list`、`GET /doc/v1/document/info`：后端入参声明为 **JSON 请求体**，
  但浏览器规范禁止 GET 携带 body；前端改用**查询参数**发送，由开发服务器（`dev-get-body-shim`）
  在本地联调时转成 JSON body 转发。生产环境需后端把这两个 GET 入参改为 `form:` 或改为 POST。
- ⚠️ `DELETE /doc/v1/document`（body 传 `document_id`）当前返回 HTTP 500 且文档未被删除，
  疑似后端删除逻辑报错，待后端修复；前端已按 `docs/document-api.md` 对接，修复后无需改动。
- 🚧 协作编辑 WebSocket 接口仍在开发中，前端按 `reference/` 示例与约定完成对接，待后端联调。

## 真实后端实测（2026-09）

- ✅ `POST /doc/v1/document`（创建）正常。
- ✅ `GET /doc/v1/document/list`、`GET /doc/v1/document/info`：后端入参声明为 **JSON 请求体**，
  但浏览器规范禁止 GET 携带 body；前端改用**查询参数**发送，由开发服务器（`dev-get-body-shim`）
  在本地联调时转成 JSON body 转发。生产环境需后端把这两个 GET 入参改为 `form:` 或改为 POST。
- ⚠️ `DELETE /doc/v1/document`（body 传 `document_id`）当前返回 HTTP 500 且文档未被删除，
  疑似后端删除逻辑报错，待后端修复；前端已按 `docs/document-api.md` 对接，修复后无需改动。

