/**
 * .env 文件管理 — 读写 ~/.openclaw/.env
 *
 * OpenClaw 支持通过 .env 存放敏感凭证（API Key、Bot Token 等）
 * 这些值会被 Gateway 启动时自动加载为环境变量
 *
 * 格式：KEY=VALUE（每行一个，支持 # 注释，支持引号包裹值）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { ENV_PATH, OPENCLAW_HOME } from '../constants'
import { createLogger } from '../logger'

const log = createLogger('env-file')

// ========== 类型定义 ==========

export type EnvEntries = Record<string, string>

// ========== 常见环境变量名 ==========

/** OpenClaw 支持的 .env 变量名映射 */
export const ENV_KEYS = {
  // Provider API Keys
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  GOOGLE_API_KEY: 'GOOGLE_API_KEY',
  MOONSHOT_API_KEY: 'MOONSHOT_API_KEY',
  MINIMAX_API_KEY: 'MINIMAX_API_KEY',
  ZAI_API_KEY: 'ZAI_API_KEY',
  VOLCENGINE_API_KEY: 'VOLCENGINE_API_KEY',
  DASHSCOPE_API_KEY: 'DASHSCOPE_API_KEY',

  // Channel Tokens
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  DISCORD_BOT_TOKEN: 'DISCORD_BOT_TOKEN',
  SLACK_BOT_TOKEN: 'SLACK_BOT_TOKEN',
  SLACK_APP_TOKEN: 'SLACK_APP_TOKEN',

  // Gateway
  OPENCLAW_GATEWAY_TOKEN: 'OPENCLAW_GATEWAY_TOKEN',
} as const

// ========== 读取 ==========

/**
 * 读取 .env 文件，返回键值对
 */
export function readEnv(): EnvEntries {
  if (!existsSync(ENV_PATH)) {
    log.debug('.env file not found')
    return {}
  }

  try {
    const raw = readFileSync(ENV_PATH, 'utf-8')
    return parseEnv(raw)
  } catch (err) {
    log.error('failed to read .env:', err)
    return {}
  }
}

/**
 * 获取指定环境变量的值
 */
export function getEnvValue(key: string): string | undefined {
  const env = readEnv()
  return env[key]
}

// ========== 写入 ==========

/**
 * 设置一个或多个环境变量（保留已有变量和注释）
 */
export function setEnvValues(entries: EnvEntries): void {
  // 确保目录存在
  if (!existsSync(OPENCLAW_HOME)) {
    mkdirSync(OPENCLAW_HOME, { recursive: true })
  }

  if (!existsSync(ENV_PATH)) {
    // 创建新文件
    const lines = Object.entries(entries).map(([k, v]) => `${k}=${quoteValue(v)}`)
    writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8')
    log.info(`.env created with ${Object.keys(entries).length} entries`)
    return
  }

  // 读取现有内容，原地更新
  const raw = readFileSync(ENV_PATH, 'utf-8')
  const lines = raw.split('\n')
  const remaining = { ...entries }

  // 更新已有行
  const updatedLines = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return line

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) return line

    const key = trimmed.substring(0, eqIdx).trim()
    if (key in remaining) {
      const newVal = remaining[key]
      delete remaining[key]
      return `${key}=${quoteValue(newVal)}`
    }

    return line
  })

  // 追加新变量
  for (const [key, value] of Object.entries(remaining)) {
    updatedLines.push(`${key}=${quoteValue(value)}`)
  }

  // 确保末尾换行
  let content = updatedLines.join('\n')
  if (!content.endsWith('\n')) content += '\n'

  writeFileSync(ENV_PATH, content, 'utf-8')
  log.info(`.env updated: ${Object.keys(entries).length} entries`)
}

/**
 * 删除指定环境变量
 */
export function deleteEnvValue(key: string): void {
  if (!existsSync(ENV_PATH)) return

  const raw = readFileSync(ENV_PATH, 'utf-8')
  const lines = raw.split('\n')

  const filtered = lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return true
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) return true
    return trimmed.substring(0, eqIdx).trim() !== key
  })

  writeFileSync(ENV_PATH, filtered.join('\n'), 'utf-8')
  log.info(`.env: removed "${key}"`)
}

// ========== 解析工具 ==========

/**
 * 解析 .env 格式文本（可测试，供单元测试直接导入）
 */
export function parseEnv(raw: string): EnvEntries {
  const result: EnvEntries = {}

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    // 跳过空行和注释
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue

    const key = trimmed.substring(0, eqIdx).trim()
    let value = trimmed.substring(eqIdx + 1).trim()

    // 去除包裹引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key) {
      result[key] = value
    }
  }

  return result
}

/**
 * 如果值包含空格或特殊字符，用双引号包裹（可测试，供单元测试直接导入）
 */
export function quoteValue(value: string): string {
  if (/[\s#"'\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return value
}
