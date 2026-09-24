# 协作编辑 WebSocket 协议

- 端点：`POST /api/doc/v1/document/edit?document_id=<id>`（升级为 WebSocket）
- 实现：`app/document/cmd/api/internal/logic/editdocumentlogic.go`、`connection/`、`protocol/`
- 算法：`pkg/ot`（JSON 形式的 retain / insert / delete OT）
- 鉴权：走 go-zero `rest.WithJwt`（**浏览器直连鉴权存在限制，见文末风险**）

## 1. 连接生命周期

```
Client                                   Server
  │  POST /document/edit?document_id=ID     │
  │  Upgrade: websocket  ------------------> │  upgrader.Upgrade
  │                                         │  GetOrCreate(ID) 内存文档
  │  { user_id, user_name }  -------------> │  首条消息：ClientInitMessage
  │                                         │  ConnectUser + 广播/推送
  │  <---- { init: { reversion, content,     │  ServerInitMessage
  │            user_id, users } }            │
  │  { edit: { reversion, operator } } ---> │  applyEdit（OT 变换后应用）
  │  <---- { edit: { reversion, operator[] }}│  增量算子推送
```

要点：

1. 升级成功后，客户端**必须发送且仅发送一条** `ClientInitMessage` 作为首帧；服务端在一个循环里读取，解析失败会继续等待下一条，直到成功才进入正式处理。
2. 服务端收到 init 后发送 `ServerMessage.init`：包含当前正文 `content`、当前版本号 `reversion`、自己的 `user_id`、当前在线用户 `users`。
3. 之后客户端发编辑消息（`ClientMessage.edit`），服务端应用 OT 并把新增算子推给其他连接（`ServerMessage.edit`，`operator` 为数组）。

## 2. 消息格式（JSON）

### 2.1 客户端 → 服务端

**首帧 init**

```json
{ "user_id": "7", "user_name": "neo" }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `user_id` | string | 客户端上报的用户标识 |
| `user_name` | string | 客户端上报的用户名（用于在线列表） |

**编辑消息**

```json
{
  "edit": {
    "reversion": 3,
    "operator": {
      "ops": [5, -2, "hi"],
      "reversion": 3,
      "id": "7"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `edit.reversion` | number | 客户端基于的服务端版本号 |
| `edit.operator.ops` | array | OT 算子序列，见 §3 |
| `edit.operator.reversion` | number | 版本号（服务端会用 `edit.reversion` 覆盖，前端可省略） |
| `edit.operator.id` | string | 用户 ID（服务端会用连接身份覆盖，前端可省略） |

### 2.2 服务端 → 客户端

**init**

```json
{
  "init": {
    "reversion": 0,
    "content": "helloworld",
    "user_id": "7",
    "users": [ { "id": "7", "name": "neo" } ]
  }
}
```

**编辑增量**

```json
{ "edit": { "reversion": 5, "operator": [ { "ops": [3, "x"], "reversion": 4, "id": "8" } ] } }
```

> 服务端 `ServerEditMsg.operator` 是**数组**（可能一次包含多个算子），与客户端发送的单对象结构不同。

## 3. OT 算子（`ops` 数组）

`pkg/ot` 把算子序列序列化为 JSON 数组，元素含义：

| JSON 元素 | 类型 | 含义 |
| --- | --- | --- |
| 正数 `n` | number | **retain**：保留后续 n 个字符 |
| 负数 `-n` | number | **delete**：删除 n 个字符 |
| 字符串 `s` | string | **insert**：插入字符串 s |

示例：`[5, -2, "hi"]` = 保留 5 个字符 → 删除 2 个字符 → 插入 `"hi"`。

服务端处理（`connection.ot.go`）：

- `reversion > len(Ops)`：丢弃（日志记录 `reversion if out of ops`）。
- `reversion < len(Ops)`：用历史算子做 `Transform` 变换后再应用（支持并发冲突合并）。
- `reversion == len(Ops)`：直接应用。
- 应用后追加到 `Ops`，并通知所有连接同步。

前端实现 OT 客户端时，应保证本地 `reversion` 与服务端一致，并在收到 `edit` 增量后做变换/重放。

## 4. 当前实现的限制与风险

| # | 问题 | 说明 |
| --- | --- | --- |
| 1 | 正文不持久化 | 初始内容写死 `"helloworld"`，算子只存在进程内存，**重启即丢失，也不落库**。 |
| 2 | 无法水平扩展 | 文档状态为**进程内** `DocumentMap`，多实例之间不共享；当前不能安全重启/多副本。 |
| 3 | 浏览器鉴权受限 | WS 需 JWT，但浏览器无法设置 `Authorization` 头；后端暂未支持查询参数/票据。**接入前必须确认方案。** |
| 4 | 身份可伪造 | 用户身份取自客户端 init 的 `user_id`，未与 JWT 校验；任意登录用户可冒充他人。 |
| 5 | 无权限/存在性校验 | 未校验 `document_id` 是否存在或是否属于当前用户。 |
| 6 | 连接清理 | 删除文档时会移除内存会话（`CheckAndDelete`），但普通断线仅取消该连接；文档内存对象在无人访问时不会被主动回收。 |

## 5. 前端接入检查清单

- [ ] 与后端确认 WS 鉴权传递方式（ticket / query / cookie）。
- [ ] 建立连接后先发送 init 帧（`user_id`、`user_name`）。
- [ ] 以 init 的 `content` + `reversion` 初始化本地编辑器。
- [ ] 本地编辑生成 `ops` 序列，携带当前 `reversion` 发送。
- [ ] 收到 `edit` 增量时按 OT 规则变换并应用，更新本地 `reversion`。
- [ ] 处理断线重连：重新 init 会拿到最新 `content` 与 `reversion`，应整体替换本地状态。
- [ ] 不要假设正文会持久化（当前会丢）。
