/**
 * Runtime 抽象层 — bundled-only 运行模式
 */

export type RuntimeMode = 'bundled'

export interface RuntimeInfo {
  mode: RuntimeMode
  nodePath: string
  nodeVersion: string
  openclawVersion: string
  gatewayEntry: string
  gatewayCwd: string
}

export interface OpenclawRuntime {
  /** 当前运行模式 */
  readonly mode: RuntimeMode

  /** Node.js 可执行文件路径 */
  getNodePath(): string

  /** Gateway 入口文件路径 */
  getGatewayEntry(): string

  /** Gateway 工作目录 */
  getGatewayCwd(): string

  /** 启动 Gateway 时需要注入的环境变量 */
  getEnv(): Record<string, string>

  /** 获取 Node.js 版本 */
  getNodeVersion(): Promise<string>

  /** 获取 openclaw 版本 */
  getOpenclawVersion(): Promise<string>

  /** 获取完整运行时信息 */
  getInfo(): Promise<RuntimeInfo>

  /** 验证运行时可用性（路径存在、版本兼容） */
  validate(): Promise<{ valid: boolean; error?: string }>
}

/**
 * 已有配置检测结果
 */
export interface ExistingConfigDetection {
  found: boolean
  valid: boolean
  hasProviders: boolean
  hasChannels: boolean
  agentCount: number
}

/**
 * 已有 Gateway 检测结果
 */
export interface ExistingGatewayDetection {
  running: boolean
  port: number
  pid: number | null
  processName: string | null
}

/**
 * 完整环境检测结果
 */
export interface DetectionResult {
  existingConfig: ExistingConfigDetection
  existingGateway: ExistingGatewayDetection
  bundledOpenclaw: {
    version: string
    nodeVersion: string
  }
}
