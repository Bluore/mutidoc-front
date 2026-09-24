# 鉴权模块（auth）

负责注册 / 登录 / 邮箱验证码，并落地登录态（`localStorage['md_token']`）。

## 目录

```
modules/auth/
├── api/
│   ├── auth.ts                 # 登录 / 注册 / 验证码
│   └── mock.ts                 # 本地假数据（VITE_USE_MOCK=true 时生效）
├── components/
│   ├── AuthBrandPanel.vue      # 左侧品牌区（展示）
│   ├── LoginForm.vue           # 登录表单
│   └── RegisterForm.vue        # 注册表单（含验证码倒计时）
├── composables/
│   └── useEmailCountdown.ts    # 60s 倒计时，规避后端发送限流
├── stores/
│   └── auth.ts                 # 登录态：token + 绝对过期时间
├── views/
│   └── AuthView.vue            # 登录 / 注册整屏页（meta.layout = 'blank'）
├── types/index.ts
├── constants.ts                # 校验规则 / 常量
├── routes.ts
└── index.ts
```

## 接口映射（详见 `docs/user-api.md`）

| 功能 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 登录 | POST | `/user/v1/login` | body 需含 `robot_code`（必填）；返回 `access_token` + `access_expire` |
| 注册 | POST | `/user/v1/user` | 返回同上 |
| 获取验证码 | POST | `/user/v1/email/code` | body 传 `email` + `robot_code`；同一邮箱 1 分钟一次 |

> `access_expire` 是**绝对过期时间的 Unix 秒级时间戳**，不是时长。
>
> 登录的 `robot_code` 在 OpenAPI 中标注为必填，但后端目前未做校验（`todo 验证robot`），
> 前端统一传占位值 `ROBOT_CODE_PLACEHOLDER`（`'1'`），待后端接入真实验证码后再替换。

## 真实后端对接

- 开发环境 `pnpm dev` 通过 `vite.config.ts` 把 `/api` 代理到 `DEV_PROXY_TARGET`
  （默认 `http://localhost:8888`，即 Server 侧网关映射到宿主机的端口）。
- `.env` 默认 `VITE_USE_MOCK=false`，即直接请求真实后端；改为 `true` 可切回内置 mock。

## 流程

1. `/login`、`/register` 使用 `meta.layout = 'blank'`，由 `router/routes.ts` 提升为顶层路由（不套 DefaultLayout）。
2. 表单通过 `PxForm` 做本地校验，成功后调用 `useAuthStore.login/register`。
3. store 把凭证写入 `localStorage`，请求拦截器自动注入 `Authorization`。
4. 路由守卫：未登录访问受限页面 → `/login?redirect=...`；已登录访问登录/注册 → 首页。

## 校验说明

| 字段 | 规则 |
| --- | --- |
| 登录名 `login` | 邮箱或登录名**皆可**，仅要求非空（不做邮箱格式校验） |
| 密码 `password` | 仅要求**非空**，后端无任何格式 / 长度要求 |
| 注册邮箱 `email` | 必填 + 邮箱格式 |
| 邮箱验证码 `email_code` | 6 位数字 |
| 昵称 `nick_name` | 必填，不超过 20 字符 |
| 确认密码 | 必填，且需与密码一致 |

> 跨字段校验（确认密码）在组件内闭包引用 `model` 实现。pixelium 的 `validator` 第二个参数
> 运行时实际是 form 的 `model` Ref（与类型声明不符），直接用会读到 `undefined`。

## 已知限制

- 登录的 `robot_code` 必填但后端未校验（见上）。
- `POST /user/v1/email/code`（原为 GET）已由后端改为 POST，参数走 JSON 请求体，前端已同步。
- 注册错误码 `1014006` 同时表示「邮箱已存在 / 昵称已使用」，前端只能展示 `msg`。
