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
│   ├── DocumentEditor.vue      # 纯文本编辑器（CodeMirror 6，编辑 + 远端光标渲染）
│   ├── DocumentTitleField.vue  # 文档标题展示 / 编辑（纯展示 + 事件上抛）
│   ├── CollaborationPanel.vue  # 右侧操作面板（标题 / 信息 / 状态 / 在线用户 / 日志 / 退出）
│   └── GrantLinkDialog.vue     # 授权链接分享弹窗（生成 / 复用 + 复制）
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
| 生成授权链接 | GET | `/doc/v1/document/grant` | 返回 `{ link }`，仅归属者，重复调用复用同一链接 |
| 协作编辑 | WS | `/doc/v1/document/edit?document_id=` | 升级为 WebSocket，走 OT 协议 |

> `Document` **不含正文**；正文只在 WebSocket 协作连接中下发。

## 关键适配

- 后端列表结构为 `documents_info` + `documents_len`，API 层统一适配为 `PageResult{ list, total, page, pageSize }`。
- 文档没有「标题」字段，卡片用 `summary` 作为标题，为空时显示「未命名文档」。
- 时间字段是秒级 Unix 时间戳，统一用 `formatUnixSeconds` 格式化。

## 授权链接分享（GetGrantLink）

文档详情页右上角「分享授权链接」打开 `components/GrantLinkDialog.vue`，由
`stores/document.ts` 的 `generateGrantLink(documentId)` 调用
`GET /doc/v1/document/grant`，成功后在弹窗内展示 `data.link` 并提供一键复制。

- 仅文档归属者可调用；同一 `(document_id, 归属者)` 重复调用会**复用同一条链接**，
  服务端不校验旧链接是否已过期，失效链接由被授权用户打开时的 link 服务判定。
- 链接形如 `<BaseUrl>/grant/<grantId>`，默认有效期 7 天；本接口**不代替归属者授权**，
  真正的权限授予发生在被授权用户登录后打开链接时（link 服务 302 跳转到 `documents/:id/edit`）。
- 复制能力封装在 `src/utils/clipboard.ts`（安全上下文用 Clipboard API，否则退回
  `execCommand`）。

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

### 本地编辑 → 远端（定时采样内容）

计算**不消费输入框事件**：视图挂载时通过 `collaboration.attachSource(() => editor.getText())`
把「读取文本框当前全文」的能力交给 store。store 每 500ms
（`COLLABORATION_EDIT_INTERVAL_MS`）采样一次，把文本框内容与前端本地副本
（`OtClient` 的 `apply_text`）比较：相同则什么都不做，不同才交给
`OtClient.calculate()` 折算成算子并上送。这样逐键输入被合并成约每 500ms 一次的网络往返与
OT 变换，且即使某些输入没有触发 change 事件也不会漏掉。若此时已有在途算子则先不发，等回声
确认后再由等待槽补发；远端帧到达时立即消费并把 `apply_text` 回填到编辑器（消费前会用
文本框真实内容把尚未折算的输入折叠进算子）。

### 在线用户与光标（User / Cursor）

- `init` 回传完整名册 `users`（含 `cursor_color`）与光标快照 `cursor`；此后服务端以
  `user` 广播 `join_users` / `quit_users`，以 `cursor` 广播一批光标更新（按 `user_id` 去重）。
- 编辑器选区变化经 `DocumentEditor` 的 `cursor-change` 事件交给 `setCursor(anchor, head)`，
  由 store 换算成 **UTF-8 字节**（`codeUnitsToByteOffset`）并**节流 200ms**
  （`COLLABORATION_CURSOR_THROTTLE_MS`）上报；有在途算子时延后，待确认后补发。
- 远端光标先经本地在途算子映射回本地文本（`OtClient.mapServerOffsetToLocal` + `transformOffset`），
  再换算成 CodeMirror 码元坐标（`byteOffsetToCodeUnits`），用 `StateField<DecorationSet>`
  画成竖线与选区高亮；`assoc=1` 表示别人恰好在光标处插入时粘到插入内容右侧。
- 右侧面板按 `cursor_color` 给在线用户着色，并展示自己的分配颜色。

### 文档标题（SetTitle）

- 标题是协作会话新增的字段，**只存在于服务端进程内存**，不参与 OT，也不回写 REST /
  数据库。`init` 回传当前标题 `title`（从未设置过时为空串），之后由 `set_title`
  广播同步。
- 用户经右侧面板「文档信息」卡片的 `DocumentTitleField` 修改标题，视图把新值交给
  `collaboration.setTitle`，由 store 发送 `{ set_title: { title } }`。
- 服务端更新后向**所有**连接（含设置者自己）广播 `{ set_title: { user_id, title } }`，
  各端据此收敛；本地不在发送时乐观改写，避免与广播冲突。新值与当前值相同则视为空操作，
  客户端与服务端都不会广播。标题为空串是合法值，`DocumentTitleField` 为空时退回展示
  REST `summary`（`未命名文档`）。

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

### 协议要点（详见 `docs/document/editDocument.md`）

- 发送：`{ edit: { reversion, operator: [ops...] } }`（`operator` 是**裸原子数组**）；
  光标另发 `{ cursor: { user_id: "", reversion, anchor: { offset, assoc }, head: { offset, assoc } } }`；
  标题另发 `{ set_title: { title } }`（无版本号、不参与 OT）。
- 接收：`{ init }` / `{ edit }` / `{ cursor: Cursor[] }` / `{ user: { join_users, quit_users } }` /
  `{ set_title: { user_id, title } }`，五个字段始终存在，未携带的为 `null`；`edit` 帧可同时
  携带被平移后的 `cursor`。
- 所有位置 / 长度、光标 `offset` 都是 **UTF-8 字节**偏移（见 `ot/ot.ts` 顶部说明）。
- `edit.operator` 收发不对称：客户端发裸数组，服务端下发 `{ id, ops }` 对象数组。

### 后端现状（开发阶段）

- 正文与标题仅存于服务端进程内存，重启即丢、无法水平扩展；前端不假设它们会持久化。
- 断线重连后以服务端最新 `content` / `reversion` 整体替换本地状态，并按 `init` 重建名册与光标。
- 右侧面板内置「活动日志」，便于联调时观察协议收发（后端接口完善后可移除）。

## 真实后端实测（2026-09）

- ✅ `POST /doc/v1/document`（创建）正常。
- ✅ `GET /doc/v1/document/list`、`GET /doc/v1/document/info`：后端入参声明为 **JSON 请求体**，
  但浏览器规范禁止 GET 携带 body；前端改用**查询参数**发送，由开发服务器（`dev-get-body-shim`）
  在本地联调时转成 JSON body 转发。生产环境需后端把这两个 GET 入参改为 `form:` 或改为 POST。
- ⚠️ `DELETE /doc/v1/document`（body 传 `document_id`）当前返回 HTTP 500 且文档未被删除，
  疑似后端删除逻辑报错，待后端修复；前端已按 `docs/document-api.md` 对接，修复后无需改动。
- 🚧 协作编辑 WebSocket 接口按 `docs/document/editDocument.md` 对接（含 User / Cursor），待后端联调。

