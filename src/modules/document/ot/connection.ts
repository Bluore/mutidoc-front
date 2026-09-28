/**
 * WebSocket 传输层。
 *
 * 只负责「建连 / 收帧 / 发帧 / 关闭」并暴露回调，不感知 OT 协议与 UI，
 * 因此 `ot-client.ts` 与 `stores/collaboration.ts` 可以复用同一个传输抽象，
 * 也便于将来替换为其它实现（例如测试用的内存连接）。
 *
 * 参考实现：`reference/ts/connontion.ts`（全局单例 `ws`）。这里改为工厂函数返回
 * 一个连接对象，避免模块级单例在 Vue 组件反复挂载时互相干扰。
 */

/** 连接生命周期回调；帧统一以已解析的 JSON 值回调。 */
export interface CollabTransportHandlers {
  /** socket 打开后调用。 */
  onOpen?: () => void
  /** 每收到一帧服务端消息时调用（已 JSON.parse）。 */
  onMessage?: (message: unknown) => void
  /** socket 被任一方关闭时调用。 */
  onClose?: (code: number, reason: string) => void
  /** 传输错误或帧解析失败时调用。 */
  onError?: (error: unknown) => void
}

/** 一个协作连接的最小接口。 */
export interface CollabTransport {
  /** 发送一帧 JSON；连接未就绪时返回 false。 */
  send(payload: unknown): boolean
  /** 关闭连接；幂等。 */
  close(): void
}

/**
 * 建立到 `url` 的 WebSocket 连接。
 *
 * @param url 协作编辑端点，例如 `ws://host/api/doc/v1/document/edit?document_id=1`
 * @param handlers 生命周期回调
 */
export function createWebSocketTransport(
  url: string,
  handlers: CollabTransportHandlers = {},
): CollabTransport {
  const socket = new WebSocket(url)

  socket.onopen = () => {
    handlers.onOpen?.()
  }

  socket.onmessage = (event) => {
    let message: unknown
    try {
      message = JSON.parse(String(event.data)) as unknown
    } catch (error) {
      handlers.onError?.(error)
      return
    }
    handlers.onMessage?.(message)
  }

  socket.onclose = (event) => {
    handlers.onClose?.(event.code, event.reason)
  }

  socket.onerror = (event) => {
    handlers.onError?.(event)
  }

  return {
    send(payload) {
      if (socket.readyState !== WebSocket.OPEN) return false
      socket.send(JSON.stringify(payload))
      return true
    },
    close() {
      // 已经关闭 / 正在关闭时不必再调用，避免触发多余的 close 事件。
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    },
  }
}
