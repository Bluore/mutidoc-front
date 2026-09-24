# 用户模块（user）

负责当前用户信息的展示与维护。

## 目录

```
modules/user/
├── api/
│   ├── user.ts                 # 获取当前用户 / 修改资料 / 头像
│   └── mock.ts
├── components/
│   ├── UserProfileCard.vue     # 信息展示卡（展示）
│   ├── UserProfileForm.vue     # 昵称编辑表单（展示，事件上抛）
│   └── UserAvatarField.vue     # 头像选择（读文件为 dataURL）
├── stores/
│   └── user.ts                 # 当前用户信息 + 加载 / 保存状态
├── views/
│   └── UserProfileView.vue     # 个人中心页面
├── types/index.ts
├── constants.ts
├── routes.ts
└── index.ts
```

## 接口映射（详见 `docs/user-api.md`）

| 功能 | 方法 | 路径 | 状态 |
| --- | --- | --- | --- |
| 获取当前用户信息 | GET | `/user/v1/user` | 已实现，返回 `{ user_info }` |
| 修改头像 | POST | `/user/v1/user/avatar` | ⚠️ 后端未实现（假成功） |
| 修改昵称 | — | — | 后端无此接口 |

## 说明

- `fetchCurrentUser` 会把响应的 `{ user_info }` 解包为 `UserInfo`。
- 修改资料 / 头像在 Mock 模式下可用；真实模式下 API 会直接抛出明确的业务提示，避免「假成功」误导 UI。
- 登录成功后由 `DefaultLayout` 调用 `ensureLoaded()` 拉取一次，全局复用。
