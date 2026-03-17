/**
 * Runtime 管理器 — bundled-only
 */

import type { OpenclawRuntime, DetectionResult, RuntimeMode } from './types'
import { BundledRuntime } from './bundled-runtime'
import { detectEnvironment } from './detector'
import { createLogger } from '../logger'

const log = createLogger('runtime')

let currentRuntime: OpenclawRuntime | null = null
let lastDetection: DetectionResult | null = null

export async function detect(): Promise<DetectionResult> {
  log.info('detect: bundled-only scan')
  lastDetection = await detectEnvironment()
  return lastDetection
}

/**
 * 获取上次检测结果
 */
export function getLastDetection(): DetectionResult | null {
  return lastDetection
}

/**
 * 创建 Runtime 实例
 */
export function selectRuntime(): OpenclawRuntime {
  currentRuntime = new BundledRuntime()
  return currentRuntime
}

/**
 * 获取当前 Runtime 实例
 */
export function getRuntime(): OpenclawRuntime {
  if (!currentRuntime) {
    // 默认使用内置模式
    currentRuntime = new BundledRuntime()
  }
  return currentRuntime
}

/**
 * 获取当前模式
 */
export function getCurrentMode(): RuntimeMode {
  return 'bundled'
}

// 统一导出
export {
  detectEnvironment,
  detectExistingConfig,
  detectExistingGateway,
  getBundledVersions,
} from './detector'
export { BundledRuntime } from './bundled-runtime'
export type { OpenclawRuntime, DetectionResult, RuntimeMode } from './types'
