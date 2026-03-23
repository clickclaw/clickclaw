/**
 * Gateway 子进程管理 — 状态机 + 世代计数器
 *
 * 状态机：stopped → starting → running → stopping → stopped
 * 世代计数器：每次 spawn 递增 generation，exit handler 只处理同代进程
 * 健康检查：轮询 HTTP GET /ready，500ms 间隔，90s 超时
 * 崩溃恢复：5s 冷却期，最多重试 3 次
 */

import { spawn, exec } from 'child_process'
import type { ChildProcess } from 'child_process'
import * as http from 'http'
import { existsSync } from 'fs'
import { createLogger } from '../logger'
import { getRuntime } from '../runtime'
import { resolveGatewayToken, maskToken } from './auth'
import { markCurrentConfigHealthy } from '../config/backup'
import { readConfig } from '../config'
import {
  DEFAULT_PORT,
  DEFAULT_BIND,
  HEALTH_CHECK_TIMEOUT_MS,
  HEALTH_POLL_INTERVAL_MS,
  CRASH_COOLDOWN_MS,
  MAX_RESTART_ATTEMPTS,
  IS_WIN,
} from '../constants'
import { getSettings } from '../settings'
import { buildProxyEnv } from '../utils/proxy'

const log = createLogger('gateway')

// ========== 类型定义 ==========

export type GatewayState = 'stopped' | 'starting' | 'running' | 'stopping'

export interface GatewayStateChange {
  from: GatewayState
  to: GatewayState
  generation: number
  error?: string
}

export interface GatewayStartResult {
  success: boolean
  port: number
  error?: string
}

export type StateChangeCallback = (change: GatewayStateChange) => void
export type LogCallback = (line: string) => void

// ========== GatewayProcess ==========

export class GatewayProcess {
  private state: GatewayState = 'stopped'
  private generation = 0
  private proc: ChildProcess | null = null
  private startPromise: Promise<GatewayStartResult> | null = null
  private port: number
  private token: string = ''
  private lastCrashTime = 0
  private restartCount = 0
  private userStopped = false

  private stateChangeListeners: StateChangeCallback[] = []
  private onLog: LogCallback | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(port?: number) {
    this.port = port || DEFAULT_PORT
  }

  // ========== 公共 API ==========

  getState(): GatewayState {
    return this.state
  }

  getPort(): number {
    return this.port
  }

  getGeneration(): number {
    return this.generation
  }

  /** 兼容旧用法：替换第一个监听器 */
  setOnStateChange(cb: StateChangeCallback | null): void {
    this.stateChangeListeners = cb ? [cb] : []
  }

  /** 追加监听器（不覆盖已有） */
  addStateChangeListener(cb: StateChangeCallback): void {
    this.stateChangeListeners.push(cb)
  }

  removeStateChangeListener(cb: StateChangeCallback): void {
    this.stateChangeListeners = this.stateChangeListeners.filter((fn) => fn !== cb)
  }

  setOnLog(cb: LogCallback | null): void {
    this.onLog = cb
  }

  getUserStopped(): boolean {
    return this.userStopped
  }

  setUserStopped(value: boolean): void {
    this.userStopped = value
  }

  /**
   * 启动 Gateway
   */
  async start(): Promise<GatewayStartResult> {
    if (this.startPromise) {
      log.debug('start request joined existing in-flight startup')
      return this.startPromise
    }
    return this.runExclusiveStart(() => this.startInternal(false))
  }

  private async startInternal(recoveredFromLockConflict: boolean): Promise<GatewayStartResult> {
    // 启动前从 openclaw.json 同步最新端口
    this.syncPortFromConfig()

    // 防止重复启动
    if (this.state === 'starting' || this.state === 'running') {
      log.debug(`already ${this.state}, skip start`)
      return { success: this.state === 'running', port: this.port }
    }

    // 等待停止完成
    if (this.state === 'stopping') {
      log.debug('waiting for stop to complete...')
      await this.waitForState('stopped', 6000)
    }

    // 崩溃冷却
    const elapsed = Date.now() - this.lastCrashTime
    if (this.lastCrashTime > 0 && elapsed < CRASH_COOLDOWN_MS) {
      const waitMs = CRASH_COOLDOWN_MS - elapsed
      log.debug(`crash cooldown: waiting ${waitMs}ms`)
      await sleep(waitMs)
    }

    this.setState('starting')
    const startupStderrLines: string[] = []

    try {
      // 清理可能残留的旧 Gateway
      log.info('[startup] phase=cleanup begin')
      await this.cleanupStaleGateway()
      log.info('[startup] phase=cleanup done')

      // 解析 Token
      log.info('[startup] phase=auth begin')
      this.token = resolveGatewayToken()
      log.info('[startup] phase=auth done')

      // 获取 Runtime
      log.info('[startup] phase=runtime begin')
      const runtime = getRuntime()
      const gatewayCwd = runtime.getGatewayCwd()
      const runtimeEnv = runtime.getEnv()
      log.info('[startup] phase=runtime done')

      // 世代递增
      const gen = ++this.generation

      const nodeBin = runtime.getNodePath()
      const gatewayEntry = runtime.getGatewayEntry()

      if (!existsSync(nodeBin)) {
        throw new Error(`node binary not found: ${nodeBin}`)
      }
      if (!existsSync(gatewayEntry)) {
        throw new Error(`gateway entry not found: ${gatewayEntry}`)
      }

      const args = [
        gatewayEntry,
        'gateway',
        'run',
        '--port',
        String(this.port),
        '--bind',
        DEFAULT_BIND,
        '--force',
      ]

      const env: Record<string, string | undefined> = {
        ...process.env,
        ...runtimeEnv,
        ...buildProxyEnv(getSettings()),
        NODE_ENV: 'production',
        OPENCLAW_NO_RESPAWN: '1',
        OPENCLAW_LENIENT_CONFIG: '1',
        OPENCLAW_GATEWAY_TOKEN: this.token,
        ELECTRON_RUN_AS_NODE: '1',
      }

      log.info('--- gateway start (bundled mode) ---')
      log.info(`platform=${process.platform} arch=${process.arch}`)
      log.info(`nodeBin=${nodeBin}`)
      log.info(`entry=${gatewayEntry}`)
      log.info(`token=${maskToken(this.token)} port=${this.port}`)

      this.proc = spawn(nodeBin, args, {
        cwd: gatewayCwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      const childPid = this.proc.pid
      log.info(`spawned: pid=${childPid} gen=${gen}`)

      // stdout/stderr 采集
      this.proc.stdout?.on('data', (data: Buffer) => {
        const line = data.toString().trimEnd()
        log.debug(`[stdout] ${line}`)
        this.onLog?.(`[gateway] ${line}`)
      })

      this.proc.stderr?.on('data', (data: Buffer) => {
        const line = data.toString().trimEnd()
        if (line) {
          startupStderrLines.push(line)
          if (startupStderrLines.length > 20) startupStderrLines.shift()
        }
        log.warn(`[stderr] ${line}`)
        this.onLog?.(`[gateway:err] ${line}`)
      })

      // exit 处理器（世代隔离）
      this.proc.on('exit', (code, signal) => {
        log.info(
          `child exit: code=${code} signal=${signal} gen=${gen} currentGen=${this.generation}`
        )

        // 世代不匹配 → 旧进程退出，忽略
        if (gen !== this.generation) {
          log.debug(`SKIP: stale generation exit (gen=${gen}, current=${this.generation})`)
          return
        }

        if (this.state === 'stopping') {
          // 正常停止
          this.setState('stopped')
        } else if (this.state === 'starting') {
          // 启动期间崩溃
          this.lastCrashTime = Date.now()
          this.setState('stopped', 'gateway crashed during startup')
        } else if (this.state === 'running') {
          // 运行中意外退出
          log.warn('gateway crashed while running')
          this.lastCrashTime = Date.now()
          this.setState('stopped', `unexpected exit: code=${code}`)
        }

        this.proc = null
      })

      // error 事件处理（spawn 失败：ENOENT / EACCES / Windows Defender 拦截等）
      // 不加此处理器会导致 Node.js 抛出未捕获异常，或错误被静默丢弃
      this.proc.on('error', (err) => {
        log.error(`spawn error (gen=${gen}): ${err.message}`)
        if (gen !== this.generation) return
        this.lastCrashTime = Date.now()
        this.setState('stopped', `spawn error: ${err.message}`)
        this.proc = null
      })

      // 健康检查
      log.info('[startup] phase=health begin')
      const healthy = await this.waitForHealth(HEALTH_CHECK_TIMEOUT_MS, childPid!, gen)

      if (!healthy) {
        // 健康检查超时或子进程已退出
        if (this.isChildAlive(childPid!)) {
          this.killChild()
          await this.waitForExit(2500)
        }
        if (!recoveredFromLockConflict && this.hasGatewayLockConflict(startupStderrLines)) {
          log.warn('gateway lock conflict detected during startup, attempting one recovery retry')
          this.setState('stopped', 'gateway lock conflict, retrying')
          await this.cleanupStaleGateway(true)
          await sleep(1500)
          return this.startInternal(true)
        }
        this.setState('stopped', 'health check timeout')
        return { success: false, port: this.port, error: 'health check timeout' }
      }

      log.info('[startup] phase=health done')

      // 额外等待 300ms 确认进程稳定
      await sleep(300)
      if (!this.isChildAlive(childPid!)) {
        if (!recoveredFromLockConflict && this.hasGatewayLockConflict(startupStderrLines)) {
          log.warn(
            'gateway exited after startup with lock conflict signal, attempting one recovery retry'
          )
          this.setState('stopped', 'gateway lock conflict, retrying')
          await this.cleanupStaleGateway(true)
          await sleep(1500)
          return this.startInternal(true)
        }
        this.setState('stopped', 'gateway exited immediately after health check')
        return { success: false, port: this.port, error: 'process exited after health check' }
      }

      this.setState('running')
      this.restartCount = 0

      // 标记当前配置为健康
      try {
        markCurrentConfigHealthy()
      } catch {
        // 不影响主流程
      }

      return { success: true, port: this.port }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!recoveredFromLockConflict && this.hasGatewayLockConflict(startupStderrLines, message)) {
        log.warn('gateway start failed with lock conflict signal, attempting one recovery retry')
        this.setState('stopped', 'gateway lock conflict, retrying')
        await this.cleanupStaleGateway(true)
        await sleep(1500)
        return this.startInternal(true)
      }
      log.error('gateway start failed:', message)
      this.setState('stopped', message)
      return { success: false, port: this.port, error: message }
    }
  }

  /**
   * 停止 Gateway
   */
  async stop(): Promise<void> {
    if (this.state === 'stopped') return
    if (this.state === 'stopping') {
      await this.waitForState('stopped', 6000)
      return
    }

    this.setState('stopping')

    if (this.proc && this.proc.exitCode === null) {
      const childPid = this.proc.pid
      // 先发 SIGTERM，给进程清理时间
      this.proc.kill('SIGTERM')

      // 等待 5 秒，超时则 SIGKILL
      const exited = await this.waitForExit(5000)
      if (!exited && this.proc && this.proc.exitCode === null) {
        log.warn('SIGTERM timeout, sending SIGKILL')
        this.proc.kill('SIGKILL')
        await this.waitForExit(2000)
      }

      // 兜底：Windows 上信号终止不一定覆盖子进程树，最终强杀整棵树
      if (this.proc && this.proc.exitCode === null && childPid && childPid > 0) {
        try {
          log.warn(`stop fallback: force terminate process tree pid=${childPid}`)
          await terminateProcessTree(childPid)
          await this.waitForExit(2000)
        } catch (err) {
          log.warn(`stop fallback failed pid=${childPid}:`, err)
        }
      }
    }

    this.proc = null
    this.setState('stopped')
  }

  /**
   * 重启 Gateway
   */
  async restart(): Promise<GatewayStartResult> {
    await this.stop()
    const stopped = await this.waitForState('stopped', 8000)
    if (!stopped) {
      log.warn('restart: stop did not fully settle within timeout, continuing with forced cleanup')
    }
    await this.cleanupStaleGateway(true)
    await sleep(1200)
    return this.start()
  }

  /**
   * 带崩溃恢复的启动
   * 失败后自动重试，最多 MAX_RESTART_ATTEMPTS 次
   */
  async startWithRecovery(): Promise<GatewayStartResult> {
    if (this.startPromise) {
      log.debug('startWithRecovery request joined existing in-flight startup')
      return this.startPromise
    }
    return this.runExclusiveStart(async () => {
      this.restartCount = 0

      while (this.restartCount <= MAX_RESTART_ATTEMPTS) {
        const result = await this.startInternal(false)
        if (result.success) return result

        this.restartCount++
        if (this.restartCount > MAX_RESTART_ATTEMPTS) {
          log.error(`max restart attempts (${MAX_RESTART_ATTEMPTS}) exceeded`)
          return {
            success: false,
            port: this.port,
            error: `failed after ${MAX_RESTART_ATTEMPTS} retries: ${result.error}`,
          }
        }

        log.warn(`restart attempt ${this.restartCount}/${MAX_RESTART_ATTEMPTS}`)
        // 冷却期由 startInternal() 内部处理
      }

      return { success: false, port: this.port, error: 'max retries exceeded' }
    })
  }

  private runExclusiveStart(
    factory: () => Promise<GatewayStartResult>
  ): Promise<GatewayStartResult> {
    const pending = factory().finally(() => {
      if (this.startPromise === pending) {
        this.startPromise = null
      }
    })
    this.startPromise = pending
    return pending
  }

  /**
   * 启动状态轮询
   * 每 5 秒探测端口，发现内部状态与实际不一致时自动同步
   * - stopped 但端口有响应 → 外部启动了 Gateway，同步为 running
   * - running 但子进程已退出且端口无响应 → 同步为 stopped
   */
  startStatusPolling(intervalMs = 5000): void {
    this.stopStatusPolling()
    log.info(`status polling started (interval=${intervalMs}ms)`)

    this.pollTimer = setInterval(async () => {
      // 跳过过渡状态，避免干扰 start/stop 流程
      if (this.state === 'starting' || this.state === 'stopping') return

      // 同步端口（检测外部在不同端口启动的 Gateway）
      this.syncPortFromConfig()

      const portAlive = await this.probeHealth()

      if (this.state === 'stopped' && portAlive) {
        // 外部启动了 Gateway（CLI 等），同步状态
        log.info('status poll: port alive but state=stopped, syncing to running (external start)')
        this.userStopped = false
        this.setState('running')
      } else if (this.state === 'running' && !portAlive && !this.proc) {
        // 子进程已退出且端口无响应，同步状态
        log.info('status poll: port dead and no child process, syncing to stopped')
        this.setState('stopped')
      }
    }, intervalMs)
  }

  /**
   * 停止状态轮询
   */
  stopStatusPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
      log.info('status polling stopped')
    }
  }

  /**
   * 从 openclaw.json 同步端口号
   * 每次启动前及轮询时调用，确保使用用户在配置文件中设置的端口
   */
  private syncPortFromConfig(): void {
    try {
      const cfg = readConfig() as { gateway?: { port?: number } }
      const configPort = cfg.gateway?.port
      if (typeof configPort === 'number' && configPort >= 1024 && configPort <= 65535) {
        if (this.port !== configPort) {
          log.info(`port synced from config: ${this.port} -> ${configPort}`)
          this.port = configPort
        }
      }
    } catch {
      // 读取失败时保持当前端口
    }
  }

  private setState(newState: GatewayState, error?: string): void {
    const from = this.state
    if (from === newState) return

    this.state = newState
    log.info(`state: ${from} -> ${newState}${error ? ` (${error})` : ''}`)
    this.stateChangeListeners.forEach((fn) =>
      fn({ from, to: newState, generation: this.generation, error })
    )
  }

  private isChildAlive(pid: number): boolean {
    return !!this.proc && this.proc.pid === pid && this.proc.exitCode === null
  }

  private killChild(): void {
    if (this.proc && this.proc.exitCode === null) {
      try {
        this.proc.kill('SIGKILL')
      } catch {
        // ignore
      }
    }
  }

  /**
   * HTTP 健康探测
   */
  private probeHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/ready`, (res) => {
        resolve(res.statusCode === 200)
        res.resume()
      })
      req.on('error', () => resolve(false))
      req.setTimeout(2000, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  /**
   * 等待健康检查通过
   */
  private async waitForHealth(timeoutMs: number, childPid: number, gen: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    let attempts = 0

    while (Date.now() < deadline) {
      // 世代检查
      if (gen !== this.generation) {
        log.debug('health check aborted: generation changed')
        return false
      }
      // 进程存活检查
      const alive = this.isChildAlive(childPid)
      if (!alive) {
        log.debug('health check aborted: child exited')
        return false
      }
      // HTTP 探测
      if (await this.probeHealth()) {
        log.info(`health check passed (attempts=${attempts})`)
        return true
      }
      attempts++
      // 每 10 次（约 5 秒）打印一次进度，帮助诊断卡住问题
      if (attempts % 10 === 0) {
        const elapsed = Date.now() - (deadline - timeoutMs)
        log.info(
          `[health] waiting... elapsed=${elapsed}ms / ${timeoutMs}ms, pid=${childPid} alive=${alive} attempts=${attempts}`
        )
      }
      await sleep(HEALTH_POLL_INTERVAL_MS)
    }

    log.warn(`health check timeout after ${timeoutMs}ms (attempts=${attempts})`)
    return false
  }

  /**
   * 等待子进程退出
   */
  private waitForExit(timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.proc || this.proc.exitCode !== null) {
        resolve(true)
        return
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        this.proc?.removeListener('exit', onExit)
        resolve(false)
      }, timeoutMs)

      const onExit = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.proc?.removeListener('exit', onExit)
        resolve(true)
      }

      this.proc.once('exit', onExit)
    })
  }

  /**
   * 等待进入指定状态
   */
  private waitForState(target: GatewayState, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.state === target) {
        resolve(true)
        return
      }

      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        this.removeStateChangeListener(waitCb)
        resolve(false)
      }, timeoutMs)

      const waitCb: StateChangeCallback = (change) => {
        if (settled) return
        if (change.to === target) {
          settled = true
          clearTimeout(timer)
          this.removeStateChangeListener(waitCb)
          resolve(true)
        }
      }
      this.addStateChangeListener(waitCb)
    })
  }

  /**
   * 清理残留的旧 Gateway 进程
   * 检测端口是否被占用，尝试用 openclaw gateway stop 清理
   */
  private async cleanupStaleGateway(force = false): Promise<void> {
    const inUse = await this.isPortListening()
    if (!force && !inUse) return

    log.warn(
      force
        ? `forcing stale gateway cleanup on port ${this.port}`
        : `port ${this.port} already in use, attempting cleanup`
    )

    try {
      const runtime = getRuntime()
      const ownedPid = this.proc?.pid
      const orphanPids = await this.findBundledGatewayPidsOnPort(ownedPid)

      if (orphanPids.length > 0) {
        log.warn(`found bundled gateway orphan(s) on port ${this.port}: ${orphanPids.join(', ')}`)
        await this.terminateBundledGatewayPids(orphanPids)
      } else {
        log.debug('no bundled gateway orphan found on target port, falling back to gateway stop')

        const nodeBin = runtime.getNodePath()
        const entry = runtime.getGatewayEntry()
        await execFileAsync(nodeBin, [entry, 'gateway', 'stop'], {
          timeout: 15000,
        })
      }
    } catch {
      log.debug('gateway stop command failed, trying anyway')
    }

    // 等待端口和内部锁释放。即使端口未占用，Windows 上的服务/计划任务残留
    // 也可能还没完成清理，因此强制清理场景下至少等待一个短窗口。
    const minWaitMs = force ? 1500 : 0
    const startedAt = Date.now()

    for (let i = 0; i < 24; i++) {
      await sleep(500)
      const portAlive = await this.isPortListening()
      const waitedEnough = Date.now() - startedAt >= minWaitMs
      if (!portAlive && waitedEnough) {
        log.info('stale gateway cleared')
        return
      }
    }

    log.warn('stale gateway could not be cleared, proceeding anyway')
  }

  private hasGatewayLockConflict(stderrLines: string[], extraMessage?: string): boolean {
    const combined = [...stderrLines]
    if (extraMessage) combined.push(extraMessage)
    const text = combined.join('\n')
    return (
      /gateway already running/i.test(text) ||
      /lock timeout/i.test(text) ||
      /service appears registered/i.test(text) ||
      /Tip:\s*openclaw gateway stop/i.test(text) ||
      /schtasks\s*\/End\s*\/TN\s*"OpenClaw Gateway"/i.test(text)
    )
  }

  private async findBundledGatewayPidsOnPort(ownedPid?: number): Promise<number[]> {
    const pids = await getListeningProcessIds(this.port)
    if (pids.length === 0) return []

    const runtime = getRuntime()
    const nodePath = normalizeForMatch(runtime.getNodePath())
    const entryPath = normalizeForMatch(runtime.getGatewayEntry())
    const matches: number[] = []

    for (const pid of pids) {
      if (ownedPid && pid === ownedPid) continue
      const cmdline = await getProcessCommandLine(pid)
      if (!cmdline) continue
      const normalized = normalizeForMatch(cmdline)
      if (normalized.includes(nodePath) || normalized.includes(entryPath)) {
        matches.push(pid)
      }
    }

    return matches
  }

  private async terminateBundledGatewayPids(pids: number[]): Promise<void> {
    for (const pid of pids) {
      try {
        await terminateProcessTree(pid)
      } catch (err) {
        log.warn(`failed to terminate orphan pid=${pid}:`, err)
      }
    }
  }

  private async isPortListening(): Promise<boolean> {
    try {
      const pids = await getListeningProcessIds(this.port)
      return pids.length > 0
    } catch {
      return false
    }
  }
}

// ========== 单例管理 ==========

let instance: GatewayProcess | null = null

export function getGatewayProcess(): GatewayProcess {
  if (!instance) {
    instance = new GatewayProcess()
  }
  return instance
}

export function createGatewayProcess(port?: number): GatewayProcess {
  instance = new GatewayProcess(port)
  return instance
}

// ========== 工具函数 ==========

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeForMatch(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase()
}

async function getListeningProcessIds(port: number): Promise<number[]> {
  if (IS_WIN) {
    const stdout = await execShellCapture(`netstat -ano | findstr :${port}`, 5000)
    if (!stdout.trim()) return []

    const pids: number[] = []
    for (const line of stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 5 && parts[1]?.endsWith(`:${port}`) && parts[3] === 'LISTENING') {
        const pid = Number(parts[4])
        if (Number.isInteger(pid) && pid > 0) pids.push(pid)
      }
    }
    return [...new Set(pids)]
  }

  const stdout = await execShellCapture(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, 5000)
  if (!stdout.trim()) return []
  return [
    ...new Set(
      stdout
        .split(/\r?\n/)
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isInteger(v) && v > 0)
    ),
  ]
}

async function getProcessCommandLine(pid: number): Promise<string> {
  if (IS_WIN) {
    const stdout = await execShellCapture(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\").CommandLine"`,
      5000
    )
    return stdout.trim()
  }

  const stdout = await execShellCapture(`ps -p ${pid} -o command=`, 5000)
  return stdout.trim()
}

async function terminateProcessTree(pid: number): Promise<void> {
  if (IS_WIN) {
    await execShellCapture(`taskkill /F /PID ${pid} /T`, 8000)
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    return
  }

  await sleep(1200)

  try {
    process.kill(pid, 0)
    process.kill(pid, 'SIGKILL')
  } catch {
    // already exited
  }
}

function execShellCapture(command: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
      if (error) {
        const text = `${stdout || ''}`.trim()
        // 这些命令在“无结果”时通常返回非 0；按空结果处理即可
        if (text === '') {
          resolve('')
          return
        }
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}

function execFileAsync(
  file: string,
  args: string[],
  options: {
    timeout?: number
    shell?: boolean
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      shell: options.shell,
      windowsHide: true,
      stdio: 'ignore',
    })

    let settled = false
    const timer =
      typeof options.timeout === 'number'
        ? setTimeout(() => {
            if (settled) return
            settled = true
            child.kill('SIGKILL')
            reject(new Error(`command timeout after ${options.timeout}ms`))
          }, options.timeout)
        : null

    child.once('error', (error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      reject(error)
    })

    child.once('exit', (code, signal) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`command exited with code=${code} signal=${signal}`))
    })
  })
}
