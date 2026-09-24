# syntax=docker/dockerfile:1

# ============================================================
# 阶段一：使用 Vite 构建静态产物
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# 固定 pnpm 版本，保证与 pnpm-lock.yaml 一致
ARG PNPM_VERSION=11.1.1
RUN npm install -g pnpm@${PNPM_VERSION}

# 先只拷贝依赖清单，充分利用 Docker 层缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 再拷贝源码并构建（build 脚本内含 vue-tsc 类型检查 + vite build）
COPY . .
RUN pnpm build

# ============================================================
# 阶段二：nginx 托管静态文件
# ============================================================
FROM nginx:1.27-alpine AS runner

ENV TZ=Asia/Shanghai

# 站点配置：SPA 回退 + 静态资源缓存 + /api 转发到已有网关
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf

# 仅拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
