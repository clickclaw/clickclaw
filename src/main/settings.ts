/**
 * 应用设置持久化 — ~/.clickclaw/settings.json
 *
 * 存储 ClickClaw 自身的设置（代理、主题等），
 * 与 OpenClaw 的 openclaw.json 完全隔离。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CLICKCLAW_HOME } from './constants'
import { createLogger } from './logger'

const log = createLogger('settings')

const SETTINGS_PATH = join(CLICKCLAW_HOME, 'settings.json')

// ─── 类型定义 ───

export interface ProxySettings {
  /** 是否启用代理 */
  proxyEnabled: boolean
  /** 代理地址，如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080 */
  proxyUrl: string
  /** 绕过地址，分号分隔，如 localhost;127.0.0.1;::1;<local> */
  proxyBypass: string
}

export type AppSettings = ProxySettings

// ─── 默认值 ───

const DEFAULTS: AppSettings = {
  proxyEnabled: false,
  proxyUrl: '',
  proxyBypass: 'localhost;127.0.0.1;::1;<local>',
}

// ─── 读写 ───

/**
 * 读取当前设置（不存在时返回默认值）
 */
export function getSettings(): AppSettings {
  if (!existsSync(SETTINGS_PATH)) return { ...DEFAULTS }
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch (err) {
    log.warn('读取设置失败，使用默认值:', err)
    return { ...DEFAULTS }
  }
}

/**
 * 保存设置（增量合并，不影响未传入的字段）
 */
export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const next: AppSettings = { ...current, ...patch }
  try {
    mkdirSync(CLICKCLAW_HOME, { recursive: true })
    writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf-8')
    log.info('设置已保存')
  } catch (err) {
    log.error('保存设置失败:', err)
    throw err
  }
  return next
}
