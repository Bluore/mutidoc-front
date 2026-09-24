# syntax=docker/dockerfile:1

# ============================================================
# 开发镜像：运行 Vite dev server
# 源码由 docker-compose.yml 以卷挂载进容器，实现改动即时热重载（HMR）。
# 生产构建请使用同目录下的 Dockerfile.prod（多阶段 → nginx 托管 dist）。
# ============================================================
FROM node:22-alpine

WORKDIR /app

ENV TZ=Asia/Shanghai

# 固定 pnpm 版本，保证与 pnpm-lock.yaml 一致
ARG PNPM_VERSION=11.1.1
# npm 源：默认走国内镜像，规避拉取超时（Docker 构建常见 exit code 146）
# 需要时可覆盖：docker build --build-arg NPM_REGISTRY=https://registry.npmjs.org ...
ARG NPM_REGISTRY=https://registry.npmmirror.com

# 写入用户级 .npmrc，npm 与 pnpm 都会读取，统一使用镜像源
RUN printf 'registry=%s\n' "${NPM_REGISTRY}" > ~/.npmrc \
  && npm install -g pnpm@${PNPM_VERSION}

# 先只拷贝依赖清单，充分利用 Docker 层缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 源码在运行期由 compose 卷挂载覆盖；此处仅作兜底，保证镜像可独立启动
COPY . .

# Vite dev server 端口
EXPOSE 80

# 监听 0.0.0.0 才能被宿主机/其他容器访问
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "80"]
