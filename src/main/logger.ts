/**
 * 全局日志管理器
 * 基于 electron-log，自动写入文件 + 控制台输出
 *
 * 日志文件位置：~/.clickclaw/logs/clickclaw.log（全平台统一）
 */

import log from 'electron-log'
import { resolveLogPath } from './constants'

// 日志文件路径（跟随平台标准）
log.transports.file.resolvePathFn = () => resolveLogPath()
log.transports.file.maxSize = 5 * 1024 * 1024 // 5MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

// 控制台输出
log.transports.console.format = '[{h}:{i}:{s}] [{level}] {text}'

// 命名空间日志
export function createLogger(namespace: string) {
  return {
    info: (...args: unknown[]) => log.info(`[${namespace}]`, ...args),
    warn: (...args: unknown[]) => log.warn(`[${namespace}]`, ...args),
    error: (...args: unknown[]) => log.error(`[${namespace}]`, ...args),
    debug: (...args: unknown[]) => log.debug(`[${namespace}]`, ...args),
    verbose: (...args: unknown[]) => log.verbose(`[${namespace}]`, ...args),
  }
}

export default log
