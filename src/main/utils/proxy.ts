/**
 * 代理工具 — 三层代理统一入口
 *
 * 层 1: Electron session proxy（session.defaultSession.setProxy）
 *       → 覆盖 Electron net.fetch() / 渲染层所有请求
 *
 * 层 2: Gateway subprocess env（HTTP_PROXY / HTTPS_PROXY / ALL_PROXY）
 *       → openclaw 子进程的所有 AI API 请求走代理
 *       → 由 gateway/process.ts 在 spawn 时注入
 *
 * 层 3: openclaw.json Telegram proxy 字段同步
 *       → gramjs 不读 env，必须显式写入 channels.telegram.proxy
 */

import { session, net } from 'electron'
import { createLogger } from '../logger'
import type { ProxySettings } from '../settings'

const log = createLogger('proxy')

// ─── 类型 ───

interface ElectronProxyConfig {
  mode: 'direct' | 'fixed_servers'
  proxyRules?: string
  proxyBypassRules?: string
}

// ─── 规范化 ───

/**
 * 补全用户输入的代理地址（裸 host:port → http://host:port）
 */
export function normalizeProxyUrl(url: string): string {
  const v = url.trim()
  if (!v) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v
  return `http://${v}`
}

/**
 * 将绕过规则字符串（分号 / 逗号分隔）转换为 NO_PROXY 格式（逗号分隔）
 */
function formatBypass(bypass: string): string {
  return bypass
    .split(/[;,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',')
}

// ─── 层 1: Electron session proxy ───

/**
 * 构建 Electron session.setProxy() 参数
 */
export function buildElectronProxyConfig(settings: ProxySettings): ElectronProxyConfig {
  if (!settings.proxyEnabled || !settings.proxyUrl.trim()) {
    return { mode: 'direct' }
  }
  const url = normalizeProxyUrl(settings.proxyUrl)
  return {
    mode: 'fixed_servers',
    proxyRules: url,
    proxyBypassRules: settings.proxyBypass || 'localhost;127.0.0.1;::1;<local>',
  }
}

/**
 * 将代理设置应用到 Electron session（立即生效于主进程 net.fetch / 渲染层请求）
 */
export async function applyElectronProxy(settings: ProxySettings): Promise<void> {
  const config = buildElectronProxyConfig(settings)
  await session.defaultSession.setProxy(config)
  try {
    // 关闭已有连接，确保新请求使用新代理
    await session.defaultSession.closeAllConnections()
  } catch {
    // best-effort
  }
  log.info(
    config.mode === 'direct'
      ? '代理已禁用（direct）'
      : `代理已应用: ${config.proxyRules}，绕过: ${config.proxyBypassRules ?? '-'}`
  )
}

// ─── 层 2: Gateway subprocess env ───

/**
 * 构建注入到 Gateway 子进程的代理环境变量
 * Node.js 的 fetch / https 模块和大部分 HTTP 库都会读取这些变量
 */
export function buildProxyEnv(settings: ProxySettings): Record<string, string> {
  // 无论是否启用，都返回完整的键集合（禁用时置空，清除父进程可能带来的残留代理）
  const blank: Record<string, string> = {
    HTTP_PROXY: '',
    HTTPS_PROXY: '',
    ALL_PROXY: '',
    http_proxy: '',
    https_proxy: '',
    all_proxy: '',
    NO_PROXY: '',
    no_proxy: '',
  }
  if (!settings.proxyEnabled || !settings.proxyUrl.trim()) return blank
  const url = normalizeProxyUrl(settings.proxyUrl)
  const noProxy = formatBypass(settings.proxyBypass)
  return {
    HTTP_PROXY: url,
    HTTPS_PROXY: url,
    ALL_PROXY: url,
    http_proxy: url,
    https_proxy: url,
    all_proxy: url,
    NO_PROXY: noProxy,
    no_proxy: noProxy,
  }
}

// ─── 层 3: Telegram openclaw.json proxy 同步 ───

/**
 * 将代理设置同步到 openclaw.json 的 channels.telegram.proxy 字段
 *
 * Telegram 使用的 gramjs 不读取 env，必须在 openclaw.json 中显式配置 proxy。
 * 仅当 telegram 渠道已配置时才操作，否则跳过（不自动创建 channels.telegram）。
 *
 * @param proxyUrl 代理地址（空字符串表示清除代理）
 */
export function syncTelegramProxy(proxyUrl: string): void {
  // 延迟导入避免模块循环（settings → proxy → config → settings）
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manager = require('../config/manager') as typeof import('../config/manager')
    const { readConfig, writeConfig } = manager

    const config = readConfig()
    if (!config.channels?.telegram) {
      // Telegram 尚未配置，无需操作
      return
    }

    const telegram = { ...(config.channels.telegram as Record<string, unknown>) }
    if (proxyUrl) {
      telegram.proxy = proxyUrl
    } else {
      delete telegram.proxy
    }

    writeConfig(
      { ...config, channels: { ...config.channels, telegram } },
      { skipSnapshot: true, source: 'auto', summary: '同步代理设置到 Telegram 渠道' }
    )
    log.info(`Telegram 代理已同步: ${proxyUrl || '（已清除）'}`)
  } catch (err) {
    // 不因代理同步失败而影响主流程
    log.warn('Telegram 代理同步失败:', err)
  }
}

// ─── 代理感知 fetch ───

/**
 * 走 Electron net.fetch，自动遵循 session proxy 设置。
 * 主进程所有对外 HTTP 请求应使用此函数，而非原生 fetch()。
 */
export function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  return net.fetch(url, init as Parameters<typeof net.fetch>[1]) as Promise<Response>
}

// ─── 代理连通性测试 ───

/**
 * 测试代理连通性
 *
 * 传入 proxyUrl 时，创建临时隔离 session 直接测试该地址，
 * 完全不影响主 session，也不需要提前保存或重启 Gateway。
 * 不传时，走当前 session 的已应用代理。
 */
export async function testProxyConnectivity(opts?: {
  proxyUrl?: string
  proxyBypass?: string
}): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now()
  try {
    let fetchFn: (url: string, init?: RequestInit) => Promise<Response>

    if (opts?.proxyUrl?.trim()) {
      // 临时 session：独立测试指定代理，不污染主 session
      const tempSession = session.fromPartition(`partition:proxy-test-${Date.now()}`, {
        cache: false,
      })
      await tempSession.setProxy({
        mode: 'fixed_servers',
        proxyRules: normalizeProxyUrl(opts.proxyUrl),
        proxyBypassRules: opts.proxyBypass || 'localhost;127.0.0.1;::1;<local>',
      })
      fetchFn = (url, init) => tempSession.fetch(url, init as RequestInit) as Promise<Response>
    } else {
      // 走主 session 已应用的代理
      fetchFn = (url, init) =>
        net.fetch(url, init as Parameters<typeof net.fetch>[1]) as Promise<Response>
    }

    const resp = await fetchFn('https://www.google.com/generate_204', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    const latencyMs = Date.now() - start
    if (resp.status < 500) {
      return { ok: true, latencyMs }
    }
    return { ok: false, latencyMs, error: `HTTP ${resp.status}` }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
