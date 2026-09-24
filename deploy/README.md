# 部署说明（Docker）

前端以多阶段镜像构建：`node` 阶段执行 `pnpm install` + `pnpm build`（Vite），
`nginx` 阶段托管 `dist` 静态产物。容器加入**已存在的 `mutidoc-net` 网络**，
复用 Server 侧已部署的 `nginx-gateway` 作为统一入口。

## 前置条件

- 已创建外部网络（Server 侧使用的就是它）：
  ```bash
  docker network create --driver bridge --subnet 172.20.0.0/16 mutidoc-net
  ```
- 已启动 Server 侧的 `nginx-gateway`（容器内监听 `8081`，映射宿主机 `8888`）。

## 构建并启动

```bash
# 在本项目目录
docker compose build
docker compose up -d
docker compose logs -f mutidoc-front
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

## 环境变量

`VITE_` 变量在**构建期**注入（Vite 特性），默认读取 `.env` + `.env.production`。
需要变更接口地址或开关 mock 时，修改这两个文件后重新 `docker compose build`。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | 接口基础路径，生产为 `/api` |
| `VITE_USE_MOCK` | 是否使用内置 mock，生产为 `false` |
| `VITE_APP_TITLE` | 页面显示名，生产为 `MutiDoc` |

## 常用命令

```bash
docker compose ps                 # 查看状态（含健康检查）
docker compose restart            # 重启
docker compose down               # 停止并删除容器（不影响外部网络）
docker compose up -d --build      # 重新构建并启动
```
