import http from 'node:http'
import https from 'node:https'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

/**
 * 开发环境 GET 带 body 兼容层。
 *
 * 后端把若干 GET 接口的入参声明为 JSON 请求体（如 `/doc/v1/document/list`、
 * `/doc/v1/document/info`），但浏览器 XHR/fetch 规范
 * 禁止 GET 携带请求体（body 会被静默丢弃），前端无法直接把参数送到后端。
 *
 * 该插件只作用于 Vite 开发服务器：拦截「带查询参数的 GET /api 请求」，
 * 把 query 转换为 JSON body 后再转发到真实后端，使本地联调可用。
 * 生产环境需要后端把这些 GET 入参改为查询参数（`form:`）或改为 POST。
 *
 * 可用 DEV_GET_BODY_SHIM=false 关闭。
 */
function devGetBodyShim(target: string): Plugin {
  return {
    name: 'dev-get-body-shim',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      const base = new URL(target)
      const transport = base.protocol === 'https:' ? https : http
      const port = base.port || (base.protocol === 'https:' ? '443' : '80')
      // 后端把 page / size 声明为 int，查询参数却是字符串，需要还原为数字
      const numericParams = new Set(['page', 'size'])

      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' || !req.url?.startsWith('/api/')) return next()

        // WebSocket 握手也是 GET，必须交给 Vite 代理处理，不能转成 JSON body。
        if (req.headers.upgrade?.toLowerCase() === 'websocket') return next()

        const url = new URL(req.url, 'http://localhost')
        if (url.searchParams.size === 0) return next()

        const payload: Record<string, string | number> = {}
        for (const [key, value] of url.searchParams) {
          payload[key] =
            numericParams.has(key) && /^-?\d+$/.test(value) ? Number(value) : value
        }
        const body = JSON.stringify(payload)
        // 复制原请求头（含 Authorization），并改写为带 JSON body 的 GET
        const headers: http.OutgoingHttpHeaders = { ...req.headers }
        delete headers.host
        headers['content-type'] = 'application/json'
        headers['content-length'] = Buffer.byteLength(body)

        const proxyReq = transport.request(
          {
            protocol: base.protocol,
            hostname: base.hostname,
            port,
            path: url.pathname + url.search,
            method: 'GET',
            headers,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )
        proxyReq.on('error', (err) => {
          res.statusCode = 502
          res.end(`dev-get-body-shim error: ${err.message}`)
        })
        proxyReq.end(body)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // prefix 传 '' 以便读取 DEV_PROXY_TARGET / DEV_USE_POLLING 这类非 VITE_ 前缀变量
  const env = loadEnv(mode, process.cwd(), '')
  // 容器内由 docker-compose 注入进程环境变量，优先级高于 .env 文件
  const proxyTarget =
    process.env.DEV_PROXY_TARGET || env.DEV_PROXY_TARGET || 'http://localhost:8888'
  const usePolling = (process.env.DEV_USE_POLLING || env.DEV_USE_POLLING) === 'true'
  const getBodyShim = (process.env.DEV_GET_BODY_SHIM || env.DEV_GET_BODY_SHIM) !== 'false'

  return {
    plugins: [vue(), ...(getBodyShim ? [devGetBodyShim(proxyTarget)] : [])],
    resolve: {
      alias: {
        // 全项目统一使用 @ 指向 src，避免出现 ../../.. 这类相对路径
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      // CodeMirror 各包互有依赖，去重避免加载到多份 @codemirror/state 实例
      dedupe: ['@codemirror/state', '@codemirror/view'],
    },
    optimizeDeps: {
      // 编辑器只在懒加载的协作编辑页里用到；提前预打包，避免首次进入该路由时
      // 触发依赖重优化 + 页面重载（表现为 “error loading dynamically imported module”）
      include: ['@codemirror/state', '@codemirror/view', '@codemirror/commands'],
    },
    server: {
      port: 5173,
      // 同时监听 IPv4（0.0.0.0）与 IPv6（::）。默认 host: 'localhost' 在本机只会绑定
      // IPv6 回环 ::1，客户端先落到 127.0.0.1 时 SYN 被丢弃、要等约 2s 才回退，
      // 表现为「首次请求卡 2 秒」。绑全地址可让两族都秒连。
      host: true,
      // 允许通过任意域名 / IP（含反向代理、内网域名）访问开发服务器，
      // 否则 Vite 会以 “Blocked request. This host is not allowed.” 拒绝请求
      allowedHosts: true,
      // 开发环境联调真实后端：/api 代理到网关（目标可用 DEV_PROXY_TARGET 覆盖）
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // 协作编辑走同一网关：放行 WebSocket 升级
          ws: true,
        },
      },
      // 容器内以「绑定挂载」运行时，轮询才能可靠感知宿主机文件变化
      // （docker-compose.yml 会设置 DEV_USE_POLLING=true）
      ...(usePolling ? { watch: { usePolling: true } } : {}),
    },
  }
})
