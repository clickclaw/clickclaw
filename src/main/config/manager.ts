/**
 * 配置管理器 — JSON5 读写 ~/.openclaw/openclaw.json
 *
 * 核心职责：
 * 1. 读取配置文件（JSON5 格式，支持注释和尾逗号）
 * 2. 写入配置文件（写前自动备份）
 * 3. 部分更新（deep merge，不丢失用户手动添加的字段）
 * 4. 配置健康检查（JSON 可解析性验证）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import JSON5 from 'json5'
import { CONFIG_PATH, OPENCLAW_HOME } from '../constants'
import { createLogger } from '../logger'
import { createSnapshot, validateConfigContent } from './backup'
import type { SnapshotSource } from './backup'

const log = createLogger('config')

// ========== 类型定义 ==========

/**
 * ClickClaw 关注的配置子集
 * OpenClaw 配置字段非常多，我们只操作需要的部分，其余透传保留
 */
export interface OpenclawConfig {
  /** 模型/Provider 配置 */
  models?: {
    providers?: Record<string, ProviderConfig>
  }

  /** Agent 配置 */
  agents?: {
    defaults?: {
      model?: string | { primary: string; fallbacks?: string[] }
      models?: Record<string, { alias?: string; params?: Record<string, unknown> }>
      workspace?: string
      [key: string]: unknown
    }
    list?: AgentConfig[]
  }

  /** 渠道配置 */
  channels?: {
    telegram?: Record<string, unknown>
    feishu?: Record<string, unknown>
    discord?: Record<string, unknown>
    bluebubbles?: Record<string, unknown>
    slack?: Record<string, unknown>
    whatsapp?: Record<string, unknown>
    defaults?: Record<string, unknown>
    [key: string]: unknown
  }

  /** 路由绑定 */
  bindings?: Array<{
    agentId: string
    match: Record<string, unknown>
    [key: string]: unknown
  }>

  /** Gateway 配置 */
  gateway?: {
    port?: number
    bind?: string
    mode?: string
    [key: string]: unknown
  }

  /** 命令配置 */
  commands?: Record<string, unknown>

  /** 工具配置 */
  tools?: Record<string, unknown>

  /** 透传字段 */
  [key: string]: unknown
}

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  api?: 'anthropic-messages' | 'openai-completions' | 'openai-responses'
  models?: Array<{
    id: string
    name?: string
    input?: string[]
  }>
  [key: string]: unknown
}

export interface AgentConfig {
  id: string
  default?: boolean
  name?: string
  workspace?: string
  model?: string | { primary: string; fallbacks?: string[] }
  identity?: {
    name?: string
    theme?: string
    emoji?: string
    [key: string]: unknown
  }
  groupChat?: Record<string, unknown>
  sandbox?: Record<string, unknown>
  tools?: Record<string, unknown>
  [key: string]: unknown
}

// ========== 配置健康检查 ==========

export interface ConfigHealth {
  exists: boolean
  parseable: boolean
  error?: string
  raw?: string
}

/**
 * 检查配置文件健康状态（不修改任何文件）
 */
export function inspectConfigHealth(): ConfigHealth {
  if (!existsSync(CONFIG_PATH)) {
    return { exists: false, parseable: false }
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    JSON5.parse(raw)
    return { exists: true, parseable: true, raw }
  } catch (err) {
    return {
      exists: true,
      parseable: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ========== 读取配置 ==========

/**
 * 读取配置文件，返回解析后的对象
 * 文件不存在或解析失败时返回空对象 {}
 */
export function readConfig(): OpenclawConfig {
  if (!existsSync(CONFIG_PATH)) {
    log.debug('config file not found, returning empty config')
    return {}
  }

  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    const config = JSON5.parse(raw) as OpenclawConfig
    log.debug('config loaded successfully')
    return config
  } catch (err) {
    log.error('failed to parse config:', err)
    return {}
  }
}

/**
 * 读取配置文件的原始 JSON5 文本
 * 用于备份和健康检查
 */
export function readConfigRaw(): string | null {
  if (!existsSync(CONFIG_PATH)) return null
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    // 验证可解析性
    JSON5.parse(raw)
    return raw
  } catch {
    return null
  }
}

// ========== 写入配置 ==========

/**
 * 写入完整配置
 * @param config 完整配置对象
 * @param options 快照选项（来源和摘要，用于智能快照）
 */
export function writeConfig(
  config: OpenclawConfig,
  options?: { source?: SnapshotSource; summary?: string; skipSnapshot?: boolean }
): void {
  // 确保目录存在
  if (!existsSync(OPENCLAW_HOME)) {
    mkdirSync(OPENCLAW_HOME, { recursive: true })
  }

  // 写前快照
  if (!options?.skipSnapshot && existsSync(CONFIG_PATH)) {
    try {
      createSnapshot(options?.source || 'auto', options?.summary || '配置更新')
    } catch (err) {
      log.warn('snapshot before write failed:', err)
    }
  }

  // 写前验证
  const content = JSON5.stringify(config, null, 2) + '\n'
  const validation = validateConfigContent(content)
  if (!validation.valid) {
    throw new Error(`config validation failed: ${validation.error}`)
  }

  writeFileSync(CONFIG_PATH, content, 'utf-8')

  // 写后验证（读回检查）
  try {
    const readBack = readFileSync(CONFIG_PATH, 'utf-8')
    JSON5.parse(readBack)
  } catch (err) {
    log.error('post-write validation failed:', err)
    throw new Error('config written but post-write validation failed')
  }

  log.info('config written successfully')
}

// ========== 部分更新 ==========

/**
 * 部分更新配置（deep merge）
 * 只修改指定的字段，保留其余所有字段
 */
export function updateConfig(partial: Partial<OpenclawConfig>): OpenclawConfig {
  const current = readConfig()
  const merged = deepMerge(current, partial) as OpenclawConfig
  writeConfig(merged)
  return merged
}

/**
 * 设置指定路径的配置值
 * 例如：setConfigValue('agents.defaults.model', 'anthropic/claude-opus-4-6')
 */
export function setConfigValue(path: string, value: unknown): void {
  const config = readConfig()
  setNestedValue(config, path, value)
  writeConfig(config)
}

/**
 * 删除指定路径的配置值
 */
export function deleteConfigValue(path: string): void {
  const config = readConfig()
  deleteNestedValue(config, path)
  writeConfig(config)
}

/**
 * 获取指定路径的配置值
 */
export function getConfigValue(path: string): unknown {
  const config = readConfig()
  return getNestedValue(config, path)
}

// ========== Provider 快捷操作 ==========

/**
 * 设置 Provider 配置
 */
export function setProvider(name: string, provider: ProviderConfig): void {
  const config = readConfig()
  if (!config.models) config.models = {}
  if (!config.models.providers) config.models.providers = {}
  config.models.providers[name] = provider
  writeConfig(config, { source: 'provider', summary: `配置 Provider: ${name}` })
  log.info(`provider "${name}" configured`)
}

/**
 * 获取所有已配置的 Provider
 */
export function getProviders(): Record<string, ProviderConfig> {
  const config = readConfig()
  return config.models?.providers || {}
}

/**
 * 删除指定 Provider
 */
export function deleteProvider(name: string): void {
  const config = readConfig()
  if (config.models?.providers) {
    delete config.models.providers[name]
  }
  writeConfig(config, { source: 'provider', summary: `删除 Provider: ${name}` })
  log.info(`provider "${name}" deleted`)
}

// ========== Channel 快捷操作 ==========

/**
 * 设置 Channel 配置
 */
export function setChannel(name: string, channelConfig: Record<string, unknown>): void {
  const config = readConfig()
  if (!config.channels) config.channels = {}
  config.channels[name] = channelConfig
  writeConfig(config, { source: 'channel', summary: `配置渠道: ${name}` })
  log.info(`channel "${name}" configured`)
}

/**
 * 获取指定 Channel 配置
 */
export function getChannel(name: string): Record<string, unknown> | undefined {
  const config = readConfig()
  return config.channels?.[name] as Record<string, unknown> | undefined
}

/**
 * 获取所有 Channel 配置
 */
export function getChannels(): Record<string, Record<string, unknown>> {
  const config = readConfig()
  if (!config.channels) return {}
  // 过滤掉非渠道字段（如 defaults）
  const result: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(config.channels)) {
    if (key === 'whatsapp') continue
    if (key !== 'defaults' && typeof value === 'object' && value !== null) {
      result[key] = value as Record<string, unknown>
    }
  }
  return result
}

/**
 * 删除指定 Channel 配置
 */
export function deleteChannel(name: string): void {
  const config = readConfig()
  if (config.channels) {
    delete config.channels[name]
  }
  writeConfig(config, { source: 'channel', summary: `删除渠道: ${name}` })
  log.info(`channel "${name}" deleted`)
}

/**
 * 保存渠道账户凭证（多账户模式）
 * 写入 channels.<channelKey>.accounts.<accountId>
 * 首个账户自动设为 defaultAccount
 */
export function saveChannelAccount(
  channelKey: string,
  accountId: string,
  accountData: Record<string, unknown>
): void {
  const config = readConfig()
  if (!config.channels) config.channels = {}
  if (!config.channels[channelKey]) config.channels[channelKey] = {}
  const ch = config.channels[channelKey] as Record<string, unknown>
  if (!ch.accounts) ch.accounts = {}
  ;(ch.accounts as Record<string, unknown>)[accountId] = accountData
  // 首个账户自动成为默认账户
  if (!ch.defaultAccount) ch.defaultAccount = accountId
  writeConfig(config, { source: 'channel', summary: `保存渠道账户: ${channelKey}/${accountId}` })
  log.info(`channel account "${channelKey}/${accountId}" saved`)
}

/**
 * 删除渠道账户
 * 若删除的是 defaultAccount，自动切换到第一个剩余账户
 */
export function deleteChannelAccount(channelKey: string, accountId: string): void {
  const config = readConfig()
  const ch = config.channels?.[channelKey] as Record<string, unknown> | undefined
  if (!ch) return
  const accounts = ch.accounts as Record<string, unknown> | undefined
  if (accounts) {
    delete accounts[accountId]
    // 若删除的是默认账户，自动切换
    if (ch.defaultAccount === accountId) {
      const remaining = Object.keys(accounts)
      ch.defaultAccount = remaining.length > 0 ? remaining[0] : undefined
    }
  }
  writeConfig(config, { source: 'channel', summary: `删除渠道账户: ${channelKey}/${accountId}` })
  log.info(`channel account "${channelKey}/${accountId}" deleted`)
}

/**
 * 设置渠道默认账户
 */
export function setChannelDefaultAccount(channelKey: string, accountId: string): void {
  const config = readConfig()
  const ch = config.channels?.[channelKey] as Record<string, unknown> | undefined
  if (!ch) return
  ch.defaultAccount = accountId
  writeConfig(config, { source: 'channel', summary: `设置默认账户: ${channelKey}/${accountId}` })
  log.info(`channel "${channelKey}" default account set to "${accountId}"`)
}

// ========== Agent 快捷操作 ==========

/**
 * 获取 Agent 列表
 */
export function getAgents(): AgentConfig[] {
  const config = readConfig()
  return config.agents?.list || []
}

/**
 * 保存 Agent（新增或更新）
 * - id 存在且匹配已有 Agent → 更新
 * - 否则 → 追加（生成新 id）
 */
export function saveAgent(agent: Omit<AgentConfig, 'id'> & { id?: string }): AgentConfig {
  const config = readConfig()
  if (!config.agents) config.agents = {}
  const list = config.agents.list ?? []

  let saved: AgentConfig
  const existingIdx = agent.id ? list.findIndex((a) => a.id === agent.id) : -1

  if (existingIdx >= 0) {
    // 更新已有
    list[existingIdx] = { ...list[existingIdx], ...agent } as AgentConfig
    saved = list[existingIdx]
  } else {
    // 新增：优先使用传入的 id，无 id 时才生成一个
    const newId = agent.id || `agent-${Date.now()}`
    saved = { ...agent, id: newId } as AgentConfig
    list.push(saved)
  }

  config.agents.list = list
  writeConfig(config, { source: 'agent', summary: `保存 Agent: ${saved.name || saved.id}` })
  return saved
}

/**
 * 删除 Agent
 */
export function deleteAgent(agentId: string): void {
  const config = readConfig()
  if (!config.agents?.list) return
  config.agents.list = config.agents.list.filter((a) => a.id !== agentId)
  writeConfig(config, { source: 'agent', summary: `删除 Agent: ${agentId}` })
}

/**
 * 设置默认 Agent
 * 将指定 Agent 的 default 设为 true，其余设为 false
 */
export function setDefaultAgent(agentId: string): void {
  const config = readConfig()
  if (!config.agents?.list) return
  config.agents.list = config.agents.list.map((a) => ({
    ...a,
    default: a.id === agentId,
  }))
  writeConfig(config, { source: 'agent', summary: `设置默认 Agent: ${agentId}` })
}

// ========== Binding 快捷操作 ==========

export interface BindingConfig {
  agentId: string
  match: { channel: string; accountId?: string; [key: string]: unknown }
  [key: string]: unknown
}

/**
 * 获取所有 binding 配置
 */
export function getBindings(): BindingConfig[] {
  const config = readConfig()
  return (config.bindings as BindingConfig[] | undefined) || []
}

/**
 * 保存或更新 binding（channel + accountId 相同时覆盖）
 */
export function saveBinding(agentId: string, channel: string, accountId: string): void {
  const config = readConfig()
  if (!config.bindings) config.bindings = []

  const bindings = config.bindings as BindingConfig[]
  const idx = bindings.findIndex(
    (b) => b.match?.channel === channel && b.match?.accountId === accountId
  )

  const newBinding: BindingConfig = {
    agentId,
    match: { channel, accountId },
  }

  if (idx >= 0) {
    bindings[idx] = newBinding
  } else {
    bindings.push(newBinding)
  }

  config.bindings = bindings
  writeConfig(config, {
    source: 'auto',
    summary: `设置路由绑定: ${channel}/${accountId} → ${agentId}`,
  })
  log.info(`binding set: ${channel}/${accountId} → ${agentId}`)
}

/**
 * 删除指定 channel + accountId 对应的 binding
 */
export function deleteBinding(channel: string, accountId: string): void {
  const config = readConfig()
  if (!config.bindings) return

  const bindings = config.bindings as BindingConfig[]
  config.bindings = bindings.filter(
    (b) => !(b.match?.channel === channel && b.match?.accountId === accountId)
  )

  writeConfig(config, { source: 'auto', summary: `删除路由绑定: ${channel}/${accountId}` })
  log.info(`binding deleted: ${channel}/${accountId}`)
}

/**
 * 设置默认模型
 */
export function setDefaultModel(model: string): void {
  const config = readConfig()
  if (!config.agents) config.agents = {}
  if (!config.agents.defaults) config.agents.defaults = {}
  config.agents.defaults.model = model
  writeConfig(config, { source: 'agent', summary: `设置默认模型: ${model}` })
  log.info(`default model set to "${model}"`)
}

// ========== 工具函数 ==========

/**
 * 深度合并两个对象（可测试，供单元测试直接导入）
 * - 数组直接替换（不合并）
 * - null/undefined 值会删除目标键
 * - 其余递归合并
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target }

  for (const key of Object.keys(source)) {
    const sourceVal = source[key]
    const targetVal = target[key]

    if (sourceVal === undefined || sourceVal === null) {
      delete result[key]
    } else if (
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal) &&
      targetVal !== null
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      )
    } else {
      result[key] = sourceVal
    }
  }

  return result
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.')
  let current: Record<string, unknown> = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }

  current[keys[keys.length - 1]] = value
}

function deleteNestedValue(obj: Record<string, unknown>, path: string): void {
  const keys = path.split('.')
  let current: Record<string, unknown> = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (typeof current[key] !== 'object' || current[key] === null) return
    current = current[key] as Record<string, unknown>
  }

  delete current[keys[keys.length - 1]]
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }

  return current
}
