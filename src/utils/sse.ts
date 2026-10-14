/**
 * 通用 SSE（Server-Sent Events）增量解析器。
 *
 * 与业务无关，可被任意模块复用：`fetch` 响应体是字节流，解码后的文本可能在任意位置被
 * 切断（一行、一个字段，甚至一个多字节字符都可能跨分片），因此必须增量解析，并在内部
 * 缓存尚未结束的行。
 *
 * 支持规范约定的三种行结束符（`\r\n` / `\n` / `\r`）；以 `:` 开头的行为注释（如心跳
 * `: ping`）会被忽略。只保留业务常用的 `event` / `data` / `id` 三个字段。
 */

/** 一条已解析、已遇到空行而「派发」的 SSE 消息 */
export interface SseMessage {
  /** 事件类型，未显式声明时为 `message` */
  event: string
  /** 同一条消息内多个 `data` 字段按 `\n` 拼接后的完整内容 */
  data: string
  /** 最近一次 `id` 字段的值（断线续传时可作为 Last-Event-ID） */
  id: string
}

/**
 * 创建一个增量解析函数。
 *
 * 每次把新解码出的文本分片交给返回的函数，它会返回该分片内**已经完整**（遇到空行）
 * 的消息数组；未完成的部分留在闭包缓存里，等待下一个分片继续拼接。
 */
export function createSseParser(): (chunk: string) => SseMessage[] {
  /** 尚未消费的文本（可能是半行，也可能只是 `\r\n` 的前半段） */
  let buffer = ''
  /** 当前消息累积的 data 字段 */
  let dataLines: string[] = []
  /** 当前消息的 event 字段 */
  let eventName = ''
  /** 最近一次 id 字段，跨消息保留 */
  let lastId = ''

  function resetField(): void {
    dataLines = []
    eventName = ''
  }

  function dispatch(messages: SseMessage[]): void {
    // 与规范一致：data 缓冲区为空时不派发消息（纯注释 / 仅 event 名都不算）。
    if (dataLines.length === 0) {
      resetField()
      return
    }
    messages.push({
      event: eventName || 'message',
      data: dataLines.join('\n'),
      id: lastId,
    })
    resetField()
  }

  function handleLine(line: string, messages: SseMessage[]): void {
    if (line === '') {
      dispatch(messages)
      return
    }
    // 注释行（如服务端心跳 `: ping`）直接忽略
    if (line.startsWith(':')) return

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    // 规范要求：冒号后若紧跟一个空格，则去掉这一个空格
    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'data':
        dataLines.push(value)
        break
      case 'event':
        eventName = value
        break
      case 'id':
        lastId = value
        break
      default:
        // retry 等字段当前用不到，忽略
        break
    }
  }

  return (chunk: string): SseMessage[] => {
    buffer += chunk
    const messages: SseMessage[] = []

    for (;;) {
      const match = /\r\n|\r|\n/.exec(buffer)
      if (!match) break
      // 行尾恰好是孤立的 `\r` 时，可能是 `\r\n` 的前半段，留到下一个分片再判断，
      // 否则会把 `\r\n` 误当成两条换行、多派发一次消息。
      if (match[0] === '\r' && match.index + 1 === buffer.length) break

      handleLine(buffer.slice(0, match.index), messages)
      buffer = buffer.slice(match.index + match[0].length)
    }

    return messages
  }
}
