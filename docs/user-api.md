# 用户服务 API（user-api）

- 来源：`app/user/cmd/api/desc/user.api`、`app/user/cmd/api/desc/user/user.api`
- 路由前缀：`/api/user/v1`
- 服务端口：内部 `1101`（网关按 `/api/user/` 路由）
- 响应信封与错误码见 [README.md](./README.md)

## 接口一览

| # | 方法 | 路径 | 需鉴权 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | POST | `/api/user/v1/user` | 否 | 注册 |
| 2 | POST | `/api/user/v1/login` | 否 | 登录 |
| 3 | POST | `/api/user/v1/email/code` | 否 | 获取邮箱验证码 |
| 4 | GET | `/api/user/v1/user` | 是 | 获取当前用户信息 |
| 5 | POST | `/api/user/v1/user/avatar` | 是 | 修改头像（未实现） |

> 路由分组：1/2/3 属于 `login` 组（无 JWT）；4/5 属于 `info` 组（`jwt: JwtAuth`）。

## 公共类型

```ts
interface User {
  id: string
  nick_name: string
  email: string
  avatar: string
}
```

---

## 1. 注册

- `POST /api/user/v1/user`
- 鉴权：无

**请求体**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 邮箱，后端会 `toLowerCase` + `trim` |
| `email_code` | string | 是 | 邮箱验证码（先调用接口 3 获取） |
| `nick_name` | string | 是 | 昵称 |
| `password` | string | 是 | 密码 |

```json
{ "email": "a@b.com", "email_code": "123456", "nick_name": "neo", "password": "secret" }
```

**响应**

```json
{ "code": 0, "msg": "", "data": { "access_token": "eyJ...", "access_expire": 60 } }
```

**行为**：校验邮箱正则 `^[\w-]+@[\w-]+.[a-zA-Z]{2,4}$` → 从 Redis 取验证码比对 → 删除验证码与限流 key → 调用 user-rpc 创建用户 → 生成 token。

**可能错误**

| code | 含义 |
| --- | --- |
| 1014002 | 邮箱格式错误或邮箱不支持 |
| 1014004 | 验证码已过期或没有发送验证码 |
| 1014005 | 验证码错误 |
| 1014006 | 邮箱已存在 / 昵称已使用（共用 code，看 `msg`） |
| 1005001 | 服务器内部出错（Redis / RPC / 生成 token 失败） |

**前端要点**：成功后把 `access_token` 存入 `localStorage['md_token']`；`access_expire` 是**绝对过期时间的 Unix 秒级时间戳**（`time.Now().Add(60分钟).Unix()`，TTL 默认 60 分钟），不是时长。

---

## 2. 登录

- `POST /api/user/v1/login`
- 鉴权：无

**请求体**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `login` | string | 是 | 登录名（邮箱/账号，由 user-rpc 决定） |
| `password` | string | 是 | 密码 |
| `robot_code` | string | 否 | 预留字段，**后端未校验**（`todo 验证robot`） |

**响应**：同注册，返回 `{ access_token, access_expire }`。

**可能错误**

| code | 含义 |
| --- | --- |
| 1014007 | 用户名或密码错误 |
| 1014008 | 用户不存在 |
| 1005001 | 服务器内部出错 |

**前端要点**：同样把 `access_token` 写入 `md_token`。

---

## 3. 获取邮箱验证码

- `POST /api/user/v1/email/code`
- 鉴权：无

**请求体**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `email` | string | 是 | 接收验证码的邮箱 |
| `robot_code` | string | 否 | 预留字段，**后端未校验** |

**响应**：`data` 为空对象。

**行为**：邮箱正则校验 → 频率限制（同一邮箱 1 分钟一次）→ 生成 6 位数字验证码，Redis 存 10 分钟 → 通过 Resend 发送邮件。

**可能错误**

| code | 含义 |
| --- | --- |
| 1014002 | 邮箱格式错误或邮箱不支持 |
| 1014003 | 邮件发送太快了，请稍后再试 |
| 1015001 | 发送邮件失败，请稍后再试 |
| 1005001 | 服务器内部出错 |

**前端要点**：发送成功后建议前端做 60s 倒计时，避免撞 1014003；验证码 10 分钟内有效。

---

## 4. 获取当前用户信息

- `GET /api/user/v1/user`
- 鉴权：**是**（`Authorization: Bearer <token>`）

**请求**：无参数。

**响应**

```json
{ "code": 0, "msg": "", "data": { "user_info": { "id": "1", "nick_name": "neo", "email": "a@b.com", "avatar": "" } } }
```

**行为**：从 JWT ctx 取用户 ID（`MustGetUserIdFromCtx`，缺失会 panic → 被 `response.ErrServer` 兜底）→ 调 user-rpc 查详情。

**可能错误**

| code | 含义 |
| --- | --- |
| 1014008 | 用户不存在 |
| 1005001 | 服务器内部出错 |
| 1004002 | 用户鉴权失败（HTTP 401） |

**前端要点**：适合登录后拉取一次用户信息放入全局 store。

---

## 5. 修改头像

- `POST /api/user/v1/user/avatar`
- 鉴权：**是**

**请求 / 响应**：`.api` 中 `UploadAvatarReq` 与 `UploadAvatarResp` 均为空类型。

**⚠️ 当前未实现**：`app/user/cmd/api/internal/logic/info/avatarlogic.go` 仅有一句 `// todo`，函数直接返回零值。调用会返回 `{ code: 0, msg: "", data: {} }` 的**假成功**，不会保存任何内容。

**前端要点**：暂缓接入；等后端补上文件字段（预计 multipart/form-data）与上传逻辑后再实现。若提前接入，需考虑假成功带来的 UI 误判。

---

## 附：涉及的内部常量

| 常量 | 值 | 位置 |
| --- | --- | --- |
| 邮箱正则 | `^[\w-]+@[\w-]+.[a-zA-Z]{2,4}$` | `pkg/globalkey/regexp.go` |
| 验证码 Redis key | `key:user:email:verify:code:%s` | `pkg/globalkey/redisKey.go` |
| 限流 Redis key | `key:user:email:verify:limit:%s` | `pkg/globalkey/redisKey.go` |
| 验证码有效期 | 10 分钟 | `emailcodelogic.go` |
| 发送限流 | 1 分钟 | `emailcodelogic.go` |
