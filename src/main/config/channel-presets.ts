/**
 * 渠道预设数据 + 凭证验证
 *
 * 数据结构：Channel Key → ChannelPreset
 *
 * 设计原则（同 provider-presets.ts）：
 * - 新增渠道只改 channel-presets.data.ts，无需改此文件或 UI 代码
 * - buildChannelConfig：合并表单值到现有配置，保留用户手动配置的高级字段
 * - extractChannelConfig：从 openclaw.json 读取并规范化，供 UI 回显
 * - verifyChannel：在主进程发起 HTTP 请求验证凭证（绕开 CORS）
 */

import { createLogger } from '../logger'
import { proxyFetch } from '../utils/proxy'
import { CHANNEL_PRESETS_DATA } from './channel-presets.data'

const log = createLogger('channel')

// ========== 类型定义 ==========

export type DmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled'
export type GroupPolicy = 'allowlist' | 'open' | 'disabled'

/** 渠道凭证/设置字段定义 */
export interface ChannelFieldDef {
  /** 字段 key，对应 openclaw.json channels.<key>.<fieldKey> */
  key: string
  /** UI 显示标签 */
  label: string
  /** 输入类型 */
  type: 'text' | 'password' | 'select'
  /** 是否必填 */
  required: boolean
  /** 占位符 */
  placeholder?: string
  /** select 选项（仅 type='select' 时有效） */
  options?: Array<{ label: string; value: string }>
  /** 获取凭证的网页地址 */
  apiKeyUrl?: string
  /** 帮助文字（显示在字段下方） */
  helpText?: string
}

/** 渠道预设定义（不含 key，key 为 Record 的键名） */
export interface ChannelPreset {
  /** 显示名称，如 "飞书" */
  name: string
  /** 分组 */
  group: 'domestic' | 'international'
  /** 品牌色（十六进制） */
  color: string
  /** 2 字母缩写，Monogram 头像文字 */
  initials: string
  /** 品牌简短描述 */
  tagline?: string
  /** 官方文档地址 */
  docsUrl?: string
  /** 凭证字段列表（不含通用的 dmPolicy/allowFrom 等） */
  fields: ChannelFieldDef[]
  /** 该渠道支持的 DM 策略选项 */
  dmPolicies: DmPolicy[]
  /** 是否支持群组 */
  supportsGroup: boolean
  /** 该渠道支持的群组策略选项（supportsGroup=true 时有效） */
  groupPolicies: GroupPolicy[]
}

/** 传给渲染进程的序列化格式（包含 key） */
export interface ChannelPresetForUI extends ChannelPreset {
  key: string
}

/** 单个渠道的运行时配置（存储在 openclaw.json channels.<key>） */
export interface ChannelConfig {
  enabled: boolean
  dmPolicy?: DmPolicy
  allowFrom?: string[]
  groupPolicy?: GroupPolicy
  groupAllowFrom?: string[]
  [key: string]: unknown
}

/** 渠道配置列表项（key + config） */
export interface ChannelEntry {
  key: string
  config: ChannelConfig
}

/** 凭证验证结果 */
export interface ChannelVerifyResult {
  success: boolean
  message?: string
}

// ========== 预设查询 ==========

export { CHANNEL_PRESETS_DATA as CHANNEL_PRESETS }

const HIDDEN_CHANNEL_KEYS = new Set(['whatsapp'])

/**
 * 获取所有预设列表（含 key）
 */
export function getAllChannelPresets(): ChannelPresetForUI[] {
  return Object.entries(CHANNEL_PRESETS_DATA)
    .filter(([key]) => !HIDDEN_CHANNEL_KEYS.has(key))
    .map(([key, preset]) => ({ key, ...preset }))
}

/**
 * 获取按分组分类的预设
 */
export function getChannelPresetsByGroup(): {
  domestic: ChannelPresetForUI[]
  international: ChannelPresetForUI[]
} {
  const all = getAllChannelPresets()
  return {
    domestic: all.filter((p) => p.group === 'domestic'),
    international: all.filter((p) => p.group === 'international'),
  }
}

/**
 * 获取指定渠道预设
 */
export function getChannelPreset(key: string): ChannelPreset | undefined {
  return CHANNEL_PRESETS_DATA[key]
}

// ========== 配置读取（UI 回显） ==========

/**
 * 从 openclaw.json 读取渠道配置并规范化，供 UI 表单回显。
 * 对缺失字段填充默认值，不修改原始配置。
 */
export function extractChannelConfig(
  raw: Record<string, unknown> | undefined,
  preset: ChannelPreset
): Record<string, unknown> {
  // 构建默认值
  const defaults: Record<string, unknown> = {
    enabled: false,
    dmPolicy: preset.dmPolicies[0] ?? 'pairing',
    allowFrom: [],
    groupPolicy: preset.groupPolicies[0] ?? 'allowlist',
    groupAllowFrom: [],
  }
  for (const field of preset.fields) {
    defaults[field.key] = ''
  }

  if (!raw) return defaults

  return {
    ...defaults,
    enabled: raw.enabled === true,
    dmPolicy: (raw.dmPolicy as DmPolicy | undefined) ?? defaults.dmPolicy,
    allowFrom: Array.isArray(raw.allowFrom) ? (raw.allowFrom as string[]) : [],
    groupPolicy: (raw.groupPolicy as GroupPolicy | undefined) ?? defaults.groupPolicy,
    groupAllowFrom: Array.isArray(raw.groupAllowFrom) ? (raw.groupAllowFrom as string[]) : [],
    // 凭证字段：只取字符串类型（防止奇怪的类型污染）
    ...Object.fromEntries(
      preset.fields.map((f) => [f.key, typeof raw[f.key] === 'string' ? raw[f.key] : ''])
    ),
  }
}

// ========== 配置构建（写入） ==========

/**
 * 将表单值合并成用于写入 openclaw.json 的 ChannelConfig。
 *
 * 关键特性：合并到现有配置（existing），保留用户手动编辑的高级字段。
 * 若表单某字段为空字符串，不覆盖现有非空值（防止意外清空凭证）。
 */
export function buildChannelConfig(
  formValues: Record<string, unknown>,
  existing?: Record<string, unknown>
): ChannelConfig {
  const base: Record<string, unknown> = existing ? { ...existing } : {}

  for (const [key, value] of Object.entries(formValues)) {
    // 空字符串不覆盖已有非空值
    if (typeof value === 'string' && value.trim() === '') {
      if (base[key] !== undefined && base[key] !== '') continue
    }
    base[key] = value
  }

  // 规范化 allowFrom / groupAllowFrom：去空行
  if (Array.isArray(base.allowFrom)) {
    base.allowFrom = (base.allowFrom as string[]).filter(
      (s) => typeof s === 'string' && s.trim() !== ''
    )
  }
  if (Array.isArray(base.groupAllowFrom)) {
    base.groupAllowFrom = (base.groupAllowFrom as string[]).filter(
      (s) => typeof s === 'string' && s.trim() !== ''
    )
  }

  // open dmPolicy 必须包含 "*"（OpenClaw 配置校验要求）
  if (
    base.dmPolicy === 'open' &&
    Array.isArray(base.allowFrom) &&
    !(base.allowFrom as string[]).includes('*')
  ) {
    base.allowFrom = ['*']
  }

  // 确保 enabled 字段存在
  if (base.enabled === undefined) base.enabled = true

  return base as ChannelConfig
}

// ========== 凭证验证 ==========

/**
 * 验证渠道凭证（主进程 HTTP，绕开渲染进程 CORS）
 *
 * @param key     渠道 key（feishu / telegram / discord / ...)
 * @param fields  凭证字段（从表单收集，key 对应 ChannelFieldDef.key）
 */
export async function verifyChannel(
  key: string,
  fields: Record<string, string>
): Promise<ChannelVerifyResult> {
  try {
    switch (key) {
      case 'feishu':
        return await verifyFeishu(fields)
      case 'wecom':
        return await verifyWecom(fields)
      case 'qqbot':
        return await verifyQQBot(fields)
      case 'dingtalk-connector':
        return await verifyDingTalk(fields)
      case 'telegram':
        return await verifyTelegram(fields)
      case 'discord':
        return await verifyDiscord(fields)
      case 'slack':
        return await verifySlack(fields)
      case 'whatsapp':
        return await verifyWhatsApp(fields)
      case 'bluebubbles':
        return await verifyBlueBubbles(fields)
      default:
        return { success: false, message: `未知渠道: ${key}` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.error(`verify channel "${key}" error:`, msg)
    return { success: false, message: `网络错误: ${msg}` }
  }
}

/** 飞书：POST /open-apis/auth/v3/app_access_token/internal */
async function verifyFeishu(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const { appId, appSecret } = fields
  const rawDomain = fields.domain?.trim().toLowerCase()
  const domain = rawDomain === 'lark' ? 'lark' : 'feishu'
  const openApiBase = domain === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn'
  if (!appId?.trim() || !appSecret?.trim()) {
    return { success: false, message: 'App ID 和 App Secret 不能为空' }
  }
  const res = await proxyFetch(`${openApiBase}/open-apis/auth/v3/app_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId.trim(), app_secret: appSecret.trim() }),
    signal: AbortSignal.timeout(15000),
  })
  const data = (await res.json()) as { code: number; msg?: string }
  if (data.code === 0) return { success: true }
  return { success: false, message: `飞书返回 ${data.code}: ${data.msg ?? '凭证无效'}` }
}

/**
 * 企微 AI Bot 使用专有 WebSocket 二进制协议，无简单 HTTP 验证端点。
 * 此处只做非空校验，实际连通性将在 Gateway 启动时验证。
 */
async function verifyWecom(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const { botId, secret } = fields
  if (!botId?.trim() || !secret?.trim()) {
    return { success: false, message: 'Bot ID 和 Secret 不能为空' }
  }
  return {
    success: true,
    message: '凭证格式正确。企微机器人连通性将在 Gateway 启动后自动验证。',
  }
}

/** QQ Bot：POST https://bots.qq.com/oauth2/token（client_credentials） */
async function verifyQQBot(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const { appId, clientSecret } = fields
  if (!appId?.trim() || !clientSecret?.trim()) {
    return { success: false, message: 'App ID 和 Client Secret 不能为空' }
  }
  const res = await proxyFetch('https://bots.qq.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      appId: appId.trim(),
      clientSecret: clientSecret.trim(),
    }).toString(),
    signal: AbortSignal.timeout(15000),
  })
  if (res.ok) return { success: true }
  const text = await res.text().catch(() => '')
  return {
    success: false,
    message: `QQ Bot 返回 HTTP ${res.status}: ${text.slice(0, 120)}`,
  }
}

/**
 * 钉钉连接器凭证主要由本地 connector 消费，MVP 阶段仅做必填校验。
 * 实际连通性与 token 匹配情况将在 Gateway/connector 启动后验证。
 */
async function verifyDingTalk(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const { clientId, clientSecret, gatewayToken } = fields
  if (!clientId?.trim() || !clientSecret?.trim() || !gatewayToken?.trim()) {
    return { success: false, message: 'Client ID、Client Secret 和 Gateway Token 不能为空' }
  }
  return {
    success: true,
    message: '凭证格式正确。钉钉连接器连通性将在 Gateway 启动后自动验证。',
  }
}

/** Telegram：GET /bot{token}/getMe */
async function verifyTelegram(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const { botToken } = fields
  if (!botToken?.trim()) return { success: false, message: 'Bot Token 不能为空' }
  const res = await proxyFetch(
    `https://api.telegram.org/bot${encodeURIComponent(botToken.trim())}/getMe`,
    { signal: AbortSignal.timeout(15000) }
  )
  const data = (await res.json()) as { ok: boolean; description?: string }
  if (data.ok) return { success: true }
  return { success: false, message: data.description ?? 'Token 无效' }
}

/** Discord：GET /api/v10/users/@me（Authorization: Bot {token}） */
async function verifyDiscord(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const { token } = fields
  if (!token?.trim()) return { success: false, message: 'Bot Token 不能为空' }
  const res = await proxyFetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token.trim()}` },
    signal: AbortSignal.timeout(15000),
  })
  if (res.status === 200) return { success: true }
  if (res.status === 401) return { success: false, message: 'Token 无效或已过期' }
  const text = await res.text().catch(() => '')
  return { success: false, message: `Discord 返回 HTTP ${res.status}: ${text.slice(0, 120)}` }
}

/**
 * Slack 预设同时暴露 Socket Mode 与 HTTP Events API 字段。
 * 当前验证按 mode 做最小必填校验，不主动请求 Slack API。
 */
async function verifySlack(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const mode = fields.mode?.trim() || 'socket'
  const botToken = fields.botToken?.trim()
  const appToken = fields.appToken?.trim()
  const signingSecret = fields.signingSecret?.trim()

  if (!botToken) return { success: false, message: 'Bot Token 不能为空' }
  if (mode === 'socket' && !appToken) {
    return { success: false, message: 'Socket Mode 需要填写 App Token' }
  }
  if (mode === 'http' && !signingSecret) {
    return { success: false, message: 'HTTP Events API 模式需要填写 Signing Secret' }
  }
  return {
    success: true,
    message: '凭证格式正确。Slack 连通性将在 Gateway 启动后自动验证。',
  }
}

/**
 * WhatsApp 官方接入通常通过首次扫码建立会话，MVP 阶段无固定凭证字段。
 */
async function verifyWhatsApp(_fields: Record<string, string>): Promise<ChannelVerifyResult> {
  return {
    success: true,
    message: 'WhatsApp 无需预填凭证。保存后按 OpenClaw 流程完成二维码登录即可。',
  }
}

/** BlueBubbles：最小配置为 serverUrl + password，webhookPath 可选。 */
async function verifyBlueBubbles(fields: Record<string, string>): Promise<ChannelVerifyResult> {
  const serverUrl = fields.serverUrl?.trim()
  const password = fields.password?.trim()
  const webhookPath = fields.webhookPath?.trim()
  if (!serverUrl || !password) {
    return { success: false, message: 'Server URL 和 Password 不能为空' }
  }
  try {
    new URL(serverUrl)
  } catch {
    return { success: false, message: 'Server URL 格式无效' }
  }
  return {
    success: true,
    message: webhookPath
      ? '配置已接收。BlueBubbles 连通性和 webhook 注册将在 Gateway 启动后验证。'
      : '将使用默认 webhook 路径。BlueBubbles 连通性将在 Gateway 启动后验证。',
  }
}
