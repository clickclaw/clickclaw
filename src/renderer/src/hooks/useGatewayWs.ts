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

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 流式状态（仅 assistant 消息有效） */
  streaming?: boolean
  /** token 消耗 */
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number }
  /** 耗时 ms */
  durationMs?: number
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
  message?: { content: string | ContentBlock[] }
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number }
  durationMs?: number
  errorMessage?: string
  error?: { message: string; code?: string }
}

interface ContentBlock {
  type: string
  text?: string
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

// ========== 常量 ==========

const CHALLENGE_TIMEOUT_MS = 5000
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]
const PING_INTERVAL_MS = 25000

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
    (key: string): void => {
      rpc('chat.history', { sessionKey: key, limit: 200 })
        .then((result) => {
          const data = result as { messages?: unknown[] } | null
          const rawMessages: unknown[] = data?.messages || []
          const loaded: ChatMessage[] = rawMessages
            .map((m) => {
              const msg = m as {
                id?: string
                role?: string
                content?: string | ContentBlock[]
                timestamp?: number
                attachments?: AttachmentPayload[]
              }
              if (msg.role !== 'user' && msg.role !== 'assistant') return null
              const text = extractText(msg.content as string | ContentBlock[] | undefined)
              if (!text && !msg.attachments?.length) return null
              return {
                id: msg.id || nextId('hist'),
                role: msg.role as 'user' | 'assistant',
                content: text,
                attachments: msg.attachments,
              } as ChatMessage
            })
            .filter((m): m is ChatMessage => m !== null)
          setMessages(loaded)
        })
        .catch(() => {})
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
      const text = extractText(payload.message?.content)

      if (payload.state === 'delta') {
        currentRunIdRef.current = payload.runId
        setIsStreaming(true)
        setMessages((prev) => {
          // 找到当前 streaming 的 assistant 消息并更新
          const idx = prev.findIndex((m) => m.role === 'assistant' && m.streaming)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], content: text }
            return updated
          }
          // 新建 streaming 气泡
          return [
            ...prev,
            {
              id: payload.runId,
              role: 'assistant',
              content: text,
              streaming: true,
            },
          ]
        })
      } else if (payload.state === 'final') {
        currentRunIdRef.current = null
        setIsStreaming(false)
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.role === 'assistant' && m.streaming)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              content: text,
              streaming: false,
              usage: payload.usage,
              durationMs: payload.durationMs,
            }
            return updated
          }
          return prev
        })
        // 消息完成后刷新会话列表（更新时间戳排序）
        setTimeout(refreshSessions, 500)
      } else if (payload.state === 'aborted') {
        currentRunIdRef.current = null
        setIsStreaming(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.streaming ? { ...m, content: text || m.content, streaming: false } : m
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
    [refreshSessions]
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
        handleChatEvent(frame.payload as ChatEventPayload)
      }
    },
    [sendConnectFrame, handleChatEvent]
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
          setSessions([])
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
      setMessages((prev) => [...prev, userMsg])

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
      setMessages((prev) => [
        ...prev,
        { id: nextId('pending-ai'), role: 'assistant', content: '', streaming: true },
      ])

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
      setMessages([])
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
