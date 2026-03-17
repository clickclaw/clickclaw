/**
 * 配对请求监控服务
 *
 * 通过 fs.watch 监听 ~/.openclaw/credentials/ 目录下的 *-pairing.json 文件变化，
 * 实现近实时的配对请求检测（openclaw 使用原子写入，rename 事件可稳定捕获）。
 *
 * 同时保留 60s 兜底轮询，防止极少数情况下 watch 事件丢失。
 *
 * 读取：直接解析 JSON 文件（无需启动子进程）
 * 审批：调用 openclaw pairing approve <channel> <code> --notify（更新 allowFrom + 发通知）
 * 拒绝：本地 sidecar 忽略（openclaw 暂无 reject 命令）
 */

import { spawn } from 'child_process'
import { watch as fsWatch } from 'fs'
import type { FSWatcher } from 'fs'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { createLogger } from '../logger'
import { getRuntime } from '../runtime'
import { readConfig } from '../config'
import { OPENCLAW_HOME, CLICKCLAW_HOME } from '../constants'
import type { GatewayProcess } from '../gateway/process'

const log = createLogger('pairing')

// ========== 常量 ==========

/** ~/.openclaw/credentials/ — pairing.json 所在目录 */
const CREDENTIALS_DIR = join(OPENCLAW_HOME, 'credentials')

/** 兜底轮询间隔（ms），防止 watch 事件极少数情况下丢失 */
const FALLBACK_POLL_MS = 60_000

/** 文件变化后的防抖延迟（ms），避免原子写入产生的多次事件 */
const DEBOUNCE_MS = 150

/** 拒绝码 sidecar 文件路径 */
const REJECTED_CODES_PATH = join(CLICKCLAW_HOME, 'rejected-pairing.json')

// ========== 类型定义 ==========

export interface PairingRequest {
  code: string
  id: string
  /** 显示名称：来自 meta.firstName / meta.username / id */
  name: string
  createdAt: string
  lastSeenAt: string
}

export interface PairingRequestWithChannel extends PairingRequest {
  channel: string
}

export interface PairingChannelState {
  channel: string
  pendingCount: number
  requests: PairingRequest[]
}

export interface PairingState {
  pendingCount: number
  requests: PairingRequestWithChannel[]
  channels: Record<string, PairingChannelState>
  updatedAt: number
}

export interface PairingApproveResult {
  success: boolean
  message?: string
}

// ========== pairing.json 原始格式（与 openclaw pairing-store.ts 对齐）==========

interface RawPairingRequest {
  id: string
  code: string
  createdAt: string
  lastSeenAt: string
  meta?: Record<string, string>
}

interface RawPairingStore {
  version: 1
  requests: RawPairingRequest[]
}

// ========== sidecar：本地拒绝码 ==========

function readRejectedCodes(): Record<string, string[]> {
  try {
    if (!existsSync(REJECTED_CODES_PATH)) return {}
    const raw = readFileSync(REJECTED_CODES_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, string[]>
  } catch {
    /* ignore */
  }
  return {}
}

function writeRejectedCodes(data: Record<string, string[]>): void {
  try {
    if (!existsSync(CLICKCLAW_HOME)) mkdirSync(CLICKCLAW_HOME, { recursive: true })
    writeFileSync(REJECTED_CODES_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    log.warn('写入拒绝码 sidecar 失败:', err)
  }
}

export function getRejectedCodes(channel: string): Set<string> {
  const all = readRejectedCodes()
  return new Set(Array.isArray(all[channel]) ? all[channel] : [])
}

export function addRejectedCode(channel: string, code: string): void {
  const all = readRejectedCodes()
  if (!Array.isArray(all[channel])) all[channel] = []
  if (!all[channel].includes(code)) {
    all[channel].push(code)
    writeRejectedCodes(all)
  }
}

function pruneRejectedCodes(channel: string, activeCodes: Set<string>): void {
  const all = readRejectedCodes()
  if (!Array.isArray(all[channel])) return
  const before = all[channel].length
  all[channel] = all[channel].filter((c) => activeCodes.has(c))
  if (all[channel].length !== before) writeRejectedCodes(all)
}

// ========== 直接读取 pairing.json（无需子进程）==========

const PAIRING_CODE_EXPIRE_MS = 60 * 60 * 1000 // 1 小时

function isExpired(req: RawPairingRequest): boolean {
  const ts = Date.parse(req.createdAt)
  if (!Number.isFinite(ts)) return true
  return Date.now() - ts > PAIRING_CODE_EXPIRE_MS
}

/** 从 meta 提取显示名称：firstName > username > id */
function resolveDisplayName(req: RawPairingRequest): string {
  const firstName = req.meta?.firstName?.trim()
  const username = req.meta?.username?.trim()
  return firstName || username || req.id || ''
}

export function readPairingFile(channel: string): PairingRequest[] {
  const filePath = join(CREDENTIALS_DIR, `${channel}-pairing.json`)
  try {
    if (!existsSync(filePath)) return []
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as RawPairingStore
    if (!Array.isArray(parsed?.requests)) return []

    const rejectedCodes = getRejectedCodes(channel)
    const activeCodes = new Set(parsed.requests.map((r) => r.code))
    if (rejectedCodes.size > 0) pruneRejectedCodes(channel, activeCodes)

    return parsed.requests
      .filter((r) => r && typeof r.id === 'string' && typeof r.code === 'string')
      .filter((r) => !isExpired(r))
      .filter((r) => !rejectedCodes.has(r.code))
      .map((r) => ({
        code: r.code,
        id: r.id,
        name: resolveDisplayName(r),
        createdAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
      }))
  } catch {
    return []
  }
}

// ========== 渠道配置读取 ==========

/** 获取所有已启用且 dmPolicy=pairing 的渠道 key 列表 */
function getPairingChannels(): string[] {
  try {
    const config = readConfig()
    const channels = (config as Record<string, unknown>).channels
    if (!channels || typeof channels !== 'object') return []
    const result: string[] = []
    for (const [key, val] of Object.entries(channels as Record<string, unknown>)) {
      if (!val || typeof val !== 'object') continue
      const ch = val as Record<string, unknown>
      if (ch.enabled === true && ch.dmPolicy === 'pairing') {
        result.push(key)
      }
    }
    return result
  } catch {
    return []
  }
}

// ========== CLI 执行（仅用于 approve）==========

interface CliResult {
  code: number
  stdout: string
  stderr: string
}

async function runOpenclawCli(args: string[]): Promise<CliResult> {
  const runtime = getRuntime()
  if (!runtime) throw new Error('Runtime not initialized')

  const cwd = runtime.getGatewayCwd()
  const cmd = runtime.getNodePath()
  const cmdArgs = [runtime.getGatewayEntry(), ...args]

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      cwd,
      env: {
        ...process.env,
        ...runtime.getEnv(),
        OPENCLAW_NO_RESPAWN: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (exitCode) => {
      resolve({ code: typeof exitCode === 'number' ? exitCode : -1, stdout, stderr })
    })
  })
}

export async function approvePairingRequest(
  channel: string,
  code: string
): Promise<PairingApproveResult> {
  try {
    const result = await runOpenclawCli(['pairing', 'approve', channel, code, '--notify'])
    if (result.code === 0) return { success: true }
    return {
      success: false,
      message: `exit ${result.code}: ${(result.stderr || result.stdout).trim().slice(0, 200)}`,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, message: msg }
  }
}

// ========== PairingMonitor 类 ==========

interface PairingMonitorOptions {
  gateway: Pick<GatewayProcess, 'getState'>
  onStateChange?: (state: PairingState) => void
  isAppInForeground?: () => boolean
}

function buildInitialState(): PairingState {
  return { pendingCount: 0, requests: [], channels: {}, updatedAt: Date.now() }
}

function buildAggregateState(channels: Record<string, PairingChannelState>): PairingState {
  let pendingCount = 0
  const requests: PairingRequestWithChannel[] = []

  for (const ch of Object.values(channels)) {
    pendingCount += ch.pendingCount
    for (const req of ch.requests) {
      requests.push({ ...req, channel: ch.channel })
    }
  }

  return { pendingCount, requests, channels, updatedAt: Date.now() }
}

export class PairingMonitor {
  private readonly gateway: Pick<GatewayProcess, 'getState'>
  private readonly onStateChange?: (state: PairingState) => void

  private running = false
  private state: PairingState = buildInitialState()
  private lastFingerprint = ''

  /** fs.watch 实例（监听 credentials 目录）*/
  private watcher: FSWatcher | null = null
  /** 防抖 timer */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  /** 兜底轮询 timer */
  private fallbackTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts: PairingMonitorOptions) {
    this.gateway = opts.gateway
    this.onStateChange = opts.onStateChange
  }

  getState(): PairingState {
    return {
      ...this.state,
      requests: this.state.requests.map((r) => ({ ...r })),
      channels: Object.fromEntries(
        Object.entries(this.state.channels).map(([k, v]) => [
          k,
          { ...v, requests: v.requests.map((r) => ({ ...r })) },
        ])
      ),
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    log.info('[pairing] monitor started')
    this.setupWatcher()
    this.startFallbackPoll()
    // 立即读取一次当前状态
    this.refresh()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    log.info('[pairing] monitor stopped')
    this.teardownWatcher()
    this.stopFallbackPoll()
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.publish(buildInitialState())
  }

  /** 立即刷新（如审批后触发） */
  triggerNow(): void {
    if (!this.running) return
    this.refresh()
  }

  // ─── 文件监听 ──────────────────────────────────────────────────────────

  private setupWatcher(): void {
    this.teardownWatcher()

    // credentials 目录可能还不存在（用户尚未配置任何渠道）
    if (!existsSync(CREDENTIALS_DIR)) {
      log.debug('[pairing] credentials dir not found, will retry on fallback poll')
      return
    }

    try {
      this.watcher = fsWatch(CREDENTIALS_DIR, { persistent: false }, (_event, filename) => {
        if (!filename || !filename.endsWith('-pairing.json')) return
        // 防抖：原子写入会产生连续 rename 事件，合并处理
        this.scheduleDebounce()
      })

      this.watcher.on('error', (err) => {
        log.warn('[pairing] watcher error:', err)
        // 重建 watcher
        this.teardownWatcher()
        setTimeout(() => {
          if (this.running) this.setupWatcher()
        }, 2000)
      })

      log.info('[pairing] watching', CREDENTIALS_DIR)
    } catch (err) {
      log.warn('[pairing] failed to setup watcher:', err)
    }
  }

  private teardownWatcher(): void {
    if (this.watcher) {
      try {
        this.watcher.close()
      } catch {
        /* ignore */
      }
      this.watcher = null
    }
  }

  private scheduleDebounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.refresh()
    }, DEBOUNCE_MS)
  }

  // ─── 兜底轮询 ──────────────────────────────────────────────────────────

  private startFallbackPoll(): void {
    this.stopFallbackPoll()
    this.fallbackTimer = setInterval(() => {
      // 若 credentials 目录刚被创建，顺便重建 watcher
      if (!this.watcher && existsSync(CREDENTIALS_DIR)) {
        this.setupWatcher()
      }
      this.refresh()
    }, FALLBACK_POLL_MS)
  }

  private stopFallbackPoll(): void {
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer)
      this.fallbackTimer = null
    }
  }

  // ─── 核心刷新 ──────────────────────────────────────────────────────────

  private refresh(): void {
    if (!this.running) return
    if (this.gateway.getState() !== 'running') {
      this.publish(buildInitialState())
      return
    }

    const channels = getPairingChannels()
    if (channels.length === 0) {
      this.publish(buildInitialState())
      return
    }

    const nextChannels: Record<string, PairingChannelState> = {}
    for (const channel of channels) {
      const requests = readPairingFile(channel)
      nextChannels[channel] = { channel, pendingCount: requests.length, requests }
    }

    this.publish(buildAggregateState(nextChannels))
  }

  // ─── 状态发布 ──────────────────────────────────────────────────────────

  private publish(next: PairingState): void {
    const fingerprint = JSON.stringify({
      pendingCount: next.pendingCount,
      requests: next.requests.map((r) => [r.channel, r.code]),
    })
    if (fingerprint === this.lastFingerprint) return
    this.lastFingerprint = fingerprint
    this.state = next
    this.onStateChange?.(this.getState())
  }
}

// ========== 已废弃（保留给 ipc-handlers 的 pairing:refresh 单渠道刷新）==========

export function listPairingRequests(channel: string): {
  success: boolean
  requests: PairingRequest[]
  message?: string
} {
  try {
    const requests = readPairingFile(channel)
    return { success: true, requests }
  } catch (err) {
    return {
      success: false,
      requests: [],
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
