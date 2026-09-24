# 全局共享目录说明

- `components/`：**跨模块**复用的基础 UI 组件（如 `BaseButton.vue`）。只放与业务无关的通用组件，带业务语义的组件请放进所属模块。
- `composables/`：跨模块复用的组合式函数（如 `useDebounceFn.ts`）。
- `utils/`：纯函数工具，禁止依赖 Vue / Pinia / Router。
- `api/`：全局请求基础设施（axios 实例、错误归一化、通用类型）。
- `config/`：环境与全局常量。
- `stores/`：Pinia 实例与**全局级** store；业务 store 放在模块内。
- `styles/`：全局样式与设计令牌，详见 `styles/README.md`。
- `layouts/`：页面布局骨架。
- `modules/`：业务模块，每个模块自包含，是新增功能的主要场所。
- `views/`：不属于任何模块的全局页面（如 404）。
- `types/`：全局类型声明（env、router 等模块增强）。
