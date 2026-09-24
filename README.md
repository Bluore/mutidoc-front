# mutidoc-front

Vite + Vue 3 + TypeScript 的模块化前端基座。

## 技术栈

- **Vue 3**（`<script setup>` + Composition API）
- **Vite**（构建 / 开发服务器）
- **TypeScript**
- **Vue Router 5**（路由，模块路由自动收集）
- **Pinia**（状态管理）
- **Axios**（统一请求层）

## 快速开始

```bash
pnpm install
pnpm dev        # 开发
pnpm build      # 类型检查 + 构建
pnpm preview    # 预览构建产物
```

默认启用 mock 数据（`.env` 中 `VITE_USE_MOCK=true`），无需后端即可运行示例模块。

## 目录结构

```
src/
├── api/              # 全局请求基础设施（axios 实例、错误归一化、通用类型）
├── components/       # 跨模块复用的基础组件（BaseButton 等）
├── composables/      # 跨模块复用的组合式函数
├── config/           # 环境配置（env.ts 是读取 import.meta.env 的唯一出口）
├── layouts/          # 页面布局骨架（DefaultLayout）
├── modules/          # ★ 业务模块（新增功能的主要场所）
│   └── example/      #   示例/参考模块，详见其 README
├── router/           # 路由实例 + 模块路由自动收集
├── stores/           # Pinia 实例与全局 store
├── styles/           # 全局样式：tokens / reset / utilities（详见 README）
├── types/            # 全局类型（env、router 增强）
├── utils/            # 纯函数工具（不依赖 Vue/Pinia/Router）
├── views/            # 不属于任何模块的全局页面（404）
├── App.vue
└── main.ts
```

## 模块化约定

- 每个业务模块自包含 `api / stores / components / views / routes / types`。
- 模块路由由 `import.meta.glob` **自动收集**，新增模块无需改路由入口。
- 模块对外只暴露 `index.ts`，禁止跨模块深入引用内部文件。
- 详细步骤与命名规范见 `src/modules/example/README.md`。

## 样式隔离（防样式穿越）

采用「原生 `<style scoped>` + 设计令牌」：

1. 组件样式一律 `scoped`，Vue 编译期加 `data-v-*`，天然不外泄。
2. 全局样式只允许写在 `src/styles/`，且工具类统一 `md-` 前缀。
3. 样式值统一走 `var(--md-*)`，禁止写死。
4. 类名用 BEM 并带模块前缀，避免通用名。
5. `:deep()` 仅用于覆盖第三方组件并写注释；禁止 `!important`。

详见 `src/styles/README.md`。

## 配置

复制 `.env.example` 为对应环境文件并按需修改。自定义变量必须以 `VITE_` 开头。
