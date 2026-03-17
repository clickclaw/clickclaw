/**
 * OpenClaw 升级服务
 *
 * 方案 B：把新版 openclaw 安装到用户可写目录 ~/.clickclaw/gateway/，
 * 避开 macOS app bundle 只读限制。
 *
 * 升级后：
 *   - resolveBundledGatewayEntry() / resolveBundledGatewayCwd() 自动优先读取用户目录
 *   - 调用 installCli() 更新 wrapper 脚本中的入口路径
 *   - 由 UI 触发 gateway:restart 使新版生效
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import {
  CLICKCLAW_GATEWAY_DIR,
  resolveBundledNodeBin,
  resolveBundledNpmBin,
  resolveResourcesPath,
} from '../constants'
import { installCli } from './cli-integration'
import { createLogger } from '../logger'

const log = createLogger('openclaw-updater')

// npm registry 地址（优先 npmmirror，对应站点 https://npmmirror.com/）
// 注意：npm install 需要的是 registry API 端点，不是镜像站首页。
const REGISTRY_MIRRORS = ['https://registry.npmmirror.com', 'https://registry.npmjs.org']

// ─── 类型定义 ───

export type OpenclawUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'installing'
  | 'done'
  | 'error'

export interface OpenclawUpdateInfo {
  status: OpenclawUpdateStatus
  /** 当前运行版本（用户目录优先，回退内置） */
  currentVersion: string
  /** npm registry 上的最新版本 */
  latestVersion?: string
  error?: string
  /** npm install 流式输出日志行 */
  logLines: string[]
}

// ─── 版本解析 ───

/**
 * 从指定 package.json 读取版本号，读取失败返回 null
 */
function readPackageVersion(pkgJsonPath: string): string | null {
  try {
    if (!existsSync(pkgJsonPath)) return null
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

/**
 * 将应用内置的 extensions 同步到用户升级目录中的 openclaw/extensions。
 *
 * 背景：
 * - 安装包构建时，国内 IM 插件被注入到 app resources/gateway/node_modules/openclaw/extensions/
 * - 设置页升级 openclaw 时，会把新版安装到 ~/.clickclaw/gateway/node_modules/openclaw/
 * - 运行时优先使用用户目录，因此若不复制 extensions，升级后这些插件会“消失”
 */
function syncBundledExtensionsToUserGateway(onLog: (line: string) => void): void {
  const bundledExtensionsDir = join(
    resolveResourcesPath(),
    'gateway',
    'node_modules',
    'openclaw',
    'extensions'
  )
  const userOpenclawDir = join(CLICKCLAW_GATEWAY_DIR, 'node_modules', 'openclaw')
  const userExtensionsDir = join(userOpenclawDir, 'extensions')

  if (!existsSync(bundledExtensionsDir)) {
    const msg = `未找到内置插件目录，跳过同步: ${bundledExtensionsDir}`
    log.warn(msg)
    onLog(`[ClickClaw] 警告：${msg}`)
    return
  }

  mkdirSync(userExtensionsDir, { recursive: true })

  const copiedPluginIds: string[] = []
  for (const entry of readdirSync(bundledExtensionsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    const srcDir = join(bundledExtensionsDir, entry.name)
    const manifestPath = join(srcDir, 'openclaw.plugin.json')
    if (!existsSync(manifestPath)) continue

    const destDir = join(userExtensionsDir, entry.name)
    rmSync(destDir, { recursive: true, force: true })
    cpSync(srcDir, destDir, { recursive: true, dereference: true })
    copiedPluginIds.push(entry.name)
  }

  if (copiedPluginIds.length > 0) {
    const msg = `已同步内置插件到用户升级目录: ${copiedPluginIds.join(', ')}`
    log.info(msg)
    onLog(`[ClickClaw] ${msg}`)
  } else {
    const msg = '内置插件目录存在，但未发现有效插件清单'
    log.warn(msg)
    onLog(`[ClickClaw] 警告：${msg}`)
  }
}

/**
 * 获取当前运行的 openclaw 版本
 * 优先级：用户目录 > app 内置资源
 */
export function getCurrentOpenclawVersion(): string {
  // 1. 用户升级目录
  const userPkg = join(CLICKCLAW_GATEWAY_DIR, 'node_modules', 'openclaw', 'package.json')
  const userVersion = readPackageVersion(userPkg)
  if (userVersion) return userVersion

  // 2. app 内置资源
  const resources = resolveResourcesPath()
  const bundledPkg = join(resources, 'gateway', 'node_modules', 'openclaw', 'package.json')
  const bundledVersion = readPackageVersion(bundledPkg)
  if (bundledVersion) return bundledVersion

  return 'unknown'
}

/**
 * 判断当前版本是否来自用户升级目录（已升级过）
 */
export function isUserUpgraded(): boolean {
  const userPkg = join(CLICKCLAW_GATEWAY_DIR, 'node_modules', 'openclaw', 'package.json')
  return existsSync(userPkg) && readPackageVersion(userPkg) !== null
}

// ─── Registry 查询 ───

/**
 * 从 npm registry 查询 openclaw 最新版本
 * 依次尝试国内镜像和官方 registry，返回版本号字符串
 */
async function fetchLatestVersion(): Promise<string> {
  const errors: string[] = []
  for (const registry of REGISTRY_MIRRORS) {
    const url = `${registry}/openclaw/latest`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { version?: string }
      if (!data.version) throw new Error('no version field in response')
      log.info(`从 ${registry} 获取到最新版本: ${data.version}`)
      return data.version
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn(`registry ${registry} 失败: ${msg}`)
      errors.push(`${registry}: ${msg}`)
    }
  }
  throw new Error(`所有 registry 均不可用：${errors.join('; ')}`)
}

// ─── 公开 API ───

/**
 * 检查 openclaw 是否有可用更新
 */
export async function checkOpenclawUpdate(): Promise<OpenclawUpdateInfo> {
  const currentVersion = getCurrentOpenclawVersion()
  const info: OpenclawUpdateInfo = {
    status: 'checking',
    currentVersion,
    logLines: [],
  }

  try {
    const latestVersion = await fetchLatestVersion()
    info.latestVersion = latestVersion

    if (currentVersion === 'unknown') {
      // 无法判断版本，认为有可用更新
      info.status = 'available'
    } else if (latestVersion === currentVersion) {
      info.status = 'up-to-date'
    } else {
      // 简单字符串比较（semver 场景下 npm registry 返回的是最新稳定版，通常更大）
      info.status = 'available'
    }
  } catch (err) {
    info.status = 'error'
    info.error = err instanceof Error ? err.message : String(err)
    log.error('checkOpenclawUpdate failed:', info.error)
  }

  return info
}

/**
 * 执行 openclaw 升级
 *
 * 流程：
 * 1. 创建用户 gateway 目录
 * 2. 用内置 npm 安装指定版本到该目录
 * 3. 流式推送 npm 日志到 onLog 回调
 * 4. 安装成功后更新 CLI wrapper
 *
 * @param version 目标版本号（如 "0.8.5"）
 * @param onLog   日志行回调（流式）
 */
export async function installOpenclawUpdate(
  version: string,
  onLog: (line: string) => void
): Promise<{ success: boolean; error?: string }> {
  log.info(`开始安装 openclaw@${version} 到 ${CLICKCLAW_GATEWAY_DIR}`)
  onLog(`[ClickClaw] 开始安装 openclaw@${version}...`)

  // 1. 确保目标目录存在
  try {
    mkdirSync(CLICKCLAW_GATEWAY_DIR, { recursive: true })
  } catch (err) {
    const msg = `创建目录失败: ${err instanceof Error ? err.message : String(err)}`
    log.error(msg)
    return { success: false, error: msg }
  }

  // 2. 构建 npm install 命令
  const nodeBin = resolveBundledNodeBin()
  const npmCli = resolveBundledNpmBin()
  const packageSpec = `openclaw@${version}`

  // 优先用国内 registry
  const registry = REGISTRY_MIRRORS[0]

  const args = [
    npmCli,
    'install',
    packageSpec,
    '--prefix',
    CLICKCLAW_GATEWAY_DIR,
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    `--registry=${registry}`,
  ]

  log.info(`执行: ${nodeBin} ${args.join(' ')}`)

  return new Promise((resolve) => {
    const child = spawn(nodeBin, args, {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        // 防止 npm 尝试打开浏览器或交互
        npm_config_yes: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const pushLine = (raw: string): void => {
      raw
        .split('\n')
        .map((l) => l.trimEnd())
        .filter(Boolean)
        .forEach((line) => {
          log.info(`[npm] ${line}`)
          onLog(line)
        })
    }

    child.stdout?.on('data', (chunk: Buffer) => pushLine(chunk.toString('utf-8')))
    child.stderr?.on('data', (chunk: Buffer) => pushLine(chunk.toString('utf-8')))

    child.on('error', (err) => {
      const msg = `npm 进程启动失败: ${err.message}`
      log.error(msg)
      onLog(`[ClickClaw] 错误：${msg}`)
      resolve({ success: false, error: msg })
    })

    child.on('close', (code) => {
      if (code === 0) {
        log.info(`openclaw@${version} 安装成功`)
        onLog(`[ClickClaw] openclaw@${version} 安装成功`)

        // 3. 将构建时注入的内置插件同步到用户升级目录
        try {
          syncBundledExtensionsToUserGateway(onLog)
        } catch (err) {
          const msg = `同步内置插件失败: ${err instanceof Error ? err.message : String(err)}`
          log.error(msg)
          onLog(`[ClickClaw] 错误：${msg}`)
          resolve({ success: false, error: msg })
          return
        }

        // 4. 更新 CLI wrapper（使其指向用户目录中的新版本）
        try {
          installCli()
          log.info('CLI wrapper 已更新')
          onLog('[ClickClaw] CLI wrapper 已更新')
        } catch (err) {
          log.warn('CLI wrapper 更新失败（不影响升级）:', err)
          onLog(
            `[ClickClaw] 警告：CLI wrapper 更新失败（${err instanceof Error ? err.message : String(err)}）`
          )
        }

        resolve({ success: true })
      } else {
        const msg = `npm install 退出码: ${code}`
        log.error(msg)
        onLog(`[ClickClaw] 安装失败（退出码 ${code}）`)
        resolve({ success: false, error: msg })
      }
    })
  })
}
