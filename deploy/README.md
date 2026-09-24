# 部署说明（Docker）

生产镜像 `Dockerfile.prod` 以多阶段构建：`node` 阶段执行 `pnpm install` + `pnpm build`（Vite），
`nginx` 阶段托管 `dist` 静态产物；由 `docker-compose.prod.yml` 编排。容器加入**已存在的
`mutidoc-net` 网络**，复用 Server 侧已部署的 `nginx-gateway` 作为统一入口。

开发环境（Vite dev server + HMR）是另一套：`Dockerfile` + `docker-compose.yml`，见下。

## 开发环境（热重载）

容器内跑 Vite dev server、改文件即时热更新，用开发编排 `docker-compose.yml`
（镜像 `Dockerfile`，不涉及 nginx）：

```bash
docker compose -f docker-compose.yml up -d      # 首次会自动 build 镜像
docker compose -f docker-compose.yml logs -f    # 查看 Vite 输出
docker compose -f docker-compose.yml down       # 停止
```

访问 <http://localhost:8890/>（容器内 Vite 监听 80）。源码目录以卷挂载进容器（`.:/app`），
修改后浏览器自动热更新；`node_modules` 用匿名卷遮蔽，使用镜像内依赖，避免宿主机与容器平台不一致。

开发容器同样加入 `mutidoc-net`（服务名即网络主机名 `mutidoc-front`），因此网关可直接
`proxy_pass http://mutidoc-front:80`；若仅本机开发，需先按下节创建该外部网络。

- 依赖变化（`package.json` / `pnpm-lock.yaml`）后需 `--build` 重建镜像。
- 联调真实后端：默认即走真实网关（`.env` 中 `VITE_USE_MOCK=false`），`/api` 经
  `DEV_PROXY_TARGET`（默认 `http://host.docker.internal:8888`）代理；也可用 `http://nginx-gateway:8081`。
- 后端部分 GET 接口（文档列表 / 文档详情）要求 JSON 请求体，而浏览器禁止 GET 带 body；
  开发容器内的 Vite 通过 `dev-get-body-shim` 把查询参数转成 body 转发（`DEV_GET_BODY_SHIM=false` 可关闭）。
  生产由 nginx 直接转发，无法转换，需后端改为查询参数（`form:`）或 POST，详见各模块 README。
- 如需脱离后端演示：`VITE_USE_MOCK=true docker compose -f docker-compose.yml up -d`。

## 前置条件

- 已创建外部网络（Server 侧使用的就是它）：
  ```bash
  docker network create --driver bridge --subnet 172.20.0.0/16 mutidoc-net
  ```
- 已启动 Server 侧的 `nginx-gateway`（容器内监听 `8081`，映射宿主机 `8888`）。

## 构建并启动（生产）

```bash
# 在本项目目录
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f mutidoc-front
```

访问方式：

- 直接访问前端容器：<http://localhost:8890/>（容器内 `/api/` 会转发到网关）
- 通过网关访问（见下方配置）：<http://localhost:8888/>

## 与网关对接

网关若要托管前端首页，在其 `deploy/nginx/conf.d/mutidoc.conf` 的 server 块中追加：

```nginx
location / {
    proxy_set_header Host            $http_host;
    proxy_set_header X-Real-IP       $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass http://mutidoc-front:80;
}
```

> 说明：nginx 的 `location ~ /api/user/`、`location ~ /api/doc/` 为正则匹配，
> 优先级高于 `location /`，因此 `/api/*` 仍会被网关直接转发到对应后端；
> 其余请求才会落到前端容器。前端同源访问，无跨域问题。
>
> 生产与开发容器的主机名都是 `mutidoc-front`，但两者不能同时运行
> （`container_name` 相同），切换时先 `down` 掉另一个。

## 环境变量

`VITE_` 变量在**构建期**注入（Vite 特性），默认读取 `.env` + `.env.production`。
需要变更接口地址或开关 mock 时，修改这两个文件后重新
`docker compose -f docker-compose.prod.yml build`。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | 接口基础路径，生产为 `/api` |
| `VITE_USE_MOCK` | 是否使用内置 mock，生产为 `false` |
| `VITE_APP_TITLE` | 页面显示名，生产为 `MutiDoc` |

## 构建镜像时的 npm 源

Docker 构建阶段安装 pnpm / 依赖默认走国内镜像 `https://registry.npmmirror.com`，
可规避 `registry.npmjs.org` 连接超时导致的构建失败（典型报错为 `exit code: 146`）。
如需切换（例如海外 CI 或内网私有源），构建时覆盖 `NPM_REGISTRY` 即可：

```bash
# 开发环境
NPM_REGISTRY=https://registry.npmjs.org docker compose -f docker-compose.yml up -d --build
# 生产环境
NPM_REGISTRY=https://registry.npmjs.org docker compose -f docker-compose.prod.yml up -d --build
```

## 常用命令（生产）

```bash
docker compose -f docker-compose.prod.yml ps                    # 查看状态（含健康检查）
docker compose -f docker-compose.prod.yml restart               # 重启
docker compose -f docker-compose.prod.yml down                  # 停止并删除容器（不影响外部网络）
docker compose -f docker-compose.prod.yml up -d --build         # 重新构建并启动
```

开发环境把 `-f docker-compose.prod.yml` 换成 `-f docker-compose.yml` 即可（开发镜像无健康检查）。
