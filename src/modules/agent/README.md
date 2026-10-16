# Agent 模块（agent）

协作编辑页的 Agent 助手：右下角悬浮按钮打开右侧浮层侧栏，向 Agent 提问，Agent 通过
SSE 流式回复。侧栏固定在页面上、默认收起，不参与文档流、不挤占页面空间。
模块只提供一个可复用的侧栏组件与配套 store，不占用独立路由。

## 目录

```
modules/agent/
├── api/
│   └── agent.ts            # 建会话 / 追问（REST）+ 事件流订阅（SSE）
├── components/
│   └── AgentSidebar.vue    # 右下角悬浮按钮 + 右侧浮层侧栏（对话 / 历史会话两个视图）
├── stores/
│   └── agent.ts            # 会话编排（sessionId / messages / 状态机）
├── merge.ts                # 流式增量合并（纯函数，可单测）
├── user-context.ts         # 用户消息 <context> 块的字符串截取（纯函数，可单测）
├── types/index.ts          # AgentMessage / AgentMessageSegment / AgentMessageDelta / AgentToolCall / AgentStreamPayload / AgentStatus / AgentCondition
├── constants.ts            # 状态文案、角色名、长度上限
└── index.ts                # 对外出口
```

通用 SSE 解析器在 `src/utils/sse.ts`（与业务无关，可复用）。Markdown 渲染在
`src/utils/markdown.ts`（markdown-it + DOMPurify，输出已消毒 HTML）与
`src/components/MarkdownText.vue`（`v-html` 承载，内容样式在 `src/styles/markdown.css`）。

## 接口映射

| 功能 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 创建会话 | POST | `/agent/v1/session/create` | body `{ query, condition }`，返回 `{ session_id }` |
| 追问 | POST | `/agent/v1/session/resume` | body `{ query, session_id, condition }`，返回空 data |
| 历史会话列表 | GET | `/agent/v1/session/list` | 返回 `{ sessions: [{ session_id, session_title, user_id }], session_len }` |
| 订阅事件流 | GET | `/agent/v1/session/stream/{id}` | `text/event-stream`，逐条下发消息增量 |

### 会话流程

1. 首次提问 → `create` 拿到 `session_id`；之后每次提问 → `resume`。
2. 提交成功后订阅 `stream/{session_id}`，持续接收事件直到出现终态（`status === 2`）。
3. 请求携带与其余接口一致的凭证（`Authorization: Bearer <md_token>`）。

### 提问上下文（`condition`）

`create` 与 `resume` 的 `condition` 都是**字符串化的 JSON**（不是嵌套对象），用于携带
本轮请求的环境上下文；后端把它转成自然语言拼进提问，不影响响应结构。`api/agent.ts`
的 `createAgentSession` / `resumeAgentSession` 统一做 `JSON.stringify`（传对象会解析失败
返回 `1044004`），store 与视图只提供 `AgentCondition` 对象。

- 字段（全部可选，缺省即忽略）：`user_id` / `user_name` / `document_id` /
  `document_name` / `cursor_anchor` / `cursor_select` / `timestamp`（毫秒）/
  `time_zone` / `language`。
- `user_ip` 由后端从转发头解析后回填，前端**不传**；`condition` 缺省时发送 `"{}"`，
  行为与旧版一致。
- 上下文由宿主页面通过 `AgentSidebar` 的 `resolveCondition` 属性提供（每次提问即时
  求值），组件本身不感知文档 / 用户，保持可复用。

### 查找与恢复历史

- 侧栏头部「历史会话」按钮切到列表视图，`loadSessions()` 调 `GET /agent/v1/session/list`；
  后端下划线字段在 API 层适配为 `AgentSession { id, title, userId }`。
- 点击某个会话即 `restore(sessionId)`：切换 `sessionId`、清空本地消息，并订阅
  `stream/{sessionId}`（服务端会**回放整段历史**），之后可继续用 `ask` 追问。
- **事件流按「整段会话回放」处理**：恢复历史时服务端会在**一个事件**里下发整段会话
  （`msg` 是完整消息数组，全部 `tool_call` 也在同一事件里）；实时对话则是逐条增量。
  两种形态都走同一条订阅 + 合并路径：`restore` 会先清空本地消息再订阅，`ask` 则在收到
  本轮第一条增量时清空旧对话再重建，避免与上一轮历史重复。

## SSE 约定与适配

事件有**两种形态**，解析与合并都统一处理。

**实时增量**（逐条）：`msg` 通常只带一条增量，工具调用单独成帧：

```
data: {"msg":[{"role":"user","content":"hi"}],"status":1}
data: {"status":1}                                  ← 心跳：没有 msg
data: {"msg":[{"role":"assistant","reasoning":"The"}],"status":1}
data: {"msg":[{"role":"assistant","content":"你好！","reasoning":" rather than transfer."}],"status":1}
data: {"tool_call":[{"offset":82,"tool_msg":"{\"index\":0,\"id\":\"call_00_..\",\"type\":\"function\",\"function\":{\"name\":\"maps_weather\",\"arguments\":\"{\\\"city\\\": \\\"北京\\\"}\"}}"}]}
data: {"msg":[{"role":"tool","content":"{\"city\":\"北京市\",\"forecasts\":[…]}"}],"status":1}
data: {"msg":[{"role":"assistant","content":"我是路由智能体…"}],"status":1}
data: {"status":2}                                  ← 终态
```

**历史回放**（一个事件带整段会话）：`msg` 是**完整消息数组**（user / assistant / tool
交错），全部 `tool_call` 也一并下发，`status` 直接为 `2`。工具调用不带消息序号，
但 `tool_call` 与 `tool` 消息都按发生顺序排列，因此**按序配对**：

```
data: {"msg":[{"role":"user","content":"东软的天气"},
              {"role":"assistant","content":"我来帮您查询。","reasoning":"…"},
              {"role":"tool","content":"{搜索东软}"},
              {"role":"assistant","reasoning":"…"},
              {"role":"tool","content":"{沈阳天气}"},
              {"role":"tool","content":"{北京天气}"},
              {"role":"assistant","content":"东软在多地有园区…","reasoning":"…"}],
       "tool_call":[{"offset":465,"tool_msg":"{\"id\":\"call_A\",…maps_text_search…}"},
                    {"offset":10723,"tool_msg":"{\"id\":\"call_C\",…maps_weather 沈阳…}"},
                    {"offset":10864,"tool_msg":"{\"id\":\"call_D\",…maps_weather 北京…}"}],
       "status":2}
```

- **同一角色的分片累积到同一条消息**：`reasoning`（思考）与 `content`（正文）会分多次到达，
  store 把它们分别拼接；其余角色（user / tool / system）每片视为新消息。
- **一次助手回合收敛成一个气泡，且顺序不丢**：助手消息用有序的 `segments` 承载内容——
  `reasoning` / `content` 追加到末尾同类型片段，`tool_call` 适配成 `role: 'assistant'`
  增量并按 `id` 追加成 `tool` 片段。因此「思考 → 工具 → 思考 → 工具 → 正文」的顺序与事件流
  一致，不会被合并成「所有思考 + 所有工具调用」两块。
- **工具调用与结果按序配对**：解析器遇到一条 `role: 'tool'` 消息时，先补一条对应的
  `tool_call` 增量、再放结果，从而让「调用 + 结果」在历史回放里也落在正确位置；结果并入
  对应调用（优先 `tool_call_id`，否则按序挂到第一个尚无结果的调用上），不再单独成气泡。
- 没有 `msg`（或 `msg` 为空、且无 `tool_call`）的事件是心跳，忽略即可；含 `status === 2`
  的事件为终态。
- 解析前做结构校验，格式非法的事件直接丢弃；`msg` 只保留 `role` / `content` / `reasoning`
  / `tool_call_id`，`tool_call` 只保留 `id` / `name` / `arguments`。
- 浏览器原生 `EventSource` 无法设置请求头，故 `api/agent.ts` 改用
  `fetch` + `ReadableStream` 手动解析，既能注入鉴权，也能用 `AbortSignal` 取消订阅。
- 收到终态后服务端可能仍保持连接（心跳），store 会主动 `abort()` 结束订阅，避免一直
  停留在「回复中」。离开页面时同样会中止并清空会话。

## 数据流

```
View ──调用──▶ Store(action: ask/stop/reset) ──▶ api/*.ts ──▶ REST + SSE ──▶ 后端
  ▲                                                    │
  └──────────────── 响应式 state（messages/status）◀────┘
```

- 视图只调用 store 的 action，不直接接触 `fetch` / SSE。
- store 不碰 DOM / Router；滚动与键盘交互都留在组件里。
- 角色用联合类型（`AgentRole`）而非 enum，符合 `erasableSyntaxOnly`。

## 界面与交互

- **入口**：右下角悬浮按钮（`position: fixed`）打开 / 收起侧栏，缺省收起。
- **侧栏**：`position: fixed` 的右侧浮层，`Teleport` 到 `body`，不进入文档流、不挤压
  正文与协作面板；默认窄栏 `min(380px, 100vw)`，点头部「全屏」按钮可拉宽到铺满视口
  （内容收在 900px 中轴阅读带内），再点「退出全屏」还原。
- **关闭**：头部关闭按钮或 `Esc`（`Esc` 先退出全屏、再关闭）；离开协作编辑页时中止
  事件流并清空会话。
- 消息列表自适应剩余高度并自动滚到底部；输入框支持 Enter 发送、Shift+Enter 换行，
  输入法合成期间的回车不发送。
- 用户气泡会把服务端回显的 `<context>…</context>` 环境上下文**字符串截取**出来：
  正文只展示用户真正输入的内容，截取出的上下文放进一个「环境上下文」折叠区
  （默认收起）；解析见 `user-context.ts` 的 `splitUserContext`。
- 助手气泡内按 `segments` 顺序**穿插**渲染：每段 `reasoning` 是一个「思考过程」折叠区、
  每段 `tool` 是一个「工具调用 · 工具名」折叠区（展开后显示参数 / 返回结果，能解析为 JSON 时
  格式化），`content` 段作为正文铺开。因一次助手回合只渲染这一个气泡，正文出现前显示
  打字动画。
- **Markdown 渲染**：用户输入正文与助手 `content` 正文经 `MarkdownText` 组件渲染
  （markdown-it 解析 + DOMPurify 消毒，`html: false`、`breaks: true`、外链新窗口打开），
  支持标题 / 列表 / 加粗 / 行内代码 / 代码块 / 表格 / 引用等；`reasoning` 思考过程、
  工具参数 / 结果（JSON）与「环境上下文」仍按原文等宽展示，不做 Markdown 解析。
- 头部「历史会话」按钮切到列表视图（含加载 / 出错 / 空态），点选会话即恢复并切回对话；
  恢复期间状态标签显示「载入中」。
- 生成中禁用输入与会话切换，可点「停止」结束本轮；`Esc` 或关闭按钮收起侧栏。

## 已知取舍

- 会话只存在于服务端进程内，前端不做持久化；切走页面即结束会话。
- **事件流按「连接即回放整段会话」理解**：因此每轮订阅都会先清空本地消息再重建，
  恢复历史也复用该路径。若后端改为只推送连接之后的事件（不回放），需要相应调整
  `stores/agent.ts` 里的 `resetOnNextEvent` 逻辑。
- 尚无 mock：`streamAgentSession` 依赖真实后端，`VITE_USE_MOCK=true` 时同样需要后端
  提供 Agent 服务（与协作编辑 WebSocket 的处理一致）。
- 生产环境经 `deploy/nginx/default.conf` 暴露，已为 `/api/agent/` 单独关闭
  `proxy_buffering` 并放宽 `proxy_read_timeout`；否则 nginx 会缓冲 SSE，前端看不到
  逐条回复。若网关（`nginx-gateway`）本身也做缓冲，需在其侧一并关闭。
