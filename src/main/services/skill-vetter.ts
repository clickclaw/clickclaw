/**
 * Skill 安全审查服务（Skill Vetter）
 *
 * 在安装来自市场的 Skill 前，通过 AI 分析 ZIP 包内容，检测潜在安全风险。
 * 支持 Anthropic Messages API 和 OpenAI Chat Completions API（流式输出）。
 */

import AdmZip from 'adm-zip'
import { createLogger } from '../logger'
import { proxyFetch } from '../utils/proxy'
import { readConfig } from '../config/manager'
import { getEnvValue } from '../config/env-file'
import { getSkillVetterSettings, getVetCache, setVetCache } from '../config/app-cache'
import type { VetResult } from '../config/app-cache'

const log = createLogger('skill-vetter')

// ========== 常量 ==========

/** 支持提取的文本文件扩展名 */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.sh',
  '.py',
  '.js',
  '.ts',
  '.json',
  '.yaml',
  '.yml',
])

/** 单文件内容最大字符数（避免 prompt 过长） */
const MAX_FILE_CHARS = 8000

/** 所有文件总字符数上限 */
const MAX_TOTAL_CHARS = 40000

/** LLM 调用超时（毫秒），流式场景延长至 120s */
const LLM_TIMEOUT_MS = 120000

// ========== 类型 ==========

/** 审查进度回调类型 */
export type VetProgressCallback = (
  stage: 'parsing' | 'analyzing' | 'done',
  message?: string,
  chunk?: string
) => void

/** 审查选项 */
export interface VetOptions {
  onProgress?: VetProgressCallback
  /** 外部传入的 AbortSignal（用于取消） */
  signal?: AbortSignal
  /** UI 当前语言，用于生成本地化的风险说明 */
  locale?: string
}

// ========== 工具函数（导出供单测使用） ==========

/**
 * 从 ZIP buffer 提取文本文件内容
 * 只提取文本文件（.md/.txt/.sh/.py/.js/.ts/.json/.yaml/.yml），
 * 单文件最多 8000 字符，总字符数不超过 40000。
 */
export function extractSkillTexts(zipBuffer: Buffer): { name: string; content: string }[] {
  const zip = new AdmZip(zipBuffer)
  const entries = zip.getEntries()
  const results: { name: string; content: string }[] = []
  let totalChars = 0

  for (const entry of entries) {
    if (entry.isDirectory) continue

    const name = entry.entryName
    const lastDot = name.lastIndexOf('.')
    const ext = lastDot !== -1 ? name.slice(lastDot).toLowerCase() : ''

    if (!TEXT_EXTENSIONS.has(ext)) continue

    const content = entry.getData().toString('utf-8').slice(0, MAX_FILE_CHARS)
    totalChars += content.length
    results.push({ name, content })

    if (totalChars >= MAX_TOTAL_CHARS) break
  }

  return results
}

/**
 * 构建安全审查 Prompt
 */
export function buildVetPrompt(
  files: { name: string; content: string }[],
  slug: string,
  locale = 'en'
): string {
  const fileContents = files.map((f) => `=== ${f.name} ===\n${f.content}`).join('\n\n')
  const language = locale.toLowerCase().startsWith('zh') ? 'Simplified Chinese' : 'English'

  return `You are a security analyst reviewing an AI agent skill package named "${slug}".

Analyze the following files for security risks:

${fileContents}

Return ONLY a JSON object. Do not use markdown fences. Do not add explanatory text before or after JSON.

Use this exact schema:
{
  "riskLevel": "low" | "medium" | "high" | "extreme",
  "verdict": "safe" | "caution" | "unsafe",
  "redFlags": ["..."],
  "permissions": {
    "files": ["..."],
    "network": ["..."],
    "commands": ["..."]
  },
  "notes": "..."
}

Requirements:
- Write all human-readable strings in ${language}.
- If there are no red flags, return "redFlags": [].
- If a permissions category is not needed, return an empty array.
- "notes" should be 1-2 concise sentences.
- Base your answer only on the provided files. Do not invent source reputation, downloads, authors, or update times.

Focus on:
- Suspicious shell commands or system calls
- Network requests to unknown or suspicious endpoints
- File system access outside expected scope
- Data exfiltration patterns
- Obfuscated or encoded content
- Privilege escalation attempts`
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function tryParseJsonResponse(raw: string): Omit<VetResult, 'slug' | 'version' | 'vetAt'> | null {
  const cleaned = stripMarkdownFences(raw)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      riskLevel?: string
      verdict?: string
      redFlags?: unknown
      permissions?: { files?: unknown; network?: unknown; commands?: unknown }
      notes?: unknown
    }

    const riskLevel = normalizeRiskLevel(parsed.riskLevel)
    const verdict = normalizeVerdict(parsed.verdict)
    const redFlags = normalizeStringArray(parsed.redFlags)
    const permissions = parsed.permissions ?? {}

    return {
      riskLevel,
      verdict,
      redFlags,
      permissions: {
        files: normalizeStringArray(permissions.files),
        network: normalizeStringArray(permissions.network),
        commands: normalizeStringArray(permissions.commands),
      },
      notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : '',
      rawReport: raw,
    }
  } catch {
    return null
  }
}

function normalizeRiskLevel(value: string | undefined): VetResult['riskLevel'] {
  const normalized = value?.trim().toLowerCase()
  if (
    normalized === 'low' ||
    normalized === 'medium' ||
    normalized === 'high' ||
    normalized === 'extreme'
  ) {
    return normalized
  }
  return 'medium'
}

function normalizeVerdict(value: string | undefined): VetResult['verdict'] {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'safe' || normalized === 'caution' || normalized === 'unsafe') {
    return normalized
  }
  return 'caution'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(
      (item) => item && !['none', '无', '没有', '未发现明显风险'].includes(item.toLowerCase())
    )
}

/**
 * 解析 AI 回复，提取结构化风险报告
 */
export function parseVetResponse(raw: string, slug: string, version: string): VetResult {
  const jsonResult = tryParseJsonResponse(raw)
  if (jsonResult) {
    return {
      slug,
      version,
      ...jsonResult,
      vetAt: Date.now(),
    }
  }

  const riskMatch = raw.match(/RISK\s+LEVEL:\s*(low|medium|high|extreme)/i)
  const verdictMatch = raw.match(/VERDICT:\s*(safe|caution|unsafe)/i)

  const riskLevel = normalizeRiskLevel(riskMatch?.[1])
  const verdict = normalizeVerdict(verdictMatch?.[1])

  // 解析 RED FLAGS 列表（从 "RED FLAGS:" 到下一个大写段落标题）
  const redFlagsMatch = raw.match(/RED\s+FLAGS:\n([\s\S]*?)(?=\nPERMISSIONS:|$)/i)
  const redFlagsRaw = redFlagsMatch?.[1] ?? ''
  const redFlags = redFlagsRaw
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter((l) => l && !['none', '无', '没有', '未发现明显风险'].includes(l.toLowerCase()))

  // 解析权限字段
  const filesMatch = raw.match(/^files:\s*(.+)$/im)
  const networkMatch = raw.match(/^network:\s*(.+)$/im)
  const commandsMatch = raw.match(/^commands:\s*(.+)$/im)

  const parsePermList = (val: string | undefined): string[] => {
    if (!val || ['none', '无', '没有'].includes(val.trim().toLowerCase())) return []
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // 解析 NOTES
  const notesMatch = raw.match(/^NOTES:\s*(.+(?:\n(?![A-Z\s]+:).+)*)/im)
  const notes = notesMatch?.[1]?.trim() ?? ''

  return {
    slug,
    version,
    riskLevel,
    verdict,
    redFlags,
    permissions: {
      files: parsePermList(filesMatch?.[1]),
      network: parsePermList(networkMatch?.[1]),
      commands: parsePermList(commandsMatch?.[1]),
    },
    notes,
    rawReport: raw,
    vetAt: Date.now(),
  }
}

// ========== 主入口 ==========

/**
 * 执行 Skill 安全审查
 *
 * 优先读取内存+文件缓存，命中则直接返回；否则调用 LLM 分析并缓存结果。
 * 支持流式输出和进度回调。
 */
export async function vetSkill(
  slug: string,
  version: string,
  zipBuffer: Buffer,
  options?: VetOptions
): Promise<VetResult> {
  const { onProgress, signal: externalSignal, locale = 'en' } = options ?? {}

  // 检查持久化缓存
  const cached = getVetCache(slug, version)
  if (cached) {
    log.info(`vet cache hit: ${slug}@${version}`)
    onProgress?.('done', 'cache hit')
    return cached
  }

  // 确定使用的模型
  const settings = getSkillVetterSettings()
  const config = readConfig() as {
    agents?: { defaults?: { model?: string | { primary: string } } }
    models?: {
      providers?: Record<
        string,
        { api?: string; baseUrl?: string; apiKey?: string; models?: Array<{ id: string }> }
      >
    }
  }

  let modelString: string | null = null
  if (settings.customModel) {
    modelString = settings.customModel
  } else {
    const defaultModel = config.agents?.defaults?.model
    if (typeof defaultModel === 'string') {
      modelString = defaultModel
    } else if (defaultModel && typeof defaultModel === 'object' && 'primary' in defaultModel) {
      modelString = (defaultModel as { primary: string }).primary
    }
  }

  if (!modelString) {
    throw new Error('no-model-configured')
  }

  const slashIdx = modelString.indexOf('/')
  if (slashIdx === -1) {
    throw new Error(`模型格式错误 "${modelString}"，期望 "provider/modelId" 格式`)
  }

  const providerKey = modelString.slice(0, slashIdx)
  const modelId = modelString.slice(slashIdx + 1)

  // 读取 provider 配置
  const providers = config.models?.providers ?? {}
  const providerCfg = providers[providerKey]

  if (!providerCfg) {
    throw new Error(`Provider "${providerKey}" 未在配置中找到`)
  }

  const apiType = providerCfg.api ?? 'openai-completions'
  const baseUrl = providerCfg.baseUrl ?? ''

  // 读取 API Key：优先从 openclaw.json 的 provider 配置中读取（最常见），回退到 .env
  const apiKey =
    (providerCfg.apiKey as string | undefined) ?? getEnvValue(resolveEnvKey(providerKey)) ?? ''

  if (!apiKey) {
    throw new Error(
      `Provider "${providerKey}" 的 API Key 未配置（既不在 openclaw.json 也不在 .env）`
    )
  }

  // 提取 ZIP 文本内容
  onProgress?.('parsing', 'Extracting files...')
  const files = extractSkillTexts(zipBuffer)

  if (files.length === 0) {
    // 无文本文件，返回低风险结果
    const result: VetResult = {
      slug,
      version,
      riskLevel: 'low',
      verdict: 'safe',
      redFlags: [],
      permissions: { files: [], network: [], commands: [] },
      notes: '未发现文本文件，无法进行深度分析。',
      rawReport: '',
      vetAt: Date.now(),
    }
    setVetCache(slug, version, result)
    onProgress?.('done')
    return result
  }

  onProgress?.('parsing', `Found ${files.length} files`)

  // 构建 prompt 并调用 LLM（流式）
  const prompt = buildVetPrompt(files, slug, locale)
  log.info(`vetting ${slug}@${version} with ${providerKey}/${modelId} (${files.length} files)`)

  onProgress?.('analyzing', 'Calling AI...')

  // 使用外部信号或内部超时
  let internalController: AbortController | null = null
  let internalTimer: ReturnType<typeof setTimeout> | null = null
  let signal: AbortSignal

  if (externalSignal) {
    signal = externalSignal
  } else {
    internalController = new AbortController()
    internalTimer = setTimeout(() => internalController!.abort(), LLM_TIMEOUT_MS)
    signal = internalController.signal
  }

  try {
    const raw = await callLlmStream(apiType, baseUrl, apiKey, modelId, prompt, signal, (chunk) => {
      onProgress?.('analyzing', undefined, chunk)
    })
    const result = parseVetResponse(raw, slug, version)

    log.info(
      `vet result for ${slug}@${version}: riskLevel=${result.riskLevel}, verdict=${result.verdict}`
    )

    // 写入持久化缓存
    setVetCache(slug, version, result)
    onProgress?.('done')

    return result
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('LLM 请求超时或被取消（120s）')
    }
    throw err
  } finally {
    if (internalTimer !== null) clearTimeout(internalTimer)
  }
}

// ========== 内部工具 ==========

/**
 * 根据 provider key 推断 .env 中的 API Key 变量名
 */
function resolveEnvKey(providerKey: string): string {
  const knownKeys: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
    'moonshot-cn': 'MOONSHOT_API_KEY',
    minimax: 'MINIMAX_API_KEY',
    dashscope: 'DASHSCOPE_API_KEY',
    volcengine: 'VOLCENGINE_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    groq: 'GROQ_API_KEY',
    zai: 'ZAI_API_KEY',
  }
  return knownKeys[providerKey] ?? `${providerKey.toUpperCase().replace(/-/g, '_')}_API_KEY`
}

/**
 * 解析 SSE 流并收集完整文本，同时逐块回调
 */
async function parseSSEStream(
  res: Response,
  isAnthropic: boolean,
  onChunk: (text: string) => void
): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const json = JSON.parse(data)
          let chunk = ''
          if (isAnthropic) {
            if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
              chunk = json.delta.text ?? ''
            }
          } else {
            chunk = json.choices?.[0]?.delta?.content ?? ''
          }
          if (chunk) {
            fullText += chunk
            onChunk(chunk)
          }
        } catch {
          // 忽略 JSON 解析错误
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return fullText
}

/**
 * 调用 LLM API（流式），返回 AI 完整回复文本
 */
async function callLlmStream(
  apiType: string,
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void
): Promise<string> {
  if (apiType === 'anthropic-messages') {
    return await callAnthropicStream(baseUrl, apiKey, modelId, prompt, signal, onChunk)
  } else {
    return await callOpenAIStream(baseUrl, apiKey, modelId, prompt, signal, onChunk)
  }
}

async function callAnthropicStream(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void
): Promise<string> {
  const url = `${baseUrl}/v1/messages`
  const res = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic API 错误 ${res.status}: ${text.slice(0, 200)}`)
  }

  return parseSSEStream(res, true, onChunk)
}

async function callOpenAIStream(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  prompt: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void
): Promise<string> {
  // baseUrl 通常已包含 /v1（如 https://api.openai.com/v1），直接拼接 /chat/completions
  const url = `${baseUrl}/chat/completions`
  const res = await proxyFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenAI API 错误 ${res.status}: ${text.slice(0, 200)}`)
  }

  return parseSSEStream(res, false, onChunk)
}
