/**
 * 配置备份与恢复 — ClickClaw 差异化方案
 *
 * 设计理念：「智能快照 + OpenClaw 原生备份联动」
 *
 * 与竞品的区别：
 * - 不做盲目的文件复制，每个快照都带**变更摘要**（改了什么、为什么改）
 * - 完整归档交给 OpenClaw 原生 `openclaw backup` 命令，不重复造轮子
 * - 配置健康守卫：写前验证 → 写后验证 → 启动时损坏检测
 *
 * 快照格式（.snapshot.json）：
 * {
 *   meta: { timestamp, source, summary, configHash },
 *   config: { ...原始配置内容 }
 * }
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  statSync,
} from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { CONFIG_PATH, BACKUP_DIR, OPENCLAW_HOME } from '../constants'
import JSON5 from 'json5'
import { createLogger } from '../logger'

const execFileAsync = promisify(execFile)
const log = createLogger('config-backup')

const MAX_SNAPSHOTS = 20
const SNAPSHOT_EXT = '.snapshot.json'

// ========== 类型定义 ==========

/** 变更操作来源 */
export type SnapshotSource =
  | 'setup' // Setup 向导写入
  | 'provider' // Provider 配置变更
  | 'channel' // Channel 配置变更
  | 'agent' // Agent 配置变更
  | 'gateway' // Gateway 配置变更
  | 'restore' // 恢复操作前的安全快照
  | 'manual' // 用户手动触发
  | 'auto' // 其他自动写入

/** 快照元数据 */
export interface SnapshotMeta {
  /** ISO 时间戳 */
  timestamp: string
  /** 操作来源 */
  source: SnapshotSource
  /** 人可读的变更摘要（中文） */
  summary: string
  /** 配置内容 SHA-256 前 12 位 */
  configHash: string
  /** 标记：此快照对应的配置曾成功启动过 Gateway */
  healthy?: boolean
}

/** 快照文件完整结构 */
export interface ConfigSnapshot {
  meta: SnapshotMeta
  config: Record<string, unknown>
}

/** 快照列表项（不含完整配置内容，用于 UI 展示） */
export interface SnapshotListItem {
  fileName: string
  timestamp: string
  source: SnapshotSource
  summary: string
  configHash: string
  healthy: boolean
  size: number
}

/** 配置健康检查结果 */
export interface ConfigHealthResult {
  exists: boolean
  parseable: boolean
  error?: string
}

/** 恢复页面聚合数据 */
export interface RecoveryData {
  configPath: string
  configHealth: ConfigHealthResult
  snapshots: SnapshotListItem[]
  lastHealthySnapshot: SnapshotListItem | null
}

/** 完整备份结果 */
export interface FullBackupResult {
  success: boolean
  archivePath?: string
  error?: string
}

// ========== 配置健康守卫 ==========

/**
 * 检查配置文件健康状态
 */
export function inspectConfigHealth(): ConfigHealthResult {
  if (!existsSync(CONFIG_PATH)) {
    return { exists: false, parseable: false }
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    JSON5.parse(raw)
    return { exists: true, parseable: true }
  } catch (err) {
    return {
      exists: true,
      parseable: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 验证配置内容可解析（用于写前/写后检查）
 */
export function validateConfigContent(content: string): { valid: boolean; error?: string } {
  try {
    JSON5.parse(content)
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ========== 智能快照 ==========

/**
 * 创建配置快照（写入前调用）
 *
 * @param source 操作来源
 * @param summary 变更摘要（人可读，如 "添加 Anthropic Provider"）
 */
export function createSnapshot(source: SnapshotSource, summary: string): string | null {
  if (!existsSync(CONFIG_PATH)) {
    log.debug('no config to snapshot')
    return null
  }

  // 读取并验证当前配置
  let raw: string
  let config: Record<string, unknown>
  try {
    raw = readFileSync(CONFIG_PATH, 'utf-8')
    config = JSON5.parse(raw)
  } catch {
    log.warn('config is invalid, skipping snapshot')
    return null
  }

  // 计算内容哈希
  const configHash = hashContent(raw)

  // 去重：相同内容不重复快照
  const existing = listSnapshots()
  if (existing.length > 0 && existing[0].configHash === configHash) {
    log.debug(`snapshot skipped: content unchanged (hash=${configHash})`)
    return null
  }

  // 确保目录存在
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }

  // 构建快照
  const now = new Date()
  const meta: SnapshotMeta = {
    timestamp: now.toISOString(),
    source,
    summary,
    configHash,
  }

  const snapshot: ConfigSnapshot = { meta, config }
  const fileName = buildSnapshotFileName(now)
  const filePath = join(BACKUP_DIR, fileName)

  writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8')
  log.info(`snapshot created: ${fileName} [${source}] ${summary}`)

  // 清理多余快照
  pruneOldSnapshots()

  return fileName
}

/**
 * 标记快照为"健康"（Gateway 成功启动后调用）
 * 找到与当前配置内容匹配的最新快照并标记
 */
export function markCurrentConfigHealthy(): void {
  if (!existsSync(CONFIG_PATH)) return

  let raw: string
  try {
    raw = readFileSync(CONFIG_PATH, 'utf-8')
  } catch {
    return
  }

  const currentHash = hashContent(raw)
  const snapshots = listSnapshotFiles()

  for (const { fileName, snapshot } of snapshots) {
    if (snapshot.meta.configHash === currentHash) {
      if (snapshot.meta.healthy) return // 已标记
      snapshot.meta.healthy = true
      writeFileSync(join(BACKUP_DIR, fileName), JSON.stringify(snapshot, null, 2), 'utf-8')
      log.info(`snapshot marked healthy: ${fileName}`)
      return
    }
  }

  // 没有匹配的快照，创建一个
  createSnapshot('auto', 'Gateway 成功启动，记录健康配置')
  // 再标记
  const newSnapshots = listSnapshotFiles()
  if (newSnapshots.length > 0 && newSnapshots[0].snapshot.meta.configHash === currentHash) {
    newSnapshots[0].snapshot.meta.healthy = true
    writeFileSync(
      join(BACKUP_DIR, newSnapshots[0].fileName),
      JSON.stringify(newSnapshots[0].snapshot, null, 2),
      'utf-8'
    )
  }
}

/**
 * 从快照恢复配置
 * 恢复前会自动创建安全快照（防止误操作）
 */
export function restoreFromSnapshot(fileName: string): void {
  if (!isSnapshotFileName(fileName)) {
    throw new Error(`invalid snapshot filename: ${fileName}`)
  }

  const filePath = join(BACKUP_DIR, fileName)
  if (!existsSync(filePath)) {
    throw new Error(`snapshot not found: ${fileName}`)
  }

  // 读取快照
  const snapshot = readSnapshot(filePath)
  if (!snapshot) {
    throw new Error(`snapshot is corrupted: ${fileName}`)
  }

  // 恢复前备份当前配置（安全网）
  if (existsSync(CONFIG_PATH)) {
    createSnapshot('restore', `恢复前自动备份（即将恢复到 ${snapshot.meta.summary}）`)
  }

  // 确保目录存在
  if (!existsSync(OPENCLAW_HOME)) {
    mkdirSync(OPENCLAW_HOME, { recursive: true })
  }

  // 写入配置（JSON5 格式）
  const content = JSON5.stringify(snapshot.config, null, 2) + '\n'

  // 写后验证
  const validation = validateConfigContent(content)
  if (!validation.valid) {
    throw new Error(`restored config is invalid: ${validation.error}`)
  }

  writeFileSync(CONFIG_PATH, content, 'utf-8')
  log.info(`config restored from snapshot: ${fileName} (${snapshot.meta.summary})`)
}

/**
 * 恢复到最近的健康快照
 */
export function restoreLastHealthy(): void {
  const healthy = findLastHealthySnapshot()
  if (!healthy) {
    throw new Error('no healthy snapshot available')
  }
  restoreFromSnapshot(healthy.fileName)
}

// ========== 快照查询 ==========

/**
 * 获取快照列表（按时间倒序，不含配置内容）
 */
export function listSnapshots(): SnapshotListItem[] {
  if (!existsSync(BACKUP_DIR)) return []

  return listSnapshotFiles().map(({ fileName, snapshot }) => ({
    fileName,
    timestamp: snapshot.meta.timestamp,
    source: snapshot.meta.source,
    summary: snapshot.meta.summary,
    configHash: snapshot.meta.configHash,
    healthy: snapshot.meta.healthy || false,
    size: statSync(join(BACKUP_DIR, fileName)).size,
  }))
}

/**
 * 查找最近的健康快照
 */
export function findLastHealthySnapshot(): SnapshotListItem | null {
  const snapshots = listSnapshots()
  return snapshots.find((s) => s.healthy) || null
}

/**
 * 获取恢复页面所需的聚合数据
 */
export function getRecoveryData(): RecoveryData {
  const snapshots = listSnapshots()
  return {
    configPath: CONFIG_PATH,
    configHealth: inspectConfigHealth(),
    snapshots,
    lastHealthySnapshot: snapshots.find((s) => s.healthy) || null,
  }
}

// ========== OpenClaw 原生备份联动 ==========

/**
 * 调用 openclaw backup 创建完整归档
 *
 * @param outputDir 输出目录
 * @param onlyConfig 仅备份配置文件
 * @param openclawPath openclaw 可执行文件路径
 */
export async function createFullBackup(
  outputDir: string,
  openclawPath: string,
  onlyConfig = false
): Promise<FullBackupResult> {
  const args = ['backup', 'create', '--output', outputDir]
  if (onlyConfig) args.push('--only-config')
  args.push('--verify')

  try {
    const { stdout } = await execFileAsync(openclawPath, args, { timeout: 60000 })
    log.info(`full backup created: ${stdout.trim()}`)

    // 从输出中提取归档路径
    const match = stdout.match(/([^\s]+\.tar\.gz)/)
    return {
      success: true,
      archivePath: match ? match[1] : outputDir,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('full backup failed:', message)
    return { success: false, error: message }
  }
}

/**
 * 验证 openclaw backup 归档完整性
 */
export async function verifyFullBackup(
  archivePath: string,
  openclawPath: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    await execFileAsync(openclawPath, ['backup', 'verify', archivePath], {
      timeout: 60000,
    })
    return { valid: true }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ========== 内部工具函数 ==========

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12)
}

function buildSnapshotFileName(date: Date): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('')

  const primary = `${stamp}${SNAPSHOT_EXT}`
  if (!existsSync(join(BACKUP_DIR, primary))) return primary

  // 同秒冲突
  for (let i = 1; i < 100; i++) {
    const candidate = `${stamp}-${String(i).padStart(2, '0')}${SNAPSHOT_EXT}`
    if (!existsSync(join(BACKUP_DIR, candidate))) return candidate
  }

  return `${stamp}-${Date.now()}${SNAPSHOT_EXT}`
}

function isSnapshotFileName(fileName: string): boolean {
  return /^\d{8}-\d{6}(?:-\d{2}|-\d{13})?\.snapshot\.json$/.test(fileName)
}

function readSnapshot(filePath: string): ConfigSnapshot | null {
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (!data.meta || !data.config) return null
    return data as ConfigSnapshot
  } catch {
    return null
  }
}

/**
 * 读取所有快照文件（按时间倒序）
 */
function listSnapshotFiles(): Array<{ fileName: string; snapshot: ConfigSnapshot }> {
  if (!existsSync(BACKUP_DIR)) return []

  try {
    return readdirSync(BACKUP_DIR)
      .filter(isSnapshotFileName)
      .sort((a, b) => b.localeCompare(a)) // 文件名即时间戳，字典序 = 时间序
      .map((fileName) => {
        const snapshot = readSnapshot(join(BACKUP_DIR, fileName))
        return snapshot ? { fileName, snapshot } : null
      })
      .filter((item): item is { fileName: string; snapshot: ConfigSnapshot } => item !== null)
  } catch {
    return []
  }
}

function pruneOldSnapshots(): void {
  if (!existsSync(BACKUP_DIR)) return

  try {
    const files = readdirSync(BACKUP_DIR)
      .filter(isSnapshotFileName)
      .sort((a, b) => b.localeCompare(a))

    for (let i = MAX_SNAPSHOTS; i < files.length; i++) {
      try {
        unlinkSync(join(BACKUP_DIR, files[i]))
        log.debug(`pruned old snapshot: ${files[i]}`)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
