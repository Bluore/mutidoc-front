# MutiDoc 后端接口文档（前端视角）

> 本文档由 `Muti-Document-Server` 的 `.api` 规格文件与已生成的 Go 实现整理而来，面向 `Muti-Document-Front` 的接口对接。
> 规格是唯一事实来源，但**规格与实现存在差异**，本文以「实现为准」并标注风险点。

## 1. 文档来源（6 个 `.api` 文件）

| 文件 | 作用 | 状态 |
| --- | --- | --- |
| `app/user/cmd/api/desc/user.api` | 用户服务路由（login / info 两个分组） | 已实现 |
| `app/user/cmd/api/desc/user/user.api` | 用户服务请求/响应类型 | 已实现 |
| `app/document/cmd/api/desc/doc.api` | 文档服务路由 | 已实现 |
| `app/document/cmd/api/desc/document/document.api` | 文档服务请求/响应类型 | 部分实现 |
| `app/agent/cmd/api/desc/agent.api` | agent 服务 | 空脚手架 |
| `app/link/cmd/api/desc/link.api` | link 服务 | 空脚手架 |

详细结论见：

- [user-api.md](./user-api.md) — 用户服务（注册 / 登录 / 验证码 / 用户信息 / 头像）
- [document-api.md](./document-api.md) — 文档服务（增删查 / 列表 / WebSocket 协作编辑）
- [websocket-edit.md](./websocket-edit.md) — 协作编辑 OT 协议
- [agent-api.md](./agent-api.md) — agent 服务（空）
- [link-api.md](./link-api.md) — link 服务（空）

## 2. 服务与基础路径

| 服务 | 路由前缀 | 内部端口 | 网关路径 |
| --- | --- | --- | --- |
| user-api | `/api/user/v1` | 1101 | `/api/user/` |
| document-api | `/api/doc/v1` | 1101 | `/api/doc/` |
| agent-api | — | — | 未提供 |
| link-api | — | — | 未提供 |

前端接入方式：

- 开发环境：`vite.config.ts` 将 `/api` 代理到 `http://localhost:8080`（联调真实后端时设置 `VITE_USE_MOCK=false`）。
- 生产环境：`deploy/nginx/default.conf` 将 `/api/` 转发到 `nginx-gateway:8081`。
- 前端 `env.apiBaseUrl` 默认 `/api`，因此模块 API 里只需写**服务前缀之后的路径**（例如 `/user/v1/login`）。

## 3. 统一响应信封

后端 `pkg/response` 实际返回：

```json
{ "code": 0, "msg": "", "data": {} }
```

| 字段 | 含义 |
| --- | --- |
| `code` | 0 表示成功，非 0 为业务错误码 |
| `msg` | 中文错误信息（成功时为空串） |
| `data` | 业务数据，可能为 `{}` 或省略 |

### ⚠️ 前后端字段名不一致（重要）

前端 `src/api/types.ts` 的 `ApiResponse<T>` 声明的是 `message`，`src/api/http.ts` 也读取 `body?.message`：

```ts
export interface ApiResponse<T> { code: number; message: string; data: T }
```

而后端返回的是 `msg`。后果：

1. 成功响应无影响（只取 `data`）。
2. **业务错误（`code !== 0`）时，前端拿不到后端的中文提示**，`ApiError.message` 会退化成 `'业务处理失败'`。

对接建议（二选一）：

- 前端把 `ApiResponse` / `http.ts` 改为兼容 `msg`（推荐，改动小）：
  `const message = body?.message ?? (body as { msg?: string })?.msg ?? error.message`；
- 或后端在信封里同时输出 `message` 字段。

## 4. 鉴权

- 登录 / 注册成功返回 `access_token`，前端**必须存到 `localStorage['md_token']`**（`TOKEN_STORAGE_KEY`），请求拦截器会自动加 `Authorization: Bearer <token>`。
- 标注「需鉴权」的接口由 go-zero `rest.WithJwt` 校验；失败时走 `response.AuthHook`，返回 HTTP **401**，信封 `code = 1004002`。
- JWT 用户 ID 由后端写入 ctx（`jwtUserID`），前端无需传递用户 ID。
- 登录 / 注册返回的 `access_expire` 是**绝对过期时间的 Unix 秒级时间戳**（不是时长）；默认 TTL 为配置 `JwtAuth.AccessExpire`（默认 60 分钟）。前端可用 `Date.now()/1000 < access_expire` 判断是否过期。

## 5. 错误码总表

### 公共

| code | HTTP | 含义 |
| --- | --- | --- |
| 1004001 | 200 | 字段验证错误 |
| 1004002 | 401 | 用户鉴权失败 |
| 1005001 | 500 | 服务器内部出错 |

### 用户模块（httperr + grpcerr）

| code | 含义 | 触发接口 |
| --- | --- | --- |
| 1014002 | 邮箱格式错误或邮箱不支持 | 注册、获取验证码 |
| 1014003 | 邮件发送太快了，请稍后再试 | 获取验证码 |
| 1014004 | 验证码已过期或未发送 | 注册 |
| 1014005 | 验证码错误 | 注册 |
| 1014006 | 邮箱已存在 / 昵称已使用（**两错误共用同一 code，注意区分 msg**） | 注册 |
| 1014007 | 用户名或密码错误 | 登录 |
| 1014008 | 用户不存在 | 登录、获取用户信息 |
| 1015001 | 发送邮件失败，请稍后再试 | 获取验证码 |
| 101001~101006 | RPC 内部错误码（不直接返回给前端） | — |

### 文档模块

| code | 含义 | 触发接口 |
| --- | --- | --- |
| 1024001 | 升级为 WebSocket 请求失败 | 协作编辑 |
| 1024002 | 文档不存在 | 删除、详情 |
| 1024003 | 没有权限操作该文档 | 删除 |
| 102001 / 102002 | RPC 内部错误码（不直接返回给前端） | — |

> 注意：绝大多数业务错误使用 **HTTP 200 + 非 0 code**（`response.NewError(200, ...)`）。
> 只有鉴权失败是 HTTP 401。前端不能只靠 HTTP 状态判断成败，必须用 `request()` 的 `code` 校验。

## 6. 前端模块对照与待办

目前 `src/modules/` 只有 `example` 模板，业务模块尚未创建。按接口可拆为：

| 建议模块 | 对应接口 | 说明 |
| --- | --- | --- |
| `auth` | 注册、登录、验证码 | 成功后写 `md_token` |
| `user` | 获取/展示用户信息、头像上传 | 头像后端未实现 |
| `document` | 文档 CRUD + 列表 | 正文走 WebSocket |

## 7. 关键不一致与风险清单

| # | 问题 | 位置 | 影响 |
| --- | --- | --- | --- |
| 1 | 信封字段 `msg` vs 前端 `message` | `pkg/response` ↔ `src/api/types.ts` | 业务错误提示丢失 |
| 2 | 业务错误返回 HTTP 200 | `pkg/response/errors.go` | 不能按 HTTP 状态判断 |
| 3 | `email exists` 与 `nickname exists` 共用 code 1014006 | `app/user/.../httperr/errors.go` | 前端无法仅凭 code 区分 |
| 4 | 头像上传未实现（logic 为空） | `avatarlogic.go` | 调用会“假成功”返回空 |
| 5 | 列表结构 `documents_info`+`documents_len` 与前端 `PageResult{list,total}` 不一致 | `doc.api` ↔ `src/api/types.ts` | 需要做字段适配 |
| 6 | WebSocket 端点要求 JWT，但浏览器无法给 WS 设置 Authorization 头 | `editdocumenthandler.go` | 浏览器直连会被 401，需额外方案 |
| 7 | 文档正文为进程内内存（初始 `"helloworld"`，不落库） | `connection/ot.go` | 重启丢失、无法水平扩展 |
| 8 | WS 身份取自客户端首条 init 消息的 `user_id`，未校验一致性 | `editdocumentlogic.go` | 可伪造用户身份 |
| 9 | `/document/info` 不校验归属，任意登录用户可读他人文档元信息 | `infodocumentlogic.go` | 越权读元数据 |
| 10 | `robot_code` 字段存在但后端未校验（todo） | 登录/验证码 logic | 人机校验暂缺 |

## 8. 建议的前端接入顺序

1. 创建 `auth` 模块：验证码 → 注册 → 登录，落地 `md_token`。
2. 修正 `ApiResponse` 兼容 `msg`（风险 #1、#2）。
3. 创建 `user` 模块：获取用户信息（头像上传暂缓）。
4. 创建 `document` 模块：列表 / 创建 / 详情 / 删除；正文与协作编辑最后接。
5. 协作编辑：先与后端确认 WS 鉴权方案（短期票据 / 查询参数 / Cookie），再实现 [websocket-edit.md](./websocket-edit.md) 协议。
