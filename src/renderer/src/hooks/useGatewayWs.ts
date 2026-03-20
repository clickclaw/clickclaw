/**
 * useGatewayWs — OpenClaw Gateway WebSocket 客户端 Hook
 *
 * 协议（Ed25519 设备签名模式）：
 * 1. 连接 ws://127.0.0.1:<port>/ws?token=<token>
 * 2. Gateway 发 connect.challenge（带 nonce）
 * 3. 客户端用私钥对 payload 签名，发送 connect req（含 device 签名 + auth.token）
 * 4. 握手成功 → 存储 Gateway 颁发的 deviceToken，下次复用
 * 5. 从 snapshot.sessionDefaults.mainSessionKey 获取 sessionKey
 * 6. 开始正常通信（chat.send / chat.history / chat.abort）
 *
 * 错误自动修复：
 * - TOKEN_MISMATCH  → 清除本地 deviceToken，用 gatewayToken 重签（最多 1 次）
 * - NOT_PAIRED / origin not allowed → 自动写入 allowedOrigins，重启后重连（最多 1 次）
 *
 * 流式事件：
 * - delta: message.content 为累积全文（直接替换，非增量追加）
 * - final: 最终内容 + usage + durationMs
 * - aborted: 用户中止
 * - error: 错误信息
 */

import { useEffect, useRef, useCallback, useState } from 'react'

// ========== 类型定义 ==========

export type WsStatus = 'disconnected' | 'connecting' | 'handshaking' | 'ready' | 'error'

export interface ChatUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ChatToolCall {
  id: string
  name: string
  argumentsText?: string
  resultText?: string
  status: 'loading' | 'success' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 思考内容（assistant） */
  thinking?: string
  /** 工具调用链（assistant） */
  toolCalls?: ChatToolCall[]
  /** 流式状态（仅 assistant 消息有效） */
  streaming?: boolean
  /** token 消耗 */
  usage?: ChatUsage
  /** 耗时 ms */
  durationMs?: number
  /** 当前回答模型 */
  model?: string
  /** 当前回答提供方 */
  provider?: string
  /** 附件（用户消息） */
  attachments?: AttachmentPayload[]
}

/** 发送消息时的附件载荷 */
export interface AttachmentPayload {
  category: 'image' | 'document' | 'video' | 'audio'
  mimeType: string
  fileName: string
  content: string // base64
}

/** 会话列表项 */
export interface SessionItem {
  key: string
  label: string
  updatedAt?: number
}

export interface ChatEventPayload {
  state: 'delta' | 'final' | 'aborted' | 'error'
  sessionKey: string
  runId: string
  message?: { content: string | ContentBlock[]; model?: string; provider?: string }
  usage?: unknown
  durationMs?: number
  model?: string
  provider?: string
  errorMessage?: string
  error?: { message: string; code?: string }
}

interface ContentBlock {
  type: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  arguments?: unknown
  toolCallId?: string
  content?: unknown
  isError?: boolean
}

interface WsFrame {
  type: 'req' | 'res' | 'event'
  id?: string
  ok?: boolean
  method?: string
  params?: unknown
  payload?: unknown
  error?: { message: string; code?: string }
  event?: string
}

interface RealtimeMessagePayload {
  id?: string
  role?: string
  content?: string | ContentBlock[]
  sessionKey?: string
  toolCallId?: string
  toolName?: string
  stopReason?: string
  isError?: boolean
  usage?: unknown
  durationMs?: number
  model?: string
  provider?: string
}

interface AgentToolEventPayload {
  runId?: string
  sessionKey?: string
  stream?: string
  data?: {
    toolCallId?: string
    name?: string
    phase?: string
    args?: unknown
    partialResult?: unknown
    result?: unknown
  }
}

// ========== 常量 ==========

const CHALLENGE_TIMEOUT_MS = 5000
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]
const PING_INTERVAL_MS = 25000
const DEBUG_LOG_MAX_LEN = 30_000

let _reqSeq = 0
function nextId(prefix = 'req'): string {
  return `${prefix}-${++_reqSeq}-${Math.random().toString(36).slice(2, 7)}`
}

/** 从 content（string 或 ContentBlock[]）提取纯文本 */
function extractText(content: string | ContentBlock[] | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  return content
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text!)
    .join('')
}

function extractToolResultText(content: unknown): string | undefined {
  if (!content) return undefined
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined
  const text = content
    .map((item) => {
      const block = item as ContentBlock
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
  return text || undefined
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function normalizeUsage(usage: unknown): ChatUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined
  const data = usage as Record<string, unknown>
  const inputTokens = toNumber(data.input_tokens ?? data.input) ?? 0
  const outputTokens = toNumber(data.output_tokens ?? data.output) ?? 0
  const totalTokens =
    toNumber(data.total_tokens ?? data.totalTokens ?? data.total) ?? inputTokens + outputTokens
  if (inputTokens === 0 && outputTokens === 0 && totalTokens === 0) return undefined
  return { inputTokens, outputTokens, totalTokens }
}

function pickText(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return undefined
}

function toJsonText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function stringifyForDebugLog(value: unknown, maxLen = DEBUG_LOG_MAX_LEN): string {
  const seen = new WeakSet<object>()
  const json = JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === 'bigint') return String(val)
      if (typeof val === 'function') return '[Function]'
      if (val && typeof val === 'object') {
        if (seen.has(val)) return '[Circular]'
        seen.add(val)
      }
      return val
    },
    2
  )
  if (!json) return ''
  if (json.length <= maxLen) return json
  return `${json.slice(0, maxLen)}...<truncated ${json.length - maxLen} chars>`
}

function normalizeAssistantContent(content: string | ContentBlock[] | undefined): {
  text: string
  thinking?: string
  toolCalls?: ChatToolCall[]
} {
  if (!content) return { text: '' }
  if (typeof content === 'string') return { text: content }

  const textParts: string[] = []
  const thinkingParts: string[] = []
  const toolCalls: ChatToolCall[] = []

  for (const block of content) {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text)
      continue
    }
    if (block.type === 'thinking' && block.thinking) {
      thinkingParts.push(block.thinking)
      continue
    }
    if (block.type === 'toolCall') {
      const id = pickText(block.id) || nextId('tool')
      const name = pickText(block.name) || 'tool'
      toolCalls.push({
        id,
        name,
        argumentsText: toJsonText(block.arguments),
        status: 'loading',
      })
      continue
    }
    if (block.type === 'toolResult') {
      const targetId = pickText(block.toolCallId, block.id)
      if (!targetId) continue
      const idx = toolCalls.findIndex((t) => t.id === targetId)
      if (idx < 0) continue
      toolCalls[idx] = {
        ...toolCalls[idx],
        resultText: extractToolResultText(block.content),
        status: block.isError ? 'error' : 'success',
      }
    }
  }

  return {
    text: textParts.join(''),
    thinking: thinkingParts.length > 0 ? thinkingParts.join('\n\n') : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  }
}

function mergeToolCalls(
  base: ChatToolCall[] | undefined,
  incoming: ChatToolCall[] | undefined
): ChatToolCall[] | undefined {
  if (!base?.length) return incoming
  if (!incoming?.length) return base
  const next = [...base]
  for (const tool of incoming) {
    const idx = next.findIndex((item) => item.id === tool.id)
    if (idx < 0) {
      next.push(tool)
      continue
    }
    next[idx] = {
      ...next[idx],
      ...tool,
      argumentsText: tool.argumentsText ?? next[idx].argumentsText,
      resultText: tool.resultText ?? next[idx].resultText,
    }
  }
  return next
}

/** 从 sessionKey 解析显示名称（格式：agent:<agentId>:<channelName>） */
export function parseSessionLabel(key: string): string {
  const parts = (key || '').split(':')
  if (parts.length < 3) return key || '未知'
  const agent = parts[1] || 'main'
  const channel = parts.slice(2).join(':')
  if (agent === 'main' && channel === 'main') return '主会话'
  if (agent === 'main') return channel
  return `${agent} / ${channel}`
}

// ========== Hook ==========

/** agents.list RPC 返回的单个 Agent 行 */
export interface GatewayAgentRow {
  id: string
  name?: string
  identity?: {
    name?: string
    theme?: string
    emoji?: string
    avatar?: string
    avatarUrl?: string
  }
}

/** agents.list RPC 返回结构 */
export interface AgentsListResult {
  defaultId: string
  mainKey: string
  scope: string
  agents: GatewayAgentRow[]
}

export interface UseGatewayWsReturn {
  status: WsStatus
  sessionKey: string | null
  errorMsg: string | null
  messages: ChatMessage[]
  historyLoading: boolean
  /** Gateway 进程是否处于运行状态（独立于 WS 连接状态） */
  gatewayRunning: boolean
  /** 是否正在流式输出 */
  isStreaming: boolean
  /** 会话列表 */
  sessions: SessionItem[]
  /** 握手时获取的默认 agentId */
  defaultAgentId: string
  /** 发送聊天消息（支持附件） */
  sendMessage: (text: string, attachments?: AttachmentPayload[]) => void
  /** 中止当前流式生成 */
  abortMessage: () => void
  /** 新建会话：切换到 agent:<agentId>:<name> */
  newSession: (name: string, agentId?: string) => void
  /** 手动重连 */
  reconnect: () => void
  /** 切换到指定会话 */
  switchSession: (key: string) => void
  /** 删除会话，返回 Promise 供调用方处理结果 */
  deleteSession: (key: string) => Promise<void>
  /** 重置当前会话（清空历史），返回 Promise 供调用方处理结果 */
  resetSession: (targetKey?: string) => Promise<void>
  /** 刷新会话列表 */
  refreshSessions: () => void
  /** 通过 WS RPC 列出所有运行时 Agent（含隐式 main），WS 未就绪时返回 null */
  listAgents: () => Promise<AgentsListResult | null>
  /** 通用 WS RPC 调用，WS 未就绪时 reject */
  callRpc: (method: string, params: unknown) => Promise<unknown>
}

export function useGatewayWs(): UseGatewayWsReturn {
  const [status, setStatus] = useState<WsStatus>('disconnected')
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [gatewayRunning, setGatewayRunning] = useState(false)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [defaultAgentId, setDefaultAgentId] = useState('main')

  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<
    Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>
  >(new Map())
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const challengeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectCountRef = useRef(0)
  const intentionalCloseRef = useRef(false)
  const currentRunIdRef = useRef<string | null>(null)
  const portRef = useRef<number>(0)
  const tokenRef = useRef<string>('')
  const sessionKeyRef = useRef<string | null>(null)
  const statusRef = useRef<WsStatus>('disconnected')
  /** 握手时记录的主会话 key（用于删除当前会话后的回退） */
  const mainSessionKeyRef = useRef<string | null>(null)
  /** 最多尝试 1 次 origin 自动修复 */
  const autoPairAttemptsRef = useRef(0)
  /** 最多尝试 1 次 TOKEN_MISMATCH 重试 */
  const retryMismatchRef = useRef(0)
  /** 本机 deviceId（用于 storeDeviceToken / clearDeviceToken） */
  const deviceIdRef = useRef('')
  /** doConnect 函数引用（用于打破循环依赖） */
  const doConnectRef = useRef<(() => void) | null>(null)
  /** autoPairAndReconnect 函数引用（用于打破循环依赖） */
  const autoPairAndReconnectRef = useRef<(() => Promise<void>) | null>(null)
  /** 最近浏览过的会话历史缓存，减少切换闪白 */
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map())

  const writeDebugLog = useCallback((message: string, data?: unknown): void => {
    const suffix = data === undefined ? '' : ` | ${stringifyForDebugLog(data)}`
    window.api.log
      .write({ level: 'debug', tag: 'chat-debug', message: `${message}${suffix}` })
      .catch(() => {})
  }, [])

  const loadGatewayAuthContext = useCallback(async (): Promise<void> => {
    const [token, deviceId] = await Promise.all([
      window.api.gateway.getToken(),
      window.api.gateway.getDeviceId(),
    ])
    tokenRef.current = token
    deviceIdRef.current = deviceId
  }, [])

  // sessionKey 同步到 ref，避免闭包问题
  useEffect(() => {
    sessionKeyRef.current = sessionKey
  }, [sessionKey])
  useEffect(() => {
    statusRef.current = status
  }, [status])

  // ========== 工具函数 ==========

  const send = useCallback((frame: WsFrame): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(frame))
    }
  }, [])

  const rpc = useCallback(
    (method: string, params: unknown): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const id = nextId(method.replace('.', '-'))
        pendingRef.current.set(id, { resolve, reject })
        send({ type: 'req', id, method, params })
        // 30s 超时
        setTimeout(() => {
          if (pendingRef.current.has(id)) {
            pendingRef.current.delete(id)
            reject(new Error(`RPC timeout: ${method}`))
          }
        }, 30000)
      })
    },
    [send]
  )

  const flushPending = useCallback((): void => {
    for (const [, cb] of pendingRef.current) {
      cb.reject(new Error('连接已断开'))
    }
    pendingRef.current.clear()
  }, [])

  const stopPing = useCallback((): void => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }, [])

  const startPing = useCallback((): void => {
    stopPing()
    pingTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('{"type":"ping"}')
      }
    }, PING_INTERVAL_MS)
  }, [stopPing])

  // ========== 会话列表 ==========

  const refreshSessions = useCallback((): void => {
    rpc('sessions.list', { limit: 50 })
      .then((result) => {
        const raw = result as { sessions?: unknown[] } | unknown[]
        const list: unknown[] = Array.isArray(raw)
          ? raw
          : (raw as { sessions?: unknown[] }).sessions || []
        const items: SessionItem[] = list.map((s) => {
          const session = s as {
            sessionKey?: string
            key?: string
            updatedAt?: number
            lastActivity?: number
          }
          const key = session.sessionKey || session.key || ''
          return {
            key,
            label: parseSessionLabel(key),
            updatedAt: session.updatedAt || session.lastActivity,
          }
        })
        items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        setSessions(items)
      })
      .catch(() => {})
  }, [rpc])

  const loadHistory = useCallback(
    (key: string, options?: { silent?: boolean }): void => {
      const silent = options?.silent === true
      if (!silent) setHistoryLoading(true)
      rpc('chat.history', { sessionKey: key, limit: 200 })
        .then((result) => {
          const data = result as { messages?: unknown[] } | null
          const rawMessages: unknown[] = data?.messages || []
          const loaded: ChatMessage[] = []
          const toolMap = new Map<string, { messageIndex: number; toolIndex: number }>()

          for (const entry of rawMessages) {
            const msg = entry as {
              id?: string
              role?: string
              content?: string | ContentBlock[]
              timestamp?: number
              attachments?: AttachmentPayload[]
              usage?: unknown
              durationMs?: number
              model?: string
              provider?: string
              toolCallId?: string
              toolName?: string
              isError?: boolean
            }

            if (msg.role === 'assistant') {
              const normalized = normalizeAssistantContent(msg.content)
              if (
                !normalized.text &&
                !normalized.thinking &&
                !normalized.toolCalls?.length &&
                !msg.attachments?.length
              ) {
                continue
              }

              const prev = loaded[loaded.length - 1]
              const prevIsAssistant = prev?.role === 'assistant'
              const prevHasText = Boolean(prevIsAssistant && prev.content?.trim())
              const incomingHasText = Boolean(normalized.text?.trim())
              const prevHasMeta = Boolean(
                prevIsAssistant &&
                (prev.thinking?.trim() || prev.toolCalls?.length || prev.attachments?.length)
              )
              const incomingHasMeta = Boolean(
                normalized.thinking?.trim() ||
                normalized.toolCalls?.length ||
                msg.attachments?.length
              )

              // 历史里同一轮 assistant 可能被拆成多段（工具段 + 正文段），这里合并为一个气泡
              const shouldMergeWithPrev =
                prevIsAssistant &&
                ((!prevHasText && prevHasMeta && incomingHasText) ||
                  (prevHasText && !incomingHasText && incomingHasMeta) ||
                  (!prevHasText && !incomingHasText))

              if (shouldMergeWithPrev && prevIsAssistant) {
                prev.content = incomingHasText ? normalized.text : prev.content
                if (normalized.thinking) {
                  prev.thinking = prev.thinking
                    ? prev.thinking.includes(normalized.thinking)
                      ? prev.thinking
                      : `${prev.thinking}\n\n${normalized.thinking}`
                    : normalized.thinking
                }
                prev.toolCalls = mergeToolCalls(prev.toolCalls, normalized.toolCalls)
                if (msg.attachments?.length) {
                  prev.attachments = [...(prev.attachments || []), ...msg.attachments]
                }
                prev.usage = normalizeUsage(msg.usage) ?? prev.usage
                prev.durationMs = toNumber(msg.durationMs) ?? prev.durationMs
                prev.model = pickText(msg.model, prev.model) ?? prev.model
                prev.provider = pickText(msg.provider, prev.provider) ?? prev.provider

                const messageIndex = loaded.length - 1
                prev.toolCalls?.forEach((toolCall, toolIndex) => {
                  toolMap.set(toolCall.id, { messageIndex, toolIndex })
                })
                continue
              }

              const message: ChatMessage = {
                id: msg.id || nextId('hist'),
                role: 'assistant',
                content: normalized.text,
                thinking: normalized.thinking,
                toolCalls: normalized.toolCalls,
                attachments: msg.attachments,
                usage: normalizeUsage(msg.usage),
                durationMs: toNumber(msg.durationMs),
                model: pickText(msg.model),
                provider: pickText(msg.provider),
              }
              const messageIndex = loaded.push(message) - 1
              normalized.toolCalls?.forEach((toolCall, toolIndex) => {
                toolMap.set(toolCall.id, { messageIndex, toolIndex })
              })
              continue
            }

            if (msg.role === 'toolResult') {
              const toolCallId = pickText(msg.toolCallId)
              const link = toolCallId ? toolMap.get(toolCallId) : undefined
              if (!link) continue
              const target = loaded[link.messageIndex]
              if (!target?.toolCalls?.[link.toolIndex]) continue
              const nextToolCalls = [...target.toolCalls]
              const current = nextToolCalls[link.toolIndex]
              nextToolCalls[link.toolIndex] = {
                ...current,
                name: pickText(current.name, msg.toolName) || current.name,
                resultText: extractToolResultText(msg.content),
                status: msg.isError ? 'error' : 'success',
              }
              target.toolCalls = nextToolCalls
              continue
            }

            if (msg.role === 'user') {
              const text = extractText(msg.content as string | ContentBlock[] | undefined)
              if (!text && !msg.attachments?.length) continue
              loaded.push({
                id: msg.id || nextId('hist'),
                role: 'user',
                content: text,
                attachments: msg.attachments,
                usage: normalizeUsage(msg.usage),
                durationMs: toNumber(msg.durationMs),
                model: pickText(msg.model),
                provider: pickText(msg.provider),
              })
            }
          }
          messageCacheRef.current.set(key, loaded)
          if (sessionKeyRef.current === key) {
            setMessages(loaded)
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!silent && sessionKeyRef.current === key) {
            setHistoryLoading(false)
          }
        })
    },
    [rpc]
  )

  // ========== 握手 ==========

  /**
   * 握手成功回调（从 pending resolve 提取为独立 useCallback，稳定引用）
   * 1. 从 snapshot 取会话 key / defaultAgentId
   * 2. 存储 Gateway 颁发的 deviceToken
   * 3. 重置修复计数
   */
  const handleConnectSuccess = useCallback(
    (payload: unknown): void => {
      const p = payload as {
        snapshot?: { sessionDefaults?: { mainSessionKey?: string; defaultAgentId?: string } }
        auth?: { deviceToken?: string; role?: string; scopes?: string[] }
      }
      const defaults = p?.snapshot?.sessionDefaults
      const key = defaults?.mainSessionKey || `agent:${defaults?.defaultAgentId || 'main'}:main`
      mainSessionKeyRef.current = key
      setDefaultAgentId(defaults?.defaultAgentId || 'main')
      setSessionKey(key)
      sessionKeyRef.current = key
      setStatus('ready')
      setErrorMsg(null)
      reconnectCountRef.current = 0
      startPing()

      // 握手成功：存储 Gateway 颁发的 deviceToken，下次重连可复用
      if (p?.auth?.deviceToken && deviceIdRef.current) {
        window.api.gateway.storeDeviceToken(
          deviceIdRef.current,
          p.auth.role ?? 'operator',
          p.auth.deviceToken,
          p.auth.scopes ?? []
        )
      }
      // 成功后重置修复计数，允许下次再触发
      retryMismatchRef.current = 0
      autoPairAttemptsRef.current = 0

      setTimeout(() => {
        refreshSessions()
        loadHistory(key)
      }, 100)
    },
    [startPing, refreshSessions, loadHistory]
  )

  /**
   * 握手失败回调（从 pending reject 提取为独立 useCallback）
   * - TOKEN_MISMATCH → 清除 deviceToken，用 gatewayToken 重签（最多 1 次）
   * - NOT_PAIRED / origin not allowed → 自动修复 allowedOrigins（最多 1 次）
   * - 其他 → 显示错误
   */
  const handleConnectError = useCallback((err: Error): void => {
    const msg = err.message
    if (/TOKEN_MISMATCH/i.test(msg) && retryMismatchRef.current < 1) {
      retryMismatchRef.current++
      window.api.gateway.clearDeviceToken(deviceIdRef.current, 'operator')
      doConnectRef.current?.()
      return
    }
    if (
      (/NOT_PAIRED|PAIRING_REQUIRED/i.test(msg) || /origin not allowed/i.test(msg)) &&
      autoPairAttemptsRef.current < 1
    ) {
      autoPairAttemptsRef.current++
      autoPairAndReconnectRef.current?.()
      return
    }
    setStatus('error')
    setErrorMsg(msg)
  }, []) // 稳定引用，通过 ref 访问 doConnect / autoPairAndReconnect

  /**
   * 发送 Ed25519 connect 握手帧（异步，通过 IPC 请求主进程构建帧）
   * @param nonce - 来自 connect.challenge 事件的随机数（超时后传空字符串）
   */
  const sendConnectFrame = useCallback(
    async (nonce: string): Promise<void> => {
      try {
        const frame = await window.api.gateway.buildConnectFrame(nonce)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const id = (frame as { id: string }).id
          pendingRef.current.set(id, {
            resolve: handleConnectSuccess,
            reject: handleConnectError,
          })
          wsRef.current.send(JSON.stringify(frame))
          setStatus('handshaking')
        }
      } catch (e) {
        console.error('[ws] buildConnectFrame failed:', e)
      }
    },
    [handleConnectSuccess, handleConnectError]
  )

  // ========== 事件处理 ==========

  const handleChatEvent = useCallback(
    (payload: ChatEventPayload): void => {
      const normalized = normalizeAssistantContent(payload.message?.content)
      const model = pickText(payload.model, payload.message?.model)
      const provider = pickText(payload.provider, payload.message?.provider)
      const usage = normalizeUsage(payload.usage)
      const durationMs = toNumber(payload.durationMs)
      writeDebugLog(`chat-event state=${payload.state} runId=${payload.runId}`, {
        payload,
        normalized: {
          textLength: normalized.text.length,
          thinking: Boolean(normalized.thinking),
          tools: normalized.toolCalls?.length || 0,
        },
      })

      if (payload.state === 'delta') {
        currentRunIdRef.current = payload.runId
        setIsStreaming(true)
        setMessages((prev) => {
          // 优先按 runId 命中，避免 lifecycle 抢先结束后产生重复气泡
          const idxByRunId = prev.findIndex((m) => m.role === 'assistant' && m.id === payload.runId)
          const idxStreaming =
            idxByRunId >= 0 ? -1 : prev.findIndex((m) => m.role === 'assistant' && m.streaming)
          const idx = idxByRunId >= 0 ? idxByRunId : idxStreaming
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              id: payload.runId || updated[idx].id,
              content: normalized.text,
              thinking: normalized.thinking ?? updated[idx].thinking,
              toolCalls: normalized.toolCalls ?? updated[idx].toolCalls,
              model,
              provider,
            }
            return updated
          }
          // 新建 streaming 气泡
          return [
            ...prev,
            {
              id: payload.runId,
              role: 'assistant',
              content: normalized.text,
              thinking: normalized.thinking,
              toolCalls: normalized.toolCalls,
              streaming: true,
              model,
              provider,
            },
          ]
        })
      } else if (payload.state === 'final') {
        currentRunIdRef.current = null
        setIsStreaming(false)
        const currentSessionKey = payload.sessionKey || sessionKeyRef.current || ''
        setMessages((prev) => {
          const idxByRunId = prev.findIndex((m) => m.role === 'assistant' && m.id === payload.runId)
          const idxStreaming =
            idxByRunId >= 0 ? -1 : prev.findIndex((m) => m.role === 'assistant' && m.streaming)
          const idx = idxByRunId >= 0 ? idxByRunId : idxStreaming
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              id: payload.runId || updated[idx].id,
              content: normalized.text,
              thinking: normalized.thinking ?? updated[idx].thinking,
              toolCalls: normalized.toolCalls ?? updated[idx].toolCalls,
              streaming: false,
              usage,
              durationMs,
              model,
              provider,
            }
            return updated
          }
          return prev
        })
        // 消息完成后刷新会话列表（更新时间戳排序）
        setTimeout(refreshSessions, 500)
        // realtime 帧可能不带 thinking/usage，静默回读 history 补齐元信息
        if (currentSessionKey) {
          setTimeout(() => {
            if (sessionKeyRef.current === currentSessionKey) {
              loadHistory(currentSessionKey, { silent: true })
            }
          }, 350)
        }
      } else if (payload.state === 'aborted') {
        currentRunIdRef.current = null
        setIsStreaming(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.streaming ? { ...m, content: normalized.text || m.content, streaming: false } : m
          )
        )
      } else if (payload.state === 'error') {
        currentRunIdRef.current = null
        setIsStreaming(false)
        const errText = payload.errorMessage || payload.error?.message || '未知错误'
        setMessages((prev) =>
          prev.map((m) => (m.streaming ? { ...m, content: errText, streaming: false } : m))
        )
      }
    },
    [loadHistory, refreshSessions, writeDebugLog]
  )

  const handleRealtimeMessageEvent = useCallback(
    (messagePayload: RealtimeMessagePayload, containerPayload?: Record<string, unknown>): void => {
      const targetSessionKey = pickText(messagePayload.sessionKey, containerPayload?.sessionKey)
      if (targetSessionKey && sessionKeyRef.current && targetSessionKey !== sessionKeyRef.current) {
        return
      }

      if (messagePayload.role === 'assistant') {
        const normalized = normalizeAssistantContent(messagePayload.content)
        const model = pickText(messagePayload.model, containerPayload?.model)
        const provider = pickText(messagePayload.provider, containerPayload?.provider)
        const usage = normalizeUsage(messagePayload.usage ?? containerPayload?.usage)
        const durationMs = toNumber(messagePayload.durationMs ?? containerPayload?.durationMs)
        const isToolStep = /tooluse/i.test(pickText(messagePayload.stopReason) || '')
        writeDebugLog(
          `realtime-assistant id=${messagePayload.id || '-'} stop=${messagePayload.stopReason || '-'}`,
          {
            messagePayload,
            containerPayload,
            normalized: {
              textLength: normalized.text.length,
              thinking: Boolean(normalized.thinking),
              tools: normalized.toolCalls?.length || 0,
            },
          }
        )

        setMessages((prev) => {
          const idxById = messagePayload.id
            ? prev.findIndex((m) => m.role === 'assistant' && m.id === messagePayload.id)
            : -1
          const idxStreaming =
            idxById >= 0 ? -1 : prev.findIndex((m) => m.role === 'assistant' && m.streaming)
          const idx = idxById >= 0 ? idxById : idxStreaming

          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              id: messagePayload.id || updated[idx].id,
              content: normalized.text || updated[idx].content,
              thinking: normalized.thinking ?? updated[idx].thinking,
              toolCalls: normalized.toolCalls ?? updated[idx].toolCalls,
              usage: usage ?? updated[idx].usage,
              durationMs: durationMs ?? updated[idx].durationMs,
              model: model ?? updated[idx].model,
              provider: provider ?? updated[idx].provider,
              streaming: isToolStep ? true : updated[idx].streaming,
            }
            return updated
          }

          return [
            ...prev,
            {
              id: messagePayload.id || nextId('rt-ai'),
              role: 'assistant',
              content: normalized.text,
              thinking: normalized.thinking,
              toolCalls: normalized.toolCalls,
              usage,
              durationMs,
              model,
              provider,
              streaming: isToolStep,
            },
          ]
        })
        return
      }

      if (messagePayload.role === 'toolResult') {
        const toolCallId = pickText(messagePayload.toolCallId)
        if (!toolCallId) return
        writeDebugLog(`realtime-tool-result toolCallId=${toolCallId}`, {
          messagePayload,
          containerPayload,
        })
        setMessages((prev) => {
          for (let i = prev.length - 1; i >= 0; i--) {
            const message = prev[i]
            if (message.role !== 'assistant' || !message.toolCalls?.length) continue
            const toolIdx = message.toolCalls.findIndex((t) => t.id === toolCallId)
            if (toolIdx < 0) continue

            const next = [...prev]
            const nextToolCalls = [...message.toolCalls]
            const currentTool = nextToolCalls[toolIdx]
            nextToolCalls[toolIdx] = {
              ...currentTool,
              name: pickText(currentTool.name, messagePayload.toolName) || currentTool.name,
              resultText: extractToolResultText(messagePayload.content),
              status: messagePayload.isError ? 'error' : 'success',
            }
            next[i] = { ...message, toolCalls: nextToolCalls }
            return next
          }
          return prev
        })
      }
    },
    [writeDebugLog]
  )

  const handleAgentToolEvent = useCallback(
    (payload: AgentToolEventPayload): void => {
      if (payload.stream !== 'tool') return
      const targetSessionKey = pickText(payload.sessionKey)
      if (targetSessionKey && sessionKeyRef.current && targetSessionKey !== sessionKeyRef.current)
        return

      const data = payload.data || {}
      const toolCallId = pickText(data.toolCallId)
      if (!toolCallId) return
      const phase = pickText(data.phase) || ''
      const toolName = pickText(data.name) || 'tool'
      const argsText = phase === 'start' ? toJsonText(data.args) : undefined
      const outputText =
        phase === 'update'
          ? toJsonText(data.partialResult)
          : phase === 'result'
            ? toJsonText(data.result)
            : undefined

      writeDebugLog(
        `agent-tool runId=${payload.runId || '-'} phase=${phase || '-'} id=${toolCallId}`,
        {
          payload,
          parsed: {
            toolCallId,
            toolName,
            phase,
            hasArgs: Boolean(argsText),
            hasOutput: Boolean(outputText),
          },
        }
      )

      setIsStreaming(true)
      setMessages((prev) => {
        const streamingIdx = prev.findIndex((m) => m.role === 'assistant' && m.streaming)
        const idx = streamingIdx >= 0 ? streamingIdx : prev.length
        const next = [...prev]
        if (idx === prev.length) {
          next.push({
            id: pickText(payload.runId) || nextId('tool-run'),
            role: 'assistant',
            content: '',
            streaming: true,
            toolCalls: [],
          })
        }
        const base = next[idx]
        const currentToolCalls = base.toolCalls ? [...base.toolCalls] : []
        const toolIdx = currentToolCalls.findIndex((t) => t.id === toolCallId)

        if (toolIdx < 0) {
          currentToolCalls.push({
            id: toolCallId,
            name: toolName,
            argumentsText: argsText,
            resultText: outputText,
            status: phase === 'result' ? 'success' : 'loading',
          })
        } else {
          const current = currentToolCalls[toolIdx]
          currentToolCalls[toolIdx] = {
            ...current,
            name: toolName || current.name,
            argumentsText: argsText ?? current.argumentsText,
            resultText: outputText ?? current.resultText,
            status: phase === 'result' ? 'success' : 'loading',
          }
        }

        next[idx] = {
          ...base,
          id: pickText(payload.runId) || base.id,
          toolCalls: currentToolCalls,
          streaming: true,
        }
        return next
      })
    },
    [writeDebugLog]
  )

  const handleMessage = useCallback(
    (raw: string): void => {
      let frame: WsFrame
      try {
        frame = JSON.parse(raw)
      } catch {
        return
      }

      // connect.challenge → 发握手帧，携带 nonce 进行 Ed25519 签名
      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        if (challengeTimerRef.current) {
          clearTimeout(challengeTimerRef.current)
          challengeTimerRef.current = null
        }
        const nonce = (frame.payload as { nonce?: string })?.nonce ?? ''
        sendConnectFrame(nonce)
        return
      }

      // RPC 响应
      if (frame.type === 'res' && frame.id) {
        const cb = pendingRef.current.get(frame.id)
        if (cb) {
          pendingRef.current.delete(frame.id)
          if (frame.ok) {
            cb.resolve(frame.payload)
          } else {
            cb.reject(new Error(frame.error?.message || frame.error?.code || 'RPC error'))
          }
        }
        return
      }

      // chat 事件（流式输出）
      if (frame.type === 'event' && frame.event === 'chat') {
        writeDebugLog('ws-event-full chat', frame)
        handleChatEvent(frame.payload as ChatEventPayload)
        return
      }

      // 兜底：某些 runtime 会把 assistant/toolResult 作为独立 event 推送
      if (frame.type === 'event' && frame.payload && typeof frame.payload === 'object') {
        const payload = frame.payload as Record<string, unknown>
        writeDebugLog(`ws-event-full ${frame.event || '-'}`, frame)
        writeDebugLog(
          `ws-event event=${frame.event || '-'} keys=${Object.keys(payload).join(',')}`,
          payload
        )

        const nestedData =
          payload.data && typeof payload.data === 'object'
            ? (payload.data as Record<string, unknown>)
            : undefined
        if (frame.event === 'agent' && nestedData) {
          writeDebugLog(`agent-data keys=${Object.keys(nestedData).join(',')}`, nestedData)
          const agentStream = pickText(payload.stream, nestedData.stream)
          handleAgentToolEvent({
            runId: pickText(payload.runId, nestedData.runId),
            sessionKey: pickText(payload.sessionKey, nestedData.sessionKey),
            stream: agentStream,
            // agent 事件里 data 字段本身就是工具数据（phase/name/toolCallId/...）
            data: nestedData as AgentToolEventPayload['data'],
          })

          // agent assistant 流：payload.stream=assistant，文本增量在 data.text/data.delta
          if (agentStream === 'assistant') {
            const assistantText = pickText(nestedData.text)
            const assistantDelta = pickText(nestedData.delta)
            if (assistantText || assistantDelta) {
              handleChatEvent({
                state: 'delta',
                sessionKey:
                  pickText(payload.sessionKey, nestedData.sessionKey, sessionKeyRef.current) || '',
                runId: pickText(payload.runId, nestedData.runId) || nextId('agent'),
                message: { content: assistantText ?? assistantDelta ?? '' },
                usage: nestedData.usage ?? payload.usage,
                durationMs: toNumber(nestedData.durationMs ?? payload.durationMs),
                model: pickText(nestedData.model, payload.model),
                provider: pickText(nestedData.provider, payload.provider),
                errorMessage: pickText(nestedData.errorMessage, payload.errorMessage),
              })
            }
          }

          // lifecycle end 作为流式收尾兜底，避免只剩“停止中”状态
          if (agentStream === 'lifecycle' && pickText(nestedData.phase) === 'end') {
            currentRunIdRef.current = null
            setIsStreaming(false)
          }
          const nestedDataMessage =
            nestedData.message && typeof nestedData.message === 'object'
              ? (nestedData.message as RealtimeMessagePayload)
              : undefined
          const nestedDataDirect = nestedData as unknown as RealtimeMessagePayload
          const candidateFromData = nestedDataMessage || nestedDataDirect
          if (candidateFromData?.role === 'assistant' || candidateFromData?.role === 'toolResult') {
            handleRealtimeMessageEvent(candidateFromData, payload)
            return
          }

          // 某些 agent 事件通过 stream + data 传输 chat 增量，转成统一 chat-event 处理
          const streamState = pickText(payload.stream, nestedData.stream)
          if (
            streamState === 'delta' ||
            streamState === 'final' ||
            streamState === 'aborted' ||
            streamState === 'error'
          ) {
            const content = nestedData.content ?? nestedData.message ?? payload.data
            handleChatEvent({
              state: streamState,
              sessionKey:
                pickText(payload.sessionKey, nestedData.sessionKey, sessionKeyRef.current) || '',
              runId: pickText(payload.runId, nestedData.runId) || nextId('agent'),
              message: { content: content as string | ContentBlock[] },
              usage: nestedData.usage ?? payload.usage,
              durationMs: toNumber(nestedData.durationMs ?? payload.durationMs),
              model: pickText(nestedData.model, payload.model),
              provider: pickText(nestedData.provider, payload.provider),
              errorMessage: pickText(nestedData.errorMessage, payload.errorMessage),
            })
            return
          }
        }

        const direct = payload as unknown as RealtimeMessagePayload
        const nested = payload.message as RealtimeMessagePayload | undefined
        const candidate = nested && typeof nested === 'object' ? nested : direct
        if (candidate?.role === 'assistant' || candidate?.role === 'toolResult') {
          handleRealtimeMessageEvent(candidate, payload)
        }
      }
    },
    [sendConnectFrame, handleChatEvent, handleRealtimeMessageEvent, handleAgentToolEvent]
  )

  // ========== 连接管理 ==========

  function scheduleReconnect(): void {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    const delay = RECONNECT_DELAYS[Math.min(reconnectCountRef.current, RECONNECT_DELAYS.length - 1)]
    reconnectCountRef.current++
    reconnectTimerRef.current = setTimeout(() => {
      if (!intentionalCloseRef.current) doConnect()
    }, delay)
  }

  const doConnect = useCallback((): void => {
    if (!tokenRef.current) {
      setStatus('disconnected')
      setErrorMsg('Gateway token unavailable')
      return
    }
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    stopPing()
    flushPending()
    setStatus('connecting')

    const url = `ws://127.0.0.1:${portRef.current}/ws?token=${encodeURIComponent(tokenRef.current)}`
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      // 等待 Gateway 发 connect.challenge，5s 内没收到则主动发（空 nonce）
      challengeTimerRef.current = setTimeout(() => {
        if (statusRef.current !== 'ready') {
          void sendConnectFrame('')
        }
      }, CHALLENGE_TIMEOUT_MS)
    }

    ws.onmessage = (evt) => handleMessage(evt.data as string)

    ws.onclose = (e) => {
      wsRef.current = null
      stopPing()
      flushPending()
      if (intentionalCloseRef.current) return

      // 认证失败不重连
      if (e.code === 4001 || e.code === 4003 || e.code === 4004) {
        setStatus('error')
        setErrorMsg('Token 认证失败，请检查配置')
        return
      }

      // 1008 = origin not allowed，自动写入 allowedOrigins 后重连（最多 1 次）
      if (e.code === 1008 && autoPairAttemptsRef.current < 1) {
        autoPairAttemptsRef.current++
        setErrorMsg('origin not allowed，自动修复中...')
        autoPairAndReconnectRef.current?.()
        return
      }

      setStatus('disconnected')
      scheduleReconnect()
    }

    ws.onerror = () => {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPing, flushPending, handleMessage, sendConnectFrame])

  /**
   * 自动配对重连：写入 allowedOrigins → 重启 Gateway → 2s 后重连
   */
  const autoPairAndReconnect = useCallback(async (): Promise<void> => {
    try {
      await window.api.gateway.autoPairDevice()
      await window.api.gateway.restart()
      setTimeout(() => {
        if (!intentionalCloseRef.current) {
          reconnectCountRef.current = 0
          doConnectRef.current?.()
        }
      }, 2000)
    } catch (e) {
      setStatus('error')
      setErrorMsg(`自动配对失败: ${String(e)}`)
    }
  }, []) // 通过 doConnectRef 访问 doConnect，无需直接依赖

  // 保持 ref 与最新函数同步（打破循环依赖）
  useEffect(() => {
    doConnectRef.current = doConnect
  }, [doConnect])
  useEffect(() => {
    autoPairAndReconnectRef.current = autoPairAndReconnect
  }, [autoPairAndReconnect])

  // ========== 初始化连接 ==========

  useEffect(() => {
    let cancelled = false

    const init = async (): Promise<(() => void) | void> => {
      try {
        const port = await window.api.gateway.getPort()
        if (cancelled) return
        portRef.current = port
      } catch {
        if (!cancelled) setStatus('error')
        return
      }

      // 监听 Gateway 状态变化，Gateway 启动后自动连接
      const offStateChange = window.api.gateway.onStateChange((gwState) => {
        if (cancelled) return
        if (gwState === 'running') {
          setGatewayRunning(true)
          Promise.all([window.api.gateway.getPort(), loadGatewayAuthContext()])
            .then(([port]) => {
              if (!cancelled) {
                portRef.current = port
                intentionalCloseRef.current = false
                reconnectCountRef.current = 0
                doConnect()
              }
            })
            .catch(() => {
              if (!cancelled) {
                setStatus('error')
                setErrorMsg('Failed to initialize gateway connection context')
              }
            })
        } else if (gwState === 'stopped' || gwState === 'stopping') {
          setGatewayRunning(false)
          intentionalCloseRef.current = true
          wsRef.current?.close()
          setStatus('disconnected')
          setErrorMsg(null)
          setSessionKey(null)
          setMessages([])
          setHistoryLoading(false)
          setSessions([])
          messageCacheRef.current.clear()
          tokenRef.current = ''
          deviceIdRef.current = ''
        }
      })

      // 如果 Gateway 已经在运行，直接连接
      const gwState = await window.api.gateway.getState()
      if (cancelled) return
      if (gwState === 'running') {
        setGatewayRunning(true)
        try {
          await loadGatewayAuthContext()
          if (cancelled) return
          if (portRef.current > 0) {
            intentionalCloseRef.current = false
            doConnect()
          }
        } catch {
          if (!cancelled) {
            setStatus('error')
            setErrorMsg('Failed to initialize gateway connection context')
          }
        }
      }

      return offStateChange
    }

    let cleanupStateListener: (() => void) | null = null
    init().then((off) => {
      cleanupStateListener = off || null
    })

    return () => {
      cancelled = true
      cleanupStateListener?.()
      intentionalCloseRef.current = true
      wsRef.current?.close()
      stopPing()
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (challengeTimerRef.current) clearTimeout(challengeTimerRef.current)
    }
  }, [doConnect, loadGatewayAuthContext, stopPing])

  // ========== 公开 API ==========

  const sendMessage = useCallback(
    (text: string, attachments?: AttachmentPayload[]): void => {
      const key = sessionKeyRef.current
      if (!key || status !== 'ready') return

      // 追加用户消息
      const userMsg: ChatMessage = {
        id: nextId('user'),
        role: 'user',
        content: text,
        attachments: attachments?.length ? attachments : undefined,
      }
      setMessages((prev) => {
        const next = [...prev, userMsg]
        messageCacheRef.current.set(key, next)
        return next
      })

      const params: Record<string, unknown> = {
        sessionKey: key,
        message: text,
        deliver: false,
        idempotencyKey: nextId('idem'),
      }
      if (attachments && attachments.length > 0) {
        params.attachments = attachments
      }

      // 立即设置 streaming 状态 + 追加 loading 占位气泡，消除网络延迟空窗期
      setIsStreaming(true)
      setMessages((prev) => {
        const next: ChatMessage[] = [
          ...prev,
          { id: nextId('pending-ai'), role: 'assistant', content: '', streaming: true },
        ]
        messageCacheRef.current.set(key, next)
        return next
      })

      rpc('chat.send', params).catch((err) => {
        // RPC 失败时回滚 loading 气泡并重置 isStreaming
        setIsStreaming(false)
        setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.streaming)))
        console.error('[chat] send failed:', err)
      })
    },
    [status, rpc]
  )

  const abortMessage = useCallback((): void => {
    const key = sessionKeyRef.current
    if (!key || !currentRunIdRef.current) return
    rpc('chat.abort', { sessionKey: key, runId: currentRunIdRef.current }).catch(() => {})
  }, [rpc])

  const reconnect = useCallback((): void => {
    intentionalCloseRef.current = false
    reconnectCountRef.current = 0
    // 用户主动重连时重置修复计数，允许再次自动修复
    autoPairAttemptsRef.current = 0
    retryMismatchRef.current = 0
    doConnect()
  }, [doConnect])

  const switchSession = useCallback(
    (key: string): void => {
      if (key === sessionKeyRef.current) return
      setSessionKey(key)
      sessionKeyRef.current = key
      const cached = messageCacheRef.current.get(key)
      if (cached) {
        setMessages(cached)
      }
      loadHistory(key)
    },
    [loadHistory]
  )

  const newSession = useCallback(
    (name: string, agentId?: string): void => {
      const key = sessionKeyRef.current
      // 用传入的 agentId，或从当前 sessionKey 解析（格式：agent:<agentId>:<channelName>）
      const resolvedAgentId = agentId || (key ? key.split(':')[1] : undefined) || 'main'
      const newKey = `agent:${resolvedAgentId}:${name}`
      // 立即在会话列表插入虚拟条目，无需等待发送消息后 Gateway 才更新列表
      setSessions((prev) => {
        if (prev.find((s) => s.key === newKey)) return prev
        return [{ key: newKey, label: parseSessionLabel(newKey), updatedAt: Date.now() }, ...prev]
      })
      switchSession(newKey)
    },
    [switchSession]
  )

  const deleteSession = useCallback(
    (key: string): Promise<void> => {
      const mainKey = mainSessionKeyRef.current
      // 主会话不允许删除
      if (key === mainKey) return Promise.reject(new Error('main'))

      // 乐观更新：立即从列表移除，立即切换到主会话
      setSessions((prev) => prev.filter((s) => s.key !== key))
      if (key === sessionKeyRef.current) {
        switchSession(mainKey || key)
      }

      // 后台发送 RPC，失败时刷新列表回滚
      return (rpc('sessions.delete', { key }) as Promise<void>).catch((err) => {
        refreshSessions()
        throw err
      })
    },
    [rpc, switchSession, refreshSessions]
  )

  const resetSession = useCallback(
    (targetKey?: string): Promise<void> => {
      const key = targetKey || sessionKeyRef.current
      if (!key) return Promise.resolve()

      // 乐观更新：重置当前会话时立即清空消息
      if (key === sessionKeyRef.current) {
        setMessages([])
        messageCacheRef.current.set(key, [])
      }

      return rpc('sessions.reset', { key }) as Promise<void>
    },
    [rpc]
  )

  /** 通过 WS RPC 获取运行时 Agent 列表（含隐式 main），WS 未就绪时返回 null */
  const listAgents = useCallback((): Promise<AgentsListResult | null> => {
    if (status !== 'ready') return Promise.resolve(null)
    return rpc('agents.list', {}) as Promise<AgentsListResult>
  }, [status, rpc])

  return {
    status,
    sessionKey,
    errorMsg,
    messages,
    historyLoading,
    gatewayRunning,
    isStreaming,
    sessions,
    defaultAgentId,
    sendMessage,
    abortMessage,
    newSession,
    reconnect,
    switchSession,
    deleteSession,
    resetSession,
    refreshSessions,
    listAgents,
    callRpc: (method: string, params: unknown): Promise<unknown> => {
      if (status !== 'ready') return Promise.reject(new Error('WebSocket not ready'))
      return rpc(method, params)
    },
  }
}
