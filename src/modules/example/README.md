# 示例模块（example）

> 这是**新模块的参考模板**。新增业务模块时，复制本目录结构并按需裁剪即可。

## 目录职责

```
modules/example/
├── api/
│   ├── example.ts        # 接口定义：统一走 @/api 的 request()
│   └── mock.ts           # 可选：后端未就绪时的本地假数据（上线可删）
├── components/           # 仅本模块使用的组件
│   └── ExampleCard.vue
├── stores/               # 模块级 Pinia store
│   └── example.ts
├── types/
│   └── index.ts          # 模块类型：实体 / 查询 / 入参
├── views/                # 路由页面
│   ├── ExampleListView.vue
│   └── ExampleDetailView.vue
├── constants.ts          # 枚举、选项、常量
├── routes.ts             # 路由（默认导出，会被自动收集）
├── index.ts              # 模块出口（Public API）
└── README.md
```

## 数据流（单向）

```
View ──调用──▶ Store(action) ──调用──▶ api/*.ts ──request()──▶ 后端
  ▲                                        │
  └──────────── 响应式 state ◀─────────────┘
```

- **View 不直接调 API**，只调用 store 的 action。
- **Store 不碰 DOM / Router**，只负责状态与数据编排。
- **api 层不含业务状态**，只负责请求与类型。

## 新增一个模块的标准步骤

1. 复制 `src/modules/example` 为 `src/modules/<your-module>`，重命名内部文件/标识。
2. 删除 `api/mock.ts`，在 `api/<name>.ts` 中改为真实接口。
3. 在 `routes.ts` 里定义路由，`name` 用「模块名-动作」保证全局唯一。
4. 在 `index.ts` 中只导出需要对外暴露的内容。
5. **无需修改 `src/router/routes.ts`**，路由会被 `import.meta.glob` 自动收集。

## 命名约定

| 类型 | 约定 | 示例 |
| --- | --- | --- |
| 路由 name | `<module>-<action>` | `example-list` / `example-detail` |
| store id | `<module>` | `example` |
| store 文件 | `stores/<module>.ts` | `stores/example.ts` |
| 组件 | PascalCase | `ExampleCard.vue` |
| CSS 类 | BEM + 模块前缀 | `.example-card__title` |
| 类型 | PascalCase，联合类型代替代替 enum | `ExampleStatus` |

## 样式要求（重点：防穿越）

- 所有 `<style>` 必须加 `scoped`。
- 只使用 `var(--md-*)` 设计令牌，禁止写死颜色/间距。
- 类名带模块前缀（`example-`），避免通用名。
- 需要覆盖第三方组件时用 `:deep()` 并写注释；禁止 `!important`。
- 细节见 `src/styles/README.md`。

## 跨模块共享规则

- 只有**与业务无关**的东西才上移到 `src/components`、`src/composables`、`src/utils`。
- 模块之间如需协作，只能通过对方的 `index.ts` 导入，不要深入内部文件。
