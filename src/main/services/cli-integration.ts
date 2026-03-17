/**
 * CLI 集成服务
 *
 * 在系统 PATH 中安装/卸载 `openclaw` 命令行包装器。
 *
 * Windows：
 *   - 在 ~/.clickclaw/bin\ 创建 openclaw.cmd
 *   - 通过 PowerShell [Environment]::SetEnvironmentVariable 写入用户级 PATH
 *
 * macOS / POSIX：
 *   - 在 ~/.clickclaw/bin/ 创建 openclaw (bash 脚本)
 *   - 在 ~/.zprofile 和 ~/.bash_profile 写入 PATH 注入块
 *
 * 迁移说明：
 *   旧版使用 %LOCALAPPDATA%\ClickClaw\bin（Windows）或 ~/.openclaw/bin（macOS），
 *   installCli() 会自动清除旧路径并写入新路径 ~/.clickclaw/bin（两端统一）。
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, chmodSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
import {
  IS_WIN,
  CLICKCLAW_HOME,
  resolveAppDataDir,
  resolveBundledNodeBin,
  resolveBundledGatewayEntry,
  resolveBundledClawhubEntry,
} from '../constants'
import { createLogger } from '../logger'

const log = createLogger('cli')

// ─── 常量 ───

/** 写入 wrapper 文件的标记行，用于安全识别托管文件 */
const CLI_MARKER = 'ClickClaw CLI'

/** POSIX RC 文件注入块起始标记 */
const RC_BLOCK_START = '# >>> clickclaw-cli >>>'
/** POSIX RC 文件注入块结束标记 */
const RC_BLOCK_END = '# <<< clickclaw-cli <<<'

// ─── 路径解析 ───

/**
 * CLI bin 目录（两端统一）
 * - Windows: ~/.clickclaw/bin\
 * - POSIX:   ~/.clickclaw/bin/
 */
function resolveBinDir(): string {
  return join(CLICKCLAW_HOME, 'bin')
}

/**
 * wrapper 文件完整路径
 * - Windows: <binDir>\openclaw.cmd
 * - POSIX:   <binDir>/openclaw
 */
function resolveWrapperPath(): string {
  const binDir = resolveBinDir()
  return IS_WIN ? join(binDir, 'openclaw.cmd') : join(binDir, 'openclaw')
}

/**
 * clawhub wrapper 文件完整路径
 * - Windows: <binDir>\clawhub.cmd
 * - POSIX:   <binDir>/clawhub
 */
function resolveClawhubWrapperPath(): string {
  const binDir = resolveBinDir()
  return IS_WIN ? join(binDir, 'clawhub.cmd') : join(binDir, 'clawhub')
}

// ─── Wrapper 内容生成 ───

function buildWinWrapper(nodeBin: string, gatewayEntry: string): string {
  // Windows 换行符 CRLF
  return [
    '@echo off',
    `REM ${CLI_MARKER} - auto-generated, do not edit`,
    'setlocal',
    `set "APP_NODE=${nodeBin}"`,
    `set "APP_ENTRY=${gatewayEntry}"`,
    'if not exist "%APP_NODE%" (',
    '  echo Error: ClickClaw Node runtime not found: %APP_NODE% 1>&2',
    '  exit /b 127',
    ')',
    'if not exist "%APP_ENTRY%" (',
    '  echo Error: ClickClaw gateway entry not found: %APP_ENTRY% 1>&2',
    '  exit /b 127',
    ')',
    'set "ELECTRON_RUN_AS_NODE=1"',
    'set "OPENCLAW_NO_RESPAWN=1"',
    '"%APP_NODE%" "%APP_ENTRY%" %*',
    'exit /b %errorlevel%',
    '',
  ].join('\r\n')
}

function buildPosixWrapper(nodeBin: string, gatewayEntry: string): string {
  return [
    '#!/usr/bin/env bash',
    `# ${CLI_MARKER} - auto-generated, do not edit`,
    `APP_NODE="${nodeBin}"`,
    `APP_ENTRY="${gatewayEntry}"`,
    'if [ ! -f "$APP_NODE" ]; then',
    '  echo "Error: ClickClaw Node runtime not found: $APP_NODE" >&2',
    '  exit 127',
    'fi',
    'if [ ! -f "$APP_ENTRY" ]; then',
    '  echo "Error: ClickClaw gateway entry not found: $APP_ENTRY" >&2',
    '  exit 127',
    'fi',
    'export ELECTRON_RUN_AS_NODE=1',
    'export OPENCLAW_NO_RESPAWN=1',
    'exec "$APP_NODE" "$APP_ENTRY" "$@"',
    '',
  ].join('\n')
}

// ─── Wrapper 文件检查 ───

/** 检查路径是否是 ClickClaw 创建的 wrapper（通过 marker 行识别） */
function isOurWrapper(filePath: string): boolean {
  if (!existsSync(filePath)) return false
  try {
    const content = readFileSync(filePath, 'utf-8')
    return content.includes(CLI_MARKER)
  } catch {
    return false
  }
}

// ─── Windows PATH 管理 ───

/**
 * 执行 PowerShell 脚本（使用 base64 EncodedCommand 避免引号转义问题）
 */
function runPowerShell(script: string): string {
  // PowerShell -EncodedCommand 期望 UTF-16LE 编码的 base64
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** 从用户级 PATH 中移除 binDir */
function winRemoveFromPath(binDir: string): void {
  const script = `
$bin = '${binDir.replace(/'/g, "''")}'
$cur = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($cur -eq $null) { $cur = '' }
$parts = $cur -split ';' | Where-Object { $_ -ne '' -and $_.ToLower() -ne $bin.ToLower() }
[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
`
  runPowerShell(script)
}

/**
 * 一次性完成 PATH 迁移与写入：
 * - 移除旧目录 oldBinDir
 * - 确保新目录 newBinDir 在 PATH 首位
 * - 若结果无变化则跳过写入，减少启动耗时
 */
function winSyncPath(newBinDir: string, oldBinDir: string): void {
  const script = `
$newBin = '${newBinDir.replace(/'/g, "''")}'
$oldBin = '${oldBinDir.replace(/'/g, "''")}'
$cur = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($cur -eq $null) { $cur = '' }
$parts = $cur -split ';' | Where-Object { $_ -ne '' }
$lower = $parts | ForEach-Object { $_.ToLower() }
$hasOld = $lower -contains $oldBin.ToLower()
$filtered = $parts | Where-Object {
  $l = $_.ToLower()
  $l -ne $newBin.ToLower() -and $l -ne $oldBin.ToLower()
}
$nextParts = @($newBin) + $filtered
$next = ($nextParts -join ';')
if ($next -ne $cur) {
  [Environment]::SetEnvironmentVariable('Path', $next, 'User')
}
if ($hasOld) { Write-Output 'REMOVED_OLD' } else { Write-Output 'NO_OLD' }
if ($next -ne $cur) { Write-Output 'UPDATED' } else { Write-Output 'UNCHANGED' }
`
  const out = runPowerShell(script)
  if (out.includes('REMOVED_OLD')) {
    log.info(`已清理旧 PATH 条目: ${oldBinDir}`)
  }
}

/** 检查 binDir 是否已在用户级 PATH 中 */
function winIsInPath(binDir: string): boolean {
  try {
    const result = runPowerShell(`[Environment]::GetEnvironmentVariable('Path', 'User')`)
    const parts = result
      .trim()
      .split(';')
      .map((s) => s.trim().toLowerCase())
    return parts.includes(binDir.toLowerCase())
  } catch {
    return false
  }
}

// ─── POSIX RC 文件管理 ───

/** 构建注入到 RC 文件的 PATH 块（可测试，供单元测试直接导入） */
export function posixBuildRcBlock(binDir: string): string {
  return [
    RC_BLOCK_START,
    '# Added by ClickClaw — https://clickclaw.cn',
    `export PATH="${binDir}:$PATH"`,
    RC_BLOCK_END,
  ].join('\n')
}

/** 幂等地将 PATH 注入块写入 RC 文件（若已存在则先删除再重写） */
function posixInjectRcFile(rcPath: string, binDir: string): void {
  let content = existsSync(rcPath) ? readFileSync(rcPath, 'utf-8') : ''

  // 删除已有块（幂等）
  content = posixStripRcBlock(content)

  // 追加新块
  const block = posixBuildRcBlock(binDir)
  content = content.trimEnd() + '\n\n' + block + '\n'
  writeFileSync(rcPath, content, 'utf-8')
}

/** 从 RC 文件内容中删除 ClickClaw 注入块，返回修改后的内容（可测试，供单元测试直接导入） */
export function posixStripRcBlock(content: string): string {
  const startIdx = content.indexOf(RC_BLOCK_START)
  const endIdx = content.indexOf(RC_BLOCK_END)
  if (startIdx === -1 || endIdx === -1) return content

  const after = content.slice(endIdx + RC_BLOCK_END.length)
  const before = content.slice(0, startIdx)
  // 去掉 before 末尾多余空行，保持文件整洁
  return before.trimEnd() + (after.startsWith('\n') ? after : '\n' + after)
}

/** 从 RC 文件中移除 ClickClaw 注入块 */
function posixRemoveRcFile(rcPath: string): void {
  if (!existsSync(rcPath)) return
  try {
    const original = readFileSync(rcPath, 'utf-8')
    const stripped = posixStripRcBlock(original)
    if (stripped !== original) {
      writeFileSync(rcPath, stripped.trimEnd() + '\n', 'utf-8')
    }
  } catch (err) {
    log.warn(`移除 RC 块失败 ${rcPath}:`, err)
  }
}

/** 检查是否有任意 RC 文件包含 ClickClaw 注入块 */
function posixIsInAnyRc(): boolean {
  const rcFiles = [
    join(homedir(), '.zprofile'),
    join(homedir(), '.bash_profile'),
    join(homedir(), '.profile'),
  ]
  return rcFiles.some((rc) => {
    if (!existsSync(rc)) return false
    try {
      return readFileSync(rc, 'utf-8').includes(RC_BLOCK_START)
    } catch {
      return false
    }
  })
}

// ─── 公开 API ───

export interface CliStatus {
  /** CLI 是否完整安装（wrapper 文件存在 + 已加入 PATH） */
  installed: boolean
  /** openclaw wrapper 文件路径 */
  wrapperPath: string
  /** openclaw wrapper 文件是否存在（且是 ClickClaw 创建的） */
  wrapperExists: boolean
  /** clawhub wrapper 文件路径 */
  clawhubWrapperPath: string
  /** clawhub wrapper 文件是否存在（且是 ClickClaw 创建的） */
  clawhubWrapperExists: boolean
  /** bin 目录是否已在 PATH 中 */
  inPath: boolean
}

/**
 * 获取 CLI 安装状态
 */
export function getCliStatus(): CliStatus {
  const wrapperPath = resolveWrapperPath()
  const clawhubWrapperPath = resolveClawhubWrapperPath()
  const wrapperExists = isOurWrapper(wrapperPath)
  const clawhubWrapperExists = isOurWrapper(clawhubWrapperPath)
  const inPath = IS_WIN ? winIsInPath(resolveBinDir()) : posixIsInAnyRc()

  return {
    installed: wrapperExists && clawhubWrapperExists && inPath,
    wrapperPath,
    wrapperExists,
    clawhubWrapperPath,
    clawhubWrapperExists,
    inPath,
  }
}

/**
 * 安装 CLI wrapper 到系统 PATH
 *
 * 同时安装 openclaw 和 clawhub 两个 wrapper，共用同一个 binDir。
 * 幂等操作：可重复调用，不会产生副作用。
 * 若 app 路径变更（如用户移动了应用），可重新调用以更新 wrapper 内容。
 */
export function installCli(): void {
  const binDir = resolveBinDir()
  const wrapperPath = resolveWrapperPath()
  const clawhubWrapperPath = resolveClawhubWrapperPath()
  const nodeBin = resolveBundledNodeBin()
  const gatewayEntry = resolveBundledGatewayEntry()
  const clawhubEntry = resolveBundledClawhubEntry()

  log.info(`安装 CLI wrapper`)
  log.info(`  bin 目录:       ${binDir}`)
  log.info(`  openclaw:       ${wrapperPath}`)
  log.info(`  clawhub:        ${clawhubWrapperPath}`)
  log.info(`  Node:           ${nodeBin}`)
  log.info(`  Gateway entry:  ${gatewayEntry}`)
  log.info(`  Clawhub entry:  ${clawhubEntry}`)

  mkdirSync(binDir, { recursive: true })

  if (IS_WIN) {
    writeFileSync(wrapperPath, buildWinWrapper(nodeBin, gatewayEntry), { encoding: 'utf-8' })
    writeFileSync(clawhubWrapperPath, buildWinWrapper(nodeBin, clawhubEntry), { encoding: 'utf-8' })
    // 一次性同步 PATH（迁移旧路径 + 注入新路径），避免多次 PowerShell 调用
    const oldBinDir = join(resolveAppDataDir(), 'bin')
    winSyncPath(binDir, oldBinDir)
  } else {
    writeFileSync(wrapperPath, buildPosixWrapper(nodeBin, gatewayEntry), { encoding: 'utf-8' })
    chmodSync(wrapperPath, 0o755)
    writeFileSync(clawhubWrapperPath, buildPosixWrapper(nodeBin, clawhubEntry), {
      encoding: 'utf-8',
    })
    chmodSync(clawhubWrapperPath, 0o755)
    posixInjectRcFile(join(homedir(), '.zprofile'), binDir)
    posixInjectRcFile(join(homedir(), '.bash_profile'), binDir)
  }

  log.info('CLI wrapper 安装完成')
}

/**
 * 卸载 CLI wrapper，从 PATH 中移除
 *
 * 安全操作：只删除 ClickClaw 自身创建的 wrapper 文件（通过 marker 识别）。
 */
export function uninstallCli(): void {
  const wrapperPath = resolveWrapperPath()
  const clawhubWrapperPath = resolveClawhubWrapperPath()
  const binDir = resolveBinDir()

  log.info(`卸载 CLI wrapper: ${wrapperPath}`)

  // 仅删除 ClickClaw 创建的 wrapper（防止误删用户自定义文件）
  for (const wp of [wrapperPath, clawhubWrapperPath]) {
    if (isOurWrapper(wp)) {
      try {
        unlinkSync(wp)
        log.info(`wrapper 文件已删除: ${wp}`)
      } catch (err) {
        log.warn(`删除 wrapper 文件失败: ${wp}`, err)
      }
    } else if (existsSync(wp)) {
      log.warn(`wrapper 文件不是 ClickClaw 创建的，跳过删除: ${wp}`)
    }
  }

  if (IS_WIN) {
    winRemoveFromPath(binDir)
  } else {
    posixRemoveRcFile(join(homedir(), '.zprofile'))
    posixRemoveRcFile(join(homedir(), '.bash_profile'))
    posixRemoveRcFile(join(homedir(), '.profile'))
  }

  log.info('CLI wrapper 卸载完成')
}
