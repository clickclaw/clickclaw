/**
 * 远程预设服务
 *
 * 职责：
 *  1. 后台静默拉取官方远程 JSON，校验后写入缓存（remote-presets-cache.json）
 *  2. 合并本地内置预设 + 远程缓存，供 provider-presets.ts 消费
 *
 * 设计原则：
 *  - URL 由开发者维护（REMOTE_PRESETS_URL），用户不可修改
 *  - 本地内置数据永远是兜底，远程只做增量合并
 *  - 所有网络/IO 错误静默处理，绝不阻塞主流程
 *  - 渲染层（IPC API）对此层完全透明，无需改动
 *
 * 远程 JSON 格式（REMOTE_PRESETS_URL）：
 * {
 *   "schema": "1.0",
 *   "updatedAt": "2026-03-13",
 *   "providers": {
 *     // 更新已有 Provider 的模型/平台列表
 *     "openai": {
 *       "platforms": [ { "key": "openai", "models": [...], ... } ]
 *     },
 *     // 新增本地没有的 Provider（需完整字段）
 *     "new-llm": {
 *       "name": "New LLM", "group": "china", "color": "#123456",
 *       "initials": "NL", "tagline": "...", "platforms": [...]
 *     }
 *   }
 * }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { REMOTE_PRESETS_CACHE_PATH } from '../constants'
import { CLICKCLAW_API_BASE_URL } from '../../shared/urls'
import { PROVIDER_PRESETS } from '../config/provider-presets.data'
import type { ProviderPreset } from '../config/provider-presets'
import { createLogger } from '../logger'
import { proxyFetch } from '../utils/proxy'

const log = createLogger('remote-presets')

const FETCH_TIMEOUT_MS = 8_000
const SCHEMA_VERSION = 1

/** 官方远程预设地址（开发者维护，用户不可修改） */
const REMOTE_PRESETS_URL = `${CLICKCLAW_API_BASE_URL}/ai/provider.json`

// ========== 类型定义 ==========

/**
 * 远程 JSON 文件格式
 * providers 中每条可以是：
 *  - 完整 ProviderPreset（新增 provider 时）
 *  - 部分字段（更新已有 provider 时，如只更新 platforms）
 */
interface RemotePresetsFile {
  schema: string
  updatedAt?: string
  providers: Record<string, Partial<ProviderPreset>>
}

/** 本地缓存文件格式 */
interface RemotePresetsCache {
  schemaVersion: number
  fetchedAt: string
  providers: Record<string, Partial<ProviderPreset>>
}

/** 对外暴露的状态快照（供 IPC / Settings 页使用） */
export interface RemotePresetsStatus {
  fetchedAt: string | null
  providerCount: number
  fetching: boolean
}

// ========== 工具函数 ==========

function ensureDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8')) as T
  } catch {
    return null
  }
}

function writeJson(path: string, data: unknown): void {
  try {
    ensureDir(path)
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    log.warn('failed to write json:', err)
  }
}

// ========== 缓存读写 ==========

function loadCache(): RemotePresetsCache | null {
  const cache = readJson<RemotePresetsCache>(REMOTE_PRESETS_CACHE_PATH)
  if (!cache || cache.schemaVersion !== SCHEMA_VERSION) return null
  return cache
}

function saveCache(providers: Record<string, Partial<ProviderPreset>>): void {
  const cache: RemotePresetsCache = {
    schemaVersion: SCHEMA_VERSION,
    fetchedAt: new Date().toISOString(),
    providers,
  }
  writeJson(REMOTE_PRESETS_CACHE_PATH, cache)
}

// ========== Schema 校验 ==========

function isValidRemoteFile(data: unknown): data is RemotePresetsFile {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.schema !== 'string') return false
  if (!d.providers || typeof d.providers !== 'object') return false
  return true
}

function isCompletePreset(p: Partial<ProviderPreset>): p is ProviderPreset {
  return (
    typeof p.name === 'string' &&
    (p.group === 'china' || p.group === 'international') &&
    typeof p.color === 'string' &&
    typeof p.initials === 'string' &&
    Array.isArray(p.platforms) &&
    p.platforms.length > 0
  )
}

// ========== 拉取与缓存 ==========

let _fetching = false

/**
 * 拉取远程预设并写入缓存。
 * 失败时静默返回 false，不抛出异常。
 */
export async function fetchAndCachePresets(): Promise<{ success: boolean; error?: string }> {
  if (_fetching) return { success: false, error: 'already fetching' }

  _fetching = true
  try {
    log.info(`fetching remote presets from: ${REMOTE_PRESETS_URL}`)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let res: Response
    try {
      res = await proxyFetch(REMOTE_PRESETS_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'ClickClaw' },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      const msg = `HTTP ${res.status}`
      log.warn(`remote presets fetch failed: ${msg}`)
      return { success: false, error: msg }
    }

    const raw: unknown = await res.json()
    if (!isValidRemoteFile(raw)) {
      log.warn('remote presets: invalid schema')
      return { success: false, error: 'invalid schema' }
    }

    saveCache(raw.providers)
    log.info(`remote presets cached: ${Object.keys(raw.providers).length} providers`)
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.warn(`remote presets fetch error: ${msg}`)
    return { success: false, error: msg }
  } finally {
    _fetching = false
  }
}

/**
 * 应用启动时在后台静默拉取（不阻塞启动流程）。
 */
export function fetchPresetsInBackground(): void {
  // 延迟 3s 执行，避免与启动关键路径竞争
  setTimeout(() => {
    fetchAndCachePresets().catch(() => {})
  }, 3_000)
}

// ========== 合并逻辑（核心） ==========

/**
 * 返回合并后的 Provider 预设：本地内置数据 + 远程缓存增量。
 *
 * 合并规则：
 *  - 已有 Provider + 远程有数据  → 远程字段覆盖本地对应字段（platforms/models 整体替换）
 *  - 远程有新 Provider           → 若字段完整则追加
 *  - 本地有但远程没有            → 原样保留（安全兜底）
 */
export function getMergedProviderPresets(): Record<string, ProviderPreset> {
  const result: Record<string, ProviderPreset> = {}

  // 深拷贝本地预设，避免污染原始数据
  for (const [key, preset] of Object.entries(PROVIDER_PRESETS)) {
    result[key] = {
      ...preset,
      platforms: preset.platforms.map((p) => ({ ...p, models: [...p.models] })),
    }
  }

  const cache = loadCache()
  if (!cache?.providers) return result

  for (const [key, patch] of Object.entries(cache.providers)) {
    if (result[key]) {
      // 已有 Provider：用远程字段覆盖（保留本地中远程未提供的字段）
      result[key] = { ...result[key], ...patch }
    } else {
      // 新 Provider：需要完整字段才能添加
      if (isCompletePreset(patch)) {
        result[key] = patch
        log.debug(`remote presets: added new provider "${key}"`)
      } else {
        log.warn(`remote presets: provider "${key}" skipped (incomplete fields)`)
      }
    }
  }

  return result
}

// ========== 状态查询 ==========

export function getRemotePresetsStatus(): RemotePresetsStatus {
  const cache = loadCache()
  return {
    fetchedAt: cache?.fetchedAt ?? null,
    providerCount: cache ? Object.keys(cache.providers).length : 0,
    fetching: _fetching,
  }
}
