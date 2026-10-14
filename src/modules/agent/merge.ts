import type {
  AgentMessage,
  AgentMessageDelta,
  AgentMessageSegment,
  AgentToolCall,
} from './types'

/** 用新消息替换数组末尾一条（不可变，保持其它引用不变）。 */
function replaceLast(
  messages: AgentMessage[],
  message: AgentMessage,
  index: number,
): AgentMessage[] {
  const next = messages.slice()
  next[index] = message
  return next
}

/**
 * 往片段列表尾部追加文本：与末尾同类型片段合并，否则新起一段。
 * 这样「思考 → 工具 → 思考 → …」的顺序得以保留，不会被拼成一大段。
 */
function appendText(
  segments: AgentMessageSegment[],
  kind: 'reasoning' | 'content',
  text: string,
): AgentMessageSegment[] {
  if (!text) return segments
  const last = segments[segments.length - 1]
  if (last && last.kind === kind) {
    const next = segments.slice()
    next[next.length - 1] = { kind, text: last.text + text }
    return next
  }
  return [...segments, { kind, text }]
}

/**
 * 追加一次工具调用片段：同一 `id` 的后续增量接着上一段工具片段累积
 * （`name` 可能先空后有，`arguments` 逐段拼接），否则新起一段。
 */
function appendToolCall(
  segments: AgentMessageSegment[],
  call: AgentToolCall,
): AgentMessageSegment[] {
  const last = segments[segments.length - 1]
  if (last && last.kind === 'tool' && last.call.id === call.id) {
    const next = segments.slice()
    next[next.length - 1] = {
      kind: 'tool',
      call: {
        id: last.call.id,
        name: last.call.name || call.name,
        arguments: last.call.arguments + call.arguments,
        result: last.call.result + call.result,
      },
    }
    return next
  }
  return [...segments, { kind: 'tool', call: { ...call } }]
}

/**
 * 把工具返回值并入对应的工具调用片段（返回新数组）。
 *
 * 匹配顺序：`tool_call_id` 精确命中 → 第一个尚无结果的调用（并行调用按序返回）→
 * 最后一个工具片段（多片流式返回的续片）。都没有时新建一个占位工具片段，
 * 保证结果仍留在当前助手回合内，而不是掉出去单独成气泡。
 */
function attachToolResult(
  segments: AgentMessageSegment[],
  result: string,
  toolCallId?: string,
): AgentMessageSegment[] {
  let index = -1
  if (toolCallId) {
    index = segments.findIndex(
      (segment) => segment.kind === 'tool' && segment.call.id === toolCallId,
    )
  }
  if (index === -1) {
    index = segments.findIndex((segment) => segment.kind === 'tool' && !segment.call.result)
  }
  if (index === -1) {
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      if (segments[i].kind === 'tool') {
        index = i
        break
      }
    }
  }
  if (index === -1) {
    return [
      ...segments,
      {
        kind: 'tool',
        call: { id: toolCallId ?? 'tool', name: '', arguments: '', result },
      },
    ]
  }

  const target = segments[index]
  if (target.kind !== 'tool') return segments

  const next = segments.slice()
  next[index] = { kind: 'tool', call: { ...target.call, result: target.call.result + result } }
  return next
}

/**
 * 把一条流式增量并入累积对话，返回新的数组（不可变，便于 Vue 触发更新）。
 *
 * 目标是「一问一答、回答只有一个气泡，且思考与工具调用按原顺序穿插」：一次助手回合里的
 * 内容按到达顺序存进同一条消息的 `segments`——
 *
 * - `assistant` 增量：`reasoning` / `content` 追加到末尾同类型片段，`toolCalls` 按 id 追加成
 *   工具片段（因此多次工具调用不会被合并到一起）；
 * - `tool` 增量：作为结果并入对应的工具调用片段（不单独成气泡）；
 * - 其余角色（user / system）：每片视为一条独立消息（内容为单个 `content` 片段）。
 *
 * 空增量（既无文本又无工具调用）直接返回原数组，调用方可用引用相等判断跳过。
 * 该函数是纯函数（无 Vue / I/O 依赖），便于单测与复用。
 */
export function mergeDelta(
  messages: AgentMessage[],
  delta: AgentMessageDelta,
): AgentMessage[] {
  const content = delta.content ?? ''
  const reasoning = delta.reasoning ?? ''
  const incomingTools = delta.toolCalls ?? []
  const lastIndex = messages.length - 1
  const last = messages[lastIndex]

  // 工具结果：并入本轮助手对应的工具调用，保持在一个气泡内。
  if (delta.role === 'tool' && content) {
    if (last && last.role === 'assistant' && last.segments.length > 0) {
      const segments = attachToolResult(last.segments, content, delta.toolCallId)
      if (segments !== last.segments) {
        return replaceLast(messages, { ...last, segments }, lastIndex)
      }
    }
    // 找不到归属（历史回放里出现孤立的工具消息）：退化为独立消息，避免丢数据。
  }

  if (!content && !reasoning && incomingTools.length === 0) return messages

  // 助手增量：累积到上一条助手消息，形成「一个回答气泡」。
  if (delta.role === 'assistant' && last && last.role === 'assistant') {
    let segments = appendText(last.segments, 'reasoning', reasoning)
    segments = appendText(segments, 'content', content)
    for (const call of incomingTools) segments = appendToolCall(segments, call)
    if (segments === last.segments) return messages
    return replaceLast(messages, { ...last, segments }, lastIndex)
  }

  // 其它角色（user / system）：新起一条消息，内容为单个正文片段。
  let segments = appendText([], 'reasoning', reasoning)
  segments = appendText(segments, 'content', content)
  for (const call of incomingTools) segments = appendToolCall(segments, call)
  return [...messages, { role: delta.role, segments }]
}
