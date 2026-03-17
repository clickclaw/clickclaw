/**
 * 共享类型定义 — renderer 和 main 进程共用
 */

export type RuntimeMode = 'bundled'
export type GatewayStatus = 'stopped' | 'starting' | 'running' | 'stopping'

/** 传递给 renderer 的检测结果摘要 */
export interface DetectionSummary {
  // 已有配置
  configFound: boolean
  configValid: boolean

  // 已有 Gateway
  gatewayRunning: boolean
  gatewayPort: number

  // 内置版本
  bundledVersion: string
}
