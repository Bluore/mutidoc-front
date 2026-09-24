# 样式规范（防样式穿越）

本项目采用「原生 `<style scoped>` + 设计令牌」的方案，目标是让样式天然隔离、可预测。

## 铁律

1. **组件样式一律 `scoped`**
   ```vue
   <style scoped>
   .example-card { /* 只影响当前组件 */ }
   </style>
   ```
   Vue 会给元素加上 `data-v-xxx` 属性，选择器自动带上作用域，不会外泄。

2. **全局样式只允许写在 `src/styles/` 目录**
   - `tokens.css`：设计令牌（CSS 变量），跨模块共享的唯一通道。
   - `reset.css`：全局重置，唯一允许写宽泛元素选择器的地方。
   - `utilities.css`：与业务无关的工具类，必须带 `md-` 前缀。
   - 业务组件**禁止**再写全局选择器（`body`、`.foo`、`#id` 等）。

3. **类名用 BEM，并带模块前缀**
   ```
   .example-card
   .example-card__title
   .example-card--active
   ```
   避免用 `.title`、`.list` 这类通用名（即便 scoped 也容易在 `:deep()` 时失去隔离）。

4. **样式值一律走令牌**
   ```css
   /* ✅ 正确 */
   color: var(--md-color-text-secondary);
   padding: var(--md-space-4);

   /* ❌ 错误：写死值，主题切换与统一调整会失效 */
   color: #6b7280;
   padding: 16px;
   ```

5. **慎用穿透选择器**
   - `:deep(...)` 只用于覆盖**第三方组件**内部结构，且必须写注释说明原因。
   - `:slotted(...)` 用于插槽内容，同理。
   - 能用 props / 令牌解决的问题，不要用 `:deep`。

6. **不要用 `!important`**，除非覆盖第三方内联样式，并写注释。

## 为什么这样就「不会穿越」

| 来源 | 隔离手段 |
| --- | --- |
| 组件样式 | `scoped` 编译期加 `data-v-*` 属性 |
| 共享样式 | 只通过 `--md-*` 变量传递，变量不会选择器命中别的元素 |
| 工具类 | 统一 `md-` 前缀，命名空间隔离 |
| 重置样式 | 仅 `src/styles/reset.css`，职责单一、可预期 |
