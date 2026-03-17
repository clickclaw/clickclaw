/**
 * ClickClaw 本地缓存管理
 *
 * 文件位置：~/.clickclaw/
 *   app-state.json     — UI 状态持久化（侧栏折叠、窗口尺寸）
 *
 * 设计原则：
 * - 纯 JSON，不引入任何新依赖
 * - 读取失败时静默返回 null / 默认值，不阻塞主流程
 * - 写入失败时只记录警告，不抛出异常
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { CLICKCLAW_HOME, APP_STATE_PATH, SKILL_VET_CACHE_PATH } from '../constants'
import { createLogger } from '../logger'

const log = createLogger('app-cache')

// ========== 类型定义 ==========

/** app-state.json 的结构 */
export interface AppState {
  schemaVersion: number
  /** 是否已完成 ClickClaw 首次初始化（独立于 OpenClaw 配置探测） */
  setupCompleted?: boolean
  /** 侧栏折叠状态 */
  sidebarCollapsed: boolean
  /** 随应用启动自动开启 Gateway */
  autoStartGateway: boolean
  /** Dashboard 新手引导展示策略 */
  dashboardGuideMode?: 'auto' | 'always' | 'hidden'
  /** 是否至少成功启动过一次 Gateway（用于新手引导自动折叠） */
  hasGatewayStartedOnce?: boolean
  /** 是否已显示过“检测到现有配置”对话框（仅首次启动显示） */
  hasSeenConfigFoundDialog?: boolean
  /** 上次窗口尺寸与位置 */
  windowBounds: { x: number; y: number; width: number; height: number } | null
  /** Skill 安全审查设置 */
  skillVetter?: {
    enabled: boolean
    customModel: string | null
  }
}

// ========== Skill 安全审查类型 ==========

/** Skill 安全审查结果 */
export interface VetResult {
  slug: string
  version: string
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  verdict: 'safe' | 'caution' | 'unsafe'
  /** 发现的安全风险列表 */
  redFlags: string[]
  /** 权限分析 */
  permissions: {
    files: string[]
    network: string[]
    commands: string[]
  }
  notes: string
  /** AI 原始回复 */
  rawReport: string
  /** 审查时间戳 */
  vetAt: number
}

/** Skill 安全审查设置 */
export interface SkillVetterSettings {
  enabled: boolean
  customModel: string | null
}

// ========== 工具函数 ==========

/** 确保目录存在 */
function ensureDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    log.debug(`created directory: ${dir}`)
  }
}

/** 安全读取 JSON 文件，失败返回 null */
function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content) as T
  } catch (err) {
    log.warn(`failed to read ${path}:`, err)
    return null
  }
}

/** 安全写入 JSON 文件，失败只记录警告 */
function writeJson(path: string, data: unknown): void {
  try {
    ensureDir(path)
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    log.warn(`failed to write ${path}:`, err)
  }
}

// ========== app-state.json ==========

const APP_STATE_SCHEMA_VERSION = 1

const DEFAULT_APP_STATE: AppState = {
  schemaVersion: APP_STATE_SCHEMA_VERSION,
  setupCompleted: false,
  sidebarCollapsed: false,
  autoStartGateway: true,
  dashboardGuideMode: 'auto',
  hasGatewayStartedOnce: false,
  hasSeenConfigFoundDialog: false,
  windowBounds: null,
}

/** 加载 app-state.json，文件不存在或损坏时返回默认值 */
export function loadAppState(): AppState {
  const state = readJson<AppState>(APP_STATE_PATH)
  if (!state || state.schemaVersion !== APP_STATE_SCHEMA_VERSION) {
    return { ...DEFAULT_APP_STATE }
  }
  return {
    ...DEFAULT_APP_STATE,
    ...state,
  }
}

/** 保存 app-state 的部分字段（增量更新，其余字段保留） */
export function saveAppState(patch: Partial<Omit<AppState, 'schemaVersion'>>): void {
  const current = loadAppState()
  const updated: AppState = { ...current, ...patch }
  writeJson(APP_STATE_PATH, updated)
}

// ========== 导出目录路径供外部使用 ==========
export { CLICKCLAW_HOME }

// ========== Skill 安全审查设置 ==========

/** 读取 Skill 安全审查设置（从 app-state.json 中的 skillVetter 字段） */
export function getSkillVetterSettings(): SkillVetterSettings {
  const state = loadAppState()
  return {
    enabled: state.skillVetter?.enabled !== false, // 默认 true
    customModel: state.skillVetter?.customModel ?? null,
  }
}

/** 保存 Skill 安全审查设置 */
export function saveSkillVetterSettings(s: SkillVetterSettings): void {
  saveAppState({ skillVetter: s })
}

// ========== Skill 审查结果缓存（skill-vet-cache.json） ==========

type VetCacheStore = Record<string, VetResult>

function loadVetCacheStore(): VetCacheStore {
  return readJson<VetCacheStore>(SKILL_VET_CACHE_PATH) ?? {}
}

/** 读取单条审查缓存，key 为 slug@version */
export function getVetCache(slug: string, version: string): VetResult | null {
  const store = loadVetCacheStore()
  return store[`${slug}@${version}`] ?? null
}

/** 写入单条审查缓存，key 为 slug@version */
export function setVetCache(slug: string, version: string, result: VetResult): void {
  const store = loadVetCacheStore()
  store[`${slug}@${version}`] = result
  writeJson(SKILL_VET_CACHE_PATH, store)
}
