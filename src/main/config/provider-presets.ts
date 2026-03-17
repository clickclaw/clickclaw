/**
 * Provider 预设数据 + API Key 验证
 *
 * 数据结构：Provider → Platform（子平台）→ Models
 *
 * 一个 Provider（如 Moonshot）可以有多个子平台（国内站/国际站/Kimi Coding），
 * 每个子平台有独立的 baseUrl、API 类型和模型列表。
 *
 * 预设数据由项目维护者收集填充，存放在 provider-presets.data.ts 中。
 */

import { createLogger } from '../logger'
import { proxyFetch } from '../utils/proxy'
import { PROVIDER_PRESETS } from './provider-presets.data'
import { getMergedProviderPresets } from '../services/remote-presets'

const log = createLogger('provider')

// ========== 类型定义 ==========

export const API_TYPES = [
  'openai-completions',
  'openai-responses',
  'anthropic-messages',
  'google-generative-ai',
] as const

export type ApiType = (typeof API_TYPES)[number]

/** 模型定义 */
export interface ModelDef {
  /** 模型 ID，如 "claude-sonnet-4-6" */
  id: string
  /** 显示名称 */
  name: string
  /** 支持的输入类型 */
  input: Array<'text' | 'image'>
  /** 可选的上下文窗口大小，单位 token */
  contextWindow?: number
  /** 可选的最大 token 数量 */
  maxTokens?: number
}

/** 子平台定义 */
export interface ProviderPlatform {
  /** 子平台唯一 key，如 "moonshot-cn" */
  key: string
  /** 子平台显示名称，如 "国内站" */
  name: string
  /** API Base URL */
  baseUrl: string
  /** API 协议类型 */
  api: ApiType
  /** 获取 API Key 的网页地址（不同子平台可能不同） */
  apiKeyUrl: string
  /** .env 中存放 API Key 的变量名 */
  envKey: string
  /** 预设模型列表（用户也可自定义输入模型 ID） */
  models: ModelDef[]
}

/** Provider 预设定义 */
export interface ProviderPreset {
  /** 显示名称 */
  name: string
  /** 分组 */
  group: 'international' | 'china'
  /** 推荐排序，值越小越靠前；未设置则不进入推荐组 */
  recommendedRank?: number
  /** 远程品牌图标 URL（标准字段） */
  logoUrl?: string
  /** 兼容旧远程字段，渲染前会归一化到 logoUrl */
  iconUrl?: string
  /** 简短描述（内部用） */
  description?: string
  /**
   * 品牌主色（十六进制），用于 UI Monogram 头像背景
   * 建议取自品牌官方配色
   */
  color: string
  /**
   * 2 字母缩写，Monogram 头像文字
   * 例："AN"(Anthropic)、"MS"(Moonshot)
   */
  initials: string
  /**
   * 品牌简短描述，显示在品牌选择器列表
   * 可包含中英文混排，突出核心亮点
   */
  tagline?: string
  /** 子平台列表（至少一个，第一个为默认平台） */
  platforms: ProviderPlatform[]
}

export interface VerifyResult {
  success: boolean
  message?: string
}

// ========== 预设查询 ==========

export { PROVIDER_PRESETS }

/** 传给渲染进程的序列化格式 */
export interface ProviderPresetForUI {
  key: string
  name: string
  group: 'international' | 'china'
  recommendedRank?: number
  logoUrl?: string
  description?: string
  color: string
  initials: string
  tagline?: string
  platforms: ProviderPlatform[]
}

export interface ProviderPresetSection {
  key: 'recommended' | 'china' | 'international'
  title: string
  description?: string
  items: ProviderPresetForUI[]
}

/**
 * 获取所有预设列表（合并本地内置 + 远程缓存）
 */
export function getAllPresets(): ProviderPresetForUI[] {
  return Object.entries(getMergedProviderPresets()).map(([key, preset]) => ({
    key,
    ...preset,
    logoUrl: preset.logoUrl || preset.iconUrl,
  }))
}

/**
 * 获取按分组分类的预设
 */
export function getPresetsByGroup(): ProviderPresetSection[] {
  const all = getAllPresets()
  const isRecommended = (preset: ProviderPresetForUI): boolean =>
    typeof preset.recommendedRank === 'number'

  const sections: ProviderPresetSection[] = [
    {
      key: 'recommended',
      title: '推荐',
      description: '优先展示，适合大多数用户',
      items: all
        .filter(isRecommended)
        .sort((a, b) => (a.recommendedRank ?? 999) - (b.recommendedRank ?? 999)),
    },
    {
      key: 'china',
      title: '国内',
      description: '连接更稳定，适合国内环境',
      items: all.filter((p) => p.group === 'china' && !isRecommended(p)),
    },
    {
      key: 'international',
      title: '国际',
      description: '适合已持有国际 API Key 的用户',
      items: all.filter((p) => p.group === 'international' && !isRecommended(p)),
    },
  ]

  return sections.filter((section) => section.items.length > 0)
}

/**
 * 获取指定预设（合并后）
 */
export function getPreset(key: string): ProviderPreset | undefined {
  return getMergedProviderPresets()[key]
}

/**
 * 根据 provider key + platform key 获取子平台（合并后）
 */
export function getPlatform(
  providerKey: string,
  platformKey: string
): ProviderPlatform | undefined {
  const preset = getMergedProviderPresets()[providerKey]
  if (!preset) return undefined
  return preset.platforms.find((p) => p.key === platformKey)
}

// ========== 配置构建 ==========

/**
 * 构建写入 openclaw.json 的 Provider 配置
 */
export function buildProviderConfig(params: {
  providerKey: string
  platformKey: string
  apiKey: string
  modelId: string
}): Record<string, unknown> {
  const platform = getPlatform(params.providerKey, params.platformKey)

  if (platform) {
    const presetModel = platform.models.find((m) => m.id === params.modelId)
    return {
      apiKey: params.apiKey,
      baseUrl: platform.baseUrl,
      api: platform.api,
      models: [
        {
          id: params.modelId,
          name: presetModel?.name || params.modelId,
          input: presetModel?.input || ['text'],
          ...(typeof presetModel?.contextWindow === 'number'
            ? { contextWindow: presetModel.contextWindow }
            : {}),
          ...(typeof presetModel?.maxTokens === 'number'
            ? { maxTokens: presetModel.maxTokens }
            : {}),
        },
      ],
    }
  }

  return { apiKey: params.apiKey }
}

/**
 * 构建自定义 Provider 配置
 */
export function buildCustomProviderConfig(params: {
  apiKey: string
  baseUrl: string
  api: ApiType
  modelId: string
  input?: Array<'text' | 'image'>
}): Record<string, unknown> {
  return {
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    api: params.api,
    models: [
      {
        id: params.modelId,
        name: params.modelId,
        input: params.input || ['text'],
      },
    ],
  }
}

/**
 * 直接用配置参数验证（不依赖预设目录，ModelPage 管理场景使用）
 */
export async function verifyProviderConfig(params: {
  baseUrl: string
  api: ApiType
  apiKey: string
  modelId: string
}): Promise<VerifyResult> {
  const { baseUrl, api, apiKey, modelId } = params
  try {
    switch (api) {
      case 'anthropic-messages':
        return await verifyAnthropic(apiKey, baseUrl, modelId)
      case 'google-generative-ai':
        return await verifyGoogle(apiKey, baseUrl, modelId)
      default:
        return await verifyOpenAI(apiKey, baseUrl, modelId)
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  }
}

// ========== API Key 验证 ==========

/**
 * 验证 API Key + 模型可用性
 *
 * 根据子平台的 api 类型自动选择验证方式：
 * - anthropic-messages → POST /v1/messages（用指定 model 发一条最小请求）
 * - google-generative-ai → GET /v1beta/models/{modelId}?key=xxx
 * - openai-* → POST /v1/chat/completions（用指定 model 发一条最小请求）
 */
export async function verifyProvider(
  providerKey: string,
  platformKey: string,
  apiKey: string,
  modelId: string,
  customBaseUrl?: string
): Promise<VerifyResult> {
  try {
    const platform = getPlatform(providerKey, platformKey)
    const baseUrl = customBaseUrl || platform?.baseUrl
    const apiType = platform?.api || 'openai-completions'

    if (!baseUrl) {
      return { success: false, message: 'unknown provider/platform and no baseUrl' }
    }

    switch (apiType) {
      case 'anthropic-messages':
        return await verifyAnthropic(apiKey, baseUrl, modelId)
      case 'google-generative-ai':
        return await verifyGoogle(apiKey, baseUrl, modelId)
      default:
        return await verifyOpenAI(apiKey, baseUrl, modelId)
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 验证 Anthropic API Key + 模型
 */
async function verifyAnthropic(
  apiKey: string,
  baseUrl: string,
  modelId: string
): Promise<VerifyResult> {
  const url = `${baseUrl}/v1/messages`

  return jsonRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  })
}

/**
 * 验证 OpenAI 兼容 API Key + 模型
 */
async function verifyOpenAI(
  apiKey: string,
  baseUrl: string,
  modelId: string
): Promise<VerifyResult> {
  const url = `${baseUrl}/chat/completions`

  return jsonRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    }),
  })
}

/**
 * 验证 Google AI API Key + 模型
 */
async function verifyGoogle(
  apiKey: string,
  baseUrl: string,
  modelId: string
): Promise<VerifyResult> {
  const url = `${baseUrl}/v1beta/models/${encodeURIComponent(modelId)}?key=${encodeURIComponent(apiKey)}`

  return jsonRequest(url, {
    method: 'GET',
    headers: {},
  })
}

// ========== HTTP 工具 ==========

async function jsonRequest(
  url: string,
  opts: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }
): Promise<VerifyResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await proxyFetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body,
      signal: controller.signal,
    })

    if (res.ok) {
      return { success: true }
    } else if (res.status === 401 || res.status === 403) {
      return { success: false, message: 'API Key 无效或权限不足' }
    } else {
      const text = await res.text().catch(() => '')
      return { success: false, message: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, message: '请求超时（15s）' }
    }
    const msg = err instanceof Error ? err.message : String(err)
    log.error('verify request error:', msg)
    return { success: false, message: `网络错误: ${msg}` }
  } finally {
    clearTimeout(timer)
  }
}
