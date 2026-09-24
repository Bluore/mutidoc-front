# agent 服务 API

- 来源：`app/agent/cmd/api/desc/agent.api`
- 文件状态：**空文件（0 字节）**
- 实现状态：**空脚手架**，仅有 stub，未实现任何接口

## 结论

该 `.api` 规格未定义 `info`、`import`、`service`、`type` 等任何内容，因此：

- 没有可对接的路由、请求体或响应结构。
- `Muti-Document-Server` 的 `AGENTS.md` 明确指出 `agent` 属于空脚手架，**不要基于它开发**。

## 前端接入

暂无可接入内容。前端**不要**创建 `agent` 模块或 mock 接口，等待后端补齐规格（`agent.api`）后再评估。
