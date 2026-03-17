import { createLogger } from '../logger'
import { proxyFetch } from '../utils/proxy'

const log = createLogger('wecom-qr')

const POLL_INTERVAL_MS = 3000
const DEFAULT_TIMEOUT_MS = 180000

function getPlatformCode(): number {
  switch (process.platform) {
    case 'darwin':
      return 1
    case 'win32':
      return 2
    case 'linux':
      return 3
    default:
      return 0
  }
}

const QR_GENERATE_URL = `https://work.weixin.qq.com/ai/qc/generate?source=wecom-cli&plat=${getPlatformCode()}`
const QR_QUERY_URL = 'https://work.weixin.qq.com/ai/qc/query_result'

export interface WecomScanStartResult {
  scode: string
  authUrl: string
}

export interface WecomScanWaitResult {
  botId: string
  secret: string
}

interface WecomGenerateResponse {
  data?: {
    scode?: string
    auth_url?: string
  }
}

interface WecomQueryResponse {
  data?: {
    status?: string
    bot_info?: {
      botid?: string
      secret?: string
    }
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await proxyFetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export async function startWecomQrScan(): Promise<WecomScanStartResult> {
  const payload = await fetchJson<WecomGenerateResponse>(QR_GENERATE_URL)
  const scode = payload?.data?.scode?.trim()
  const authUrl = payload?.data?.auth_url?.trim()
  if (!scode || !authUrl) {
    throw new Error('获取二维码失败，响应格式异常')
  }
  return { scode, authUrl }
}

export async function waitWecomQrScan(
  scode: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<WecomScanWaitResult> {
  const trimmed = scode.trim()
  if (!trimmed) throw new Error('缺少扫码会话 scode')

  const startedAt = Date.now()
  const url = `${QR_QUERY_URL}?scode=${encodeURIComponent(trimmed)}`

  while (Date.now() - startedAt < timeoutMs) {
    const payload = await fetchJson<WecomQueryResponse>(url)
    const status = payload?.data?.status
    if (status === 'success') {
      const botId = payload?.data?.bot_info?.botid?.trim()
      const secret = payload?.data?.bot_info?.secret?.trim()
      if (!botId || !secret) {
        throw new Error('扫码成功但未获取到 Bot 信息，请重试')
      }
      return { botId, secret }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  log.warn('wecom qr scan timed out')
  throw new Error('扫码超时（3 分钟），请重试')
}
