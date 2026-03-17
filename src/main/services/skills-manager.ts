/**
 * Skills 本地管理器
 *
 * 扫描策略（优先级递减）：
 * 1. Gateway 运行时 → 调用 skills.status RPC（最准确，覆盖全部来源）
 * 2. Gateway 未运行 → 目录扫描（读 openclaw.json 获取 workspace 路径）
 *    - <workspace>/skills/
 *    - ~/.openclaw/skills/
 *    - skills.load.extraDirs（可选）
 *
 * 安装/卸载：始终使用文件系统操作（adm-zip 解压 / rmSync）
 */

import { homedir } from 'os'
import { join, normalize, isAbsolute, basename } from 'path'
import { mkdirSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import AdmZip from 'adm-zip'
import { createLogger } from '../logger'
import { readConfig } from '../config/manager'

const log = createLogger('skills-manager')

// ========== 路径常量 ==========

/** ~/.openclaw/skills — 全局 managed skills */
export function getSkillsDir(): string {
  return join(homedir(), '.openclaw', 'skills')
}

/**
 * 从 openclaw.json 解析 workspace 路径
 * 优先级：agents.defaults.workspace > agent.workspace > ~/.openclaw/workspace
 */
export function resolveWorkspaceDir(): string {
  try {
    const cfg = readConfig() as {
      agents?: { defaults?: { workspace?: string }; list?: Array<{ workspace?: string }> }
      agent?: { workspace?: string }
    }
    const raw = cfg.agents?.defaults?.workspace || cfg.agent?.workspace || `~/.openclaw/workspace`
    return raw.replace(/^~/, homedir())
  } catch {
    return join(homedir(), '.openclaw', 'workspace')
  }
}

/**
 * 从 openclaw.json 解析 extraDirs
 */
function resolveExtraDirs(): string[] {
  try {
    const cfg = readConfig() as {
      skills?: { load?: { extraDirs?: string[] } }
    }
    return (cfg.skills?.load?.extraDirs ?? []).map((d) => d.replace(/^~/, homedir()))
  } catch {
    return []
  }
}

// ========== 共享类型 ==========

export interface InstalledSkill {
  /** 目录名（即 slug / skill name） */
  dirName: string
  /** SKILL.md 绝对路径 */
  filePath: string
  /** skill 目录绝对路径 */
  baseDir: string
  name: string
  description?: string
  version?: string
  author?: string
  emoji?: string
  /** 数据来源：workspace / managed / bundled / extra */
  source: 'workspace' | 'managed' | 'bundled' | 'extra'
  /** 是否满足所有门控条件（二进制/环境变量/OS），来自 RPC；目录扫描时为 undefined */
  eligible?: boolean
  /** config key（用于 openclaw.json 配置操作） */
  skillKey?: string
}

// ========== 目录扫描模式（fallback） ==========

/** YAML frontmatter 解析（仅解析顶层 key-value，无需额外依赖） */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/)
    if (kv) result[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return result
}

/** 扫描单个目录下的所有 skills，返回列表 */
function scanSkillsDir(dir: string, source: InstalledSkill['source']): InstalledSkill[] {
  if (!existsSync(dir)) return []

  let entries: string[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return []
  }

  const skills: InstalledSkill[] = []
  for (const dirName of entries) {
    const baseDir = join(dir, dirName)
    const skillMdPath = join(baseDir, 'SKILL.md')
    if (!existsSync(skillMdPath)) continue

    try {
      const content = readFileSync(skillMdPath, 'utf-8')
      const meta = parseFrontmatter(content)
      skills.push({
        dirName,
        filePath: skillMdPath,
        baseDir,
        name: meta.name || dirName,
        description: meta.description || meta.summary,
        version: meta.version,
        author: meta.author,
        emoji: meta.emoji,
        source,
        skillKey: meta.name || dirName,
      })
    } catch (err) {
      log.warn(`Failed to read ${skillMdPath}:`, err)
    }
  }
  return skills
}

/**
 * 目录扫描模式（Gateway 未运行时使用）
 *
 * 扫描顺序（与 OpenClaw 优先级一致）：
 * 1. <workspace>/skills/
 * 2. ~/.openclaw/skills/
 * 3. skills.load.extraDirs（如有）
 *
 * 按 skill name 去重（workspace 优先级最高）
 */
export function listInstalledSkills(): InstalledSkill[] {
  const workspaceDir = resolveWorkspaceDir()
  const managedDir = getSkillsDir()
  const extraDirs = resolveExtraDirs()

  const all: InstalledSkill[] = [
    ...scanSkillsDir(join(workspaceDir, 'skills'), 'workspace'),
    ...scanSkillsDir(managedDir, 'managed'),
    ...extraDirs.flatMap((d) => scanSkillsDir(d, 'extra')),
  ]

  // 按 skill name 去重（先出现的优先级更高）
  const seen = new Set<string>()
  return all.filter((s) => {
    if (seen.has(s.name)) return false
    seen.add(s.name)
    return true
  })
}

// ========== 安装 skill ==========

/**
 * 从 ZIP Buffer 安装 skill 到 ~/.openclaw/skills/<dirName>/
 * 目录命名优先级：ZIP 顶级目录名（含版本，如 feishu-doc-1.2.7）> SKILL.md name+version > slug
 * 路径安全：过滤包含 ".." 的路径，防止 path traversal
 */
export function installSkillFromZip(slug: string, zipBuffer: Buffer, installDir?: string): void {
  // slug 可含路径分隔符（如 clawhub/author/name），逐段校验防止路径穿越
  const slugSegments = slug.split('/')
  if (slugSegments.some((seg) => !seg || seg === '..' || !/^[a-zA-Z0-9._-]+$/.test(seg))) {
    throw new Error(`Invalid skill slug: ${slug}`)
  }
  // 最后一段作为目录名 fallback（去掉命名空间/作者前缀）
  const slugName = slugSegments[slugSegments.length - 1]

  // 优先使用调用方传入的目录（来自 Gateway managedSkillsDir），回退到默认值
  const skillsDir = installDir ? normalize(installDir.replace(/^~/, homedir())) : getSkillsDir()

  mkdirSync(skillsDir, { recursive: true })

  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()

  // 检测是否有公共顶级目录前缀（ZIP 内所有文件都在同一个目录下时自动剥离）
  const nonDirEntries = entries.filter((e) => !e.isDirectory)
  const topDirs = new Set(nonDirEntries.map((e) => e.entryName.split('/')[0]))
  const hasCommonPrefix = topDirs.size === 1
  const prefixDir = hasCommonPrefix ? [...topDirs][0] : null

  // 优先用 ZIP 顶级目录名作为安装目录（保留版本信息，如 feishu-doc-1.2.7）
  // 若顶级目录就是 slugName 或无顶级目录，则读 SKILL.md frontmatter 拼 name-version
  let dirName: string
  if (prefixDir && prefixDir !== slugName && !prefixDir.includes('..')) {
    dirName = prefixDir
  } else {
    dirName = resolveInstallDirName(zip, slugName)
  }

  // dirName 安全校验：不含 ".."，仅允许字母数字连字符下划线点
  if (dirName.includes('..') || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(dirName)) {
    dirName = slugName
  }

  const targetDir = join(skillsDir, dirName)

  for (const entry of entries) {
    const entryPath = entry.entryName

    if (entryPath.includes('..') || isAbsolute(entryPath)) {
      log.warn(`Skipping unsafe path in ZIP: ${entryPath}`)
      continue
    }

    if (entry.isDirectory) continue

    const parts = entryPath.split('/')
    const relativePath = hasCommonPrefix && parts.length > 1 ? parts.slice(1).join('/') : entryPath
    if (!relativePath) continue

    const destPath = normalize(join(targetDir, relativePath))
    if (!destPath.startsWith(targetDir)) {
      log.warn(`Path traversal attempt blocked: ${entryPath}`)
      continue
    }

    mkdirSync(join(destPath, '..'), { recursive: true })
    writeFileSync(destPath, entry.getData())
  }

  log.info(`Skill "${slug}" installed to ${targetDir}`)
}

/**
 * 从 ZIP 中读取 SKILL.md frontmatter，拼出版本化目录名（name-version）
 * 找不到时回退到 fallback
 */
function resolveInstallDirName(zip: AdmZip, fallback: string): string {
  const entry =
    zip.getEntry('SKILL.md') ?? zip.getEntries().find((e) => e.entryName.endsWith('/SKILL.md'))
  if (!entry) return fallback
  try {
    const content = entry.getData().toString('utf-8')
    const meta = parseFrontmatter(content)
    const name = meta.name?.trim()
    const version = meta.version?.trim()
    if (name && version) return `${name}-${version}`
    if (name) return name
  } catch {
    // 忽略解析失败
  }
  return fallback
}

// ========== 卸载 skill ==========

/**
 * 通过绝对路径卸载 skill 目录。
 * 安全约束：
 * - 路径必须是绝对路径
 * - 路径不能含有 ".."
 * - 路径不能在 node_modules 内（防止误删系统内置 skill）
 */
export function uninstallSkillByPath(baseDir: string): void {
  const normalized = normalize(baseDir)
  if (!isAbsolute(normalized)) {
    throw new Error(`Invalid skill path (not absolute): ${baseDir}`)
  }
  if (normalized.includes('..')) {
    throw new Error(`Invalid skill path (traversal): ${baseDir}`)
  }
  // 阻止删除 node_modules 内的系统 skill（openclaw-bundled / openclaw-extra）
  if (normalized.includes('node_modules')) {
    throw new Error(`Cannot uninstall system skills (bundled with openclaw)`)
  }
  if (!existsSync(normalized)) {
    throw new Error(`Skill not found: ${normalized}`)
  }

  rmSync(normalized, { recursive: true, force: true })
  log.info(`Skill uninstalled: ${normalized}`)
}

// ========== 读取 SKILL.md ==========

/**
 * 读取指定路径的 SKILL.md 文件内容
 * 安全约束：路径必须为绝对路径，文件名必须以 SKILL.md 结尾
 */
export function readSkillMd(filePath: string): string {
  const normalized = normalize(filePath)
  if (!isAbsolute(normalized)) {
    throw new Error(`Invalid path (not absolute): ${filePath}`)
  }
  if (!normalized.endsWith('SKILL.md')) {
    throw new Error(`Invalid file: must be SKILL.md`)
  }
  if (!existsSync(normalized)) {
    throw new Error(`File not found: ${normalized}`)
  }
  return readFileSync(normalized, 'utf-8')
}

// ========== 导出 skill 为 ZIP ==========

/**
 * 将 skill 目录打包为 ZIP Buffer
 * 安全约束：路径必须是绝对路径，不能在 node_modules 内
 */
export function exportSkillToZip(baseDir: string): Buffer {
  const normalized = normalize(baseDir)
  if (!isAbsolute(normalized)) {
    throw new Error(`Invalid path (not absolute): ${baseDir}`)
  }
  if (normalized.includes('node_modules')) {
    throw new Error(`Cannot export system skills`)
  }
  if (!existsSync(normalized)) {
    throw new Error(`Skill directory not found: ${normalized}`)
  }

  const zip = new AdmZip()
  const dirName = basename(normalized)
  zip.addLocalFolder(normalized, dirName)
  return zip.toBuffer()
}
