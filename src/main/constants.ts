import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'

// ========== 网络与超时 ==========

export const DEFAULT_PORT = 18789
export const DEFAULT_BIND = 'loopback'
export const HEALTH_CHECK_TIMEOUT_MS = 120_000 // Windows Defender 冷启动慢
export const HEALTH_POLL_INTERVAL_MS = 500
export const CRASH_COOLDOWN_MS = 5_000
export const MAX_RESTART_ATTEMPTS = 3

// ========== 平台判断 ==========

export const IS_WIN = process.platform === 'win32'
export const IS_MAC = process.platform === 'darwin'

// ========== OpenClaw 用户路径（OpenClaw 自身定义，不可更改） ==========

/** ~/.openclaw */
export const OPENCLAW_HOME = join(homedir(), '.openclaw')
/** ~/.openclaw/openclaw.json */
export const CONFIG_PATH = join(OPENCLAW_HOME, 'openclaw.json')
/** ~/.openclaw/.env */
export const ENV_PATH = join(OPENCLAW_HOME, '.env')
/** ~/.openclaw/config-backups/ */
export const BACKUP_DIR = join(OPENCLAW_HOME, 'config-backups')
/** ~/.openclaw/gateway.log */
export const GATEWAY_LOG_PATH = join(OPENCLAW_HOME, 'gateway.log')

// ========== ClickClaw 自身数据路径（~/.clickclaw/） ==========

/**
 * ClickClaw 数据目录，用于存储 ClickClaw 自身的缓存和状态，与 OpenClaw 路径完全隔离
 * - macOS / Linux / Windows：~/.clickclaw/
 */
export const CLICKCLAW_HOME = join(homedir(), '.clickclaw')

/** ~/.clickclaw/app-state.json — UI 状态持久化（侧栏折叠、窗口尺寸等） */
export const APP_STATE_PATH = join(CLICKCLAW_HOME, 'app-state.json')

/** ~/.clickclaw/remote-presets-cache.json — 远程预设数据缓存 */
export const REMOTE_PRESETS_CACHE_PATH = join(CLICKCLAW_HOME, 'remote-presets-cache.json')
export const DEVICE_IDENTITY_PATH = join(CLICKCLAW_HOME, 'device-identity.json')

/** ~/.clickclaw/device-auth.json — Gateway 颁发的 deviceToken 持久化 */
export const DEVICE_AUTH_PATH = join(CLICKCLAW_HOME, 'device-auth.json')

/** ~/.clickclaw/skill-vet-cache.json — Skill 安全审查结果缓存 */
export const SKILL_VET_CACHE_PATH = join(CLICKCLAW_HOME, 'skill-vet-cache.json')

/**
 * ~/.clickclaw/gateway/ — 用户可写的 openclaw 升级目录
 * 升级后的 openclaw 安装到此目录，优先于 app 内置资源
 */
export const CLICKCLAW_GATEWAY_DIR = join(CLICKCLAW_HOME, 'gateway')

// ========== ClickClaw 应用数据路径（跟随平台标准） ==========

/**
 * ClickClaw 应用数据目录
 * - macOS: ~/Library/Application Support/ClickClaw/
 * - Windows: %LOCALAPPDATA%\ClickClaw\
 */
export function resolveAppDataDir(): string {
  // Electron 的 app.getPath('userData') 自动处理平台差异
  // macOS: ~/Library/Application Support/ClickClaw
  // Windows: %APPDATA%\ClickClaw (Roaming)
  // 但 Windows 更推荐用 LOCALAPPDATA（不跨机器漫游）
  if (IS_WIN) {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    return join(localAppData, 'ClickClaw')
  }
  // macOS / Linux: 用 Electron 标准路径
  return app.getPath('userData')
}

/** ~/.clickclaw/logs/ — ClickClaw 日志目录 */
export function resolveLogDir(): string {
  return join(CLICKCLAW_HOME, 'logs')
}

/** ~/.clickclaw/logs/clickclaw.log — ClickClaw 主日志文件 */
export function resolveLogPath(): string {
  return join(resolveLogDir(), 'clickclaw.log')
}

// ========== 内置资源路径 ==========

/** 判断是否为打包后的环境 */
export function isPackaged(): boolean {
  return app.isPackaged
}

/**
 * 内置资源根路径
 * - 开发模式：项目根目录/resources/targets/<platform-arch>
 * - 打包模式：process.resourcesPath
 */
export function resolveResourcesPath(): string {
  if (isPackaged()) {
    return process.resourcesPath
  }
  const platform = IS_MAC ? 'darwin' : 'win32'
  const arch = process.arch
  return join(app.getAppPath(), 'resources', 'targets', `${platform}-${arch}`)
}

/**
 * 内置 Node.js 二进制路径
 * - 开发模式：resources/targets/<platform-arch>/runtime/bin/node
 * - macOS 打包：ELECTRON_RUN_AS_NODE=1 复用 Electron Helper
 * - Windows 打包：resources/runtime/node.exe
 */
export function resolveBundledNodeBin(): string {
  const resources = resolveResourcesPath()

  if (!isPackaged()) {
    const ext = IS_WIN ? 'node.exe' : 'bin/node'
    return join(resources, 'runtime', ext)
  }

  if (IS_MAC) {
    const helperPath = process.execPath.replace(
      /\.app\/Contents\/MacOS\/[^/]+$/,
      '.app/Contents/Frameworks/ClickClaw Helper.app/Contents/MacOS/ClickClaw Helper'
    )
    return helperPath
  }

  return join(resources, 'runtime', 'node.exe')
}

/**
 * 内置 npm CLI 路径
 */
export function resolveBundledNpmBin(): string {
  const resources = resolveResourcesPath()
  const candidates = IS_WIN
    ? [
        join(resources, 'runtime', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        join(resources, 'runtime', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      ]
    : [
        join(resources, 'runtime', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        join(resources, 'runtime', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  // 文件可能尚未生成；返回平台首选路径，供上层日志输出真实目标
  return candidates[0]
}

/**
 * 内置 Gateway 入口文件
 * 优先级：
 *   1. 用户升级目录 ~/.clickclaw/gateway/node_modules/openclaw/openclaw.mjs
 *   2. app 内置资源 openclaw.mjs（新包名）
 *   3. app 内置资源 gateway-entry.mjs（旧包名回退）
 */
export function resolveBundledGatewayEntry(): string {
  // 优先读取用户升级目录（可写，支持 macOS app bundle 只读限制）
  const userEntry = join(CLICKCLAW_GATEWAY_DIR, 'node_modules', 'openclaw', 'openclaw.mjs')
  if (existsSync(userEntry)) return userEntry

  // 回退：app 内置资源（只读）
  const resources = resolveResourcesPath()
  const newEntry = join(resources, 'gateway', 'node_modules', 'openclaw', 'openclaw.mjs')
  if (existsSync(newEntry)) return newEntry
  return join(resources, 'gateway', 'node_modules', 'openclaw', 'gateway-entry.mjs')
}

/**
 * 内置 Gateway 工作目录
 * 优先读取用户升级目录，回退 app 内置资源
 */
export function resolveBundledGatewayCwd(): string {
  const userCwd = join(CLICKCLAW_GATEWAY_DIR, 'node_modules', 'openclaw')
  if (existsSync(userCwd)) return userCwd
  const resources = resolveResourcesPath()
  return join(resources, 'gateway', 'node_modules', 'openclaw')
}

/**
 * 内置 clawhub CLI 入口文件
 * 安装于 gateway/node_modules/clawhub/bin/clawdhub.js
 */
export function resolveBundledClawhubEntry(): string {
  const resources = resolveResourcesPath()
  return join(resources, 'gateway', 'node_modules', 'clawhub', 'bin', 'clawdhub.js')
}
