# 文档服务 API（document-api）

- 来源：`app/document/cmd/api/desc/doc.api`、`app/document/cmd/api/desc/document/document.api`
- 路由前缀：`/api/doc/v1`
- 服务端口：内部 `1101`（网关按 `/api/doc/` 路由）
- 鉴权：**全部接口都需要 JWT**（`jwt: JwtAuth`）
- 响应信封与错误码见 [README.md](./README.md)

## 接口一览

| # | 方法 | 路径 | 需鉴权 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/doc/v1/document` | 是 | 创建文档 |
| 2 | DELETE | `/api/doc/v1/document` | 是 | 删除文档 |
| 3 | POST | `/api/doc/v1/document/edit` | 是 | 协作编辑（WebSocket 升级） |
| 4 | GET | `/api/doc/v1/document/info` | 是 | 获取文档元信息 |
| 5 | GET | `/api/doc/v1/document/list` | 是 | 获取我的文档列表 |

## 公共类型

```ts
interface Document {
  id: string
  owner_id: string
  summary: string
  create_at: number // 秒级 Unix 时间戳
  update_at: number // 秒级 Unix 时间戳
}
```

> 注意：`Document` **不包含正文**。文档正文只在 WebSocket 协作连接中下发（接口 3），见 [websocket-edit.md](./websocket-edit.md)。
> 规格中的 `Summary` 与时间字段在实现里原样透传；RPC 层还带有 `version`/`delete_at`，但 API 层未对外暴露。

---

## 1. 创建文档

- `POST /api/doc/v1/document`
- 鉴权：是

**请求体**：空（`CreateDocumentReq {}`）。

**响应**

```json
{ "code": 0, "msg": "", "data": { "document_id": "1024" } }
```

**行为**：归属者 `owner_id` **从 JWT ctx 取**，不由前端传。调用 document-rpc 创建，默认正文由内存态提供（初始 `"helloworld"`）。

**可能错误**：`1005001` 服务器内部出错；`1004002` 鉴权失败。

**前端要点**：创建成功后用返回的 `document_id` 跳转到编辑页。

---

## 2. 删除文档

- `DELETE /api/doc/v1/document`
- 鉴权：是

**请求体**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `document_id` | string | 是 | 文档 ID |

```json
{ "document_id": "1024" }
```

**响应**：`data` 为空对象。

**行为**：先查文档 → 校验 `owner_id == JWT 用户` → 移除该文档在内存中的协作编辑会话（`CheckAndDelete`，防止删除后继续编辑）→ 调 RPC 删除。

**可能错误**

| code | 含义 |
| --- | --- |
| 1004001 | 字段验证错误（`document_id` 为空） |
| 1024002 | 文档不存在 |
| 1024003 | 没有权限操作该文档（非本人文档） |
| 1005001 | 服务器内部出错 |
| 1004002 | 用户鉴权失败 |

**前端要点**：只有文档归属者能删除；删除是不可逆操作，建议二次确认。

---

## 3. 协作编辑（WebSocket）

- `POST /api/doc/v1/document/edit`
- 鉴权：是（**注意浏览器 WebSocket 的鉴权限制，见下**）
- 参数：`document_id`（`EditDocumentReq`）
- 该接口**不是普通 JSON 接口**，而是把请求升级为 WebSocket，随后按 OT 协议收发消息。

完整消息格式、OT 算子与冲突处理见 [websocket-edit.md](./websocket-edit.md)。

**⚠️ 浏览器鉴权限制**：go-zero 的 `rest.WithJwt` 默认从 `Authorization` 头读取 token，而浏览器 `new WebSocket(url)` **无法自定义请求头**。当前后端未提供查询参数 / 票据 / Cookie 等替代方案，因此浏览器直连会被鉴权拦截（HTTP 401，code 1004002）。接入前必须与后端确认方案（例如短期一次性 ticket、网关改写、或把 token 放查询参数并让后端支持）。

**⚠️ 权限/存在性**：`editdocumentlogic.go` 未校验文档是否存在、是否属于当前用户，也未使用 JWT 的 user id，身份取自客户端首条 init 消息。详见 websocket 文档的风险说明。

---

## 4. 获取文档元信息

- `GET /api/doc/v1/document/info`
- 鉴权：是

**查询参数**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `document_id` | string | 是 | 文档 ID |

**响应**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "document_info": {
      "id": "1024",
      "owner_id": "7",
      "summary": "",
      "create_at": 1710000000,
      "update_at": 1710000000
    }
  }
}
```

**行为**：直接调 RPC 查文档并只返回元信息（**不校验归属**）。

**可能错误**

| code | 含义 |
| --- | --- |
| 1004001 | 字段验证错误（`document_id` 为空） |
| 1024002 | 文档不存在 |
| 1005001 | 服务器内部出错 |
| 1004002 | 用户鉴权失败 |

**前端要点**：正文不在这里，需另开 WebSocket 获取。

---

## 5. 获取文档列表

- `GET /api/doc/v1/document/list`
- 鉴权：是

**查询参数**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `page` | number | 否 | 页码，`< 1` 时后端按 `1` 处理 |
| `size` | number | 否 | 每页数量，`< 1` 或 `> 100` 时按 `20` 处理 |

**响应**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "documents_info": [ { "id": "1024", "owner_id": "7", "summary": "", "create_at": 1710000000, "update_at": 1710000000 } ],
    "documents_len": 1
  }
}
```

**行为**：只查当前用户（JWT）作为 `owner_id` 的文档，按 `create_at DESC` 排序。分页默认值 `page=1`、`size=20`，上限 100。

**可能错误**：`1005001` 服务器内部出错；`1004002` 用户鉴权失败。

**⚠️ 结构差异**：后端返回 `documents_info` + `documents_len`，而前端 `src/api/types.ts` 的 `PageResult<T>` 是 `{ list, total, page, pageSize }`。前端需要在模块 API 层做适配（映射为 `{ list: documents_info, total: documents_len, page, pageSize }`）。

---

## 附：文档模块错误码

| code | HTTP | 含义 | 来源 |
| --- | --- | --- | --- |
| 1004001 | 200 | 字段验证错误 | `pkg/response` |
| 1004002 | 401 | 用户鉴权失败 | `pkg/response` |
| 1005001 | 500 | 服务器内部出错 | `pkg/response` |
| 1024001 | 200 | 升级为 WebSocket 请求失败 | `app/document/.../httperr` |
| 1024002 | 200 | 文档不存在 | `app/document/.../httperr` |
| 1024003 | 200 | 没有权限操作该文档 | `app/document/.../httperr` |
| 102001 | 200 | 文档不存在（RPC 内部） | `pkg/grpcerr` |
| 102002 | 200 | 文档权限拒绝（RPC 内部） | `pkg/grpcerr` |
