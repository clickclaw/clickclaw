import { createLogger } from '../logger'
import { proxyFetch } from '../utils/proxy'

const log = createLogger('feishu-qr')
const IS_DEV = process.env.NODE_ENV !== 'production'

const FEISHU_BASE = 'https://accounts.feishu.cn'
const LARK_BASE = 'https://accounts.larksuite.com'
const REGISTRATION_PATH = '/oauth/v1/app/registration'
const DEFAULT_TIMEOUT_MS = 600000

export interface FeishuScanStartResult {
  deviceCode: string
  authUrl: string
  intervalSec: number
  expireInSec: number
  domain: 'feishu' | 'lark'
}

export interface FeishuScanWaitResult {
  appId: string
  appSecret: string
  domain: 'feishu' | 'lark'
  openId?: string
}

interface InitResponse {
  supported_auth_methods?: string[]
}

interface BeginResponse {
  device_code?: string
  verification_uri_complete?: string
  interval?: number
  expire_in?: number
}

interface PollResponse {
  client_id?: string
  client_secret?: string
  user_info?: {
    open_id?: string
    tenant_brand?: 'feishu' | 'lark'
  }
  error?: string
  error_description?: string
}

function resolveBase(domain: 'feishu' | 'lark'): string {
  return domain === 'lark' ? LARK_BASE : FEISHU_BASE
}

function maskToken(raw: string): string {
  if (raw.length <= 12) return `${raw.slice(0, 4)}***`
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`
}

async function postRegistration(
  baseUrl: string,
  body: URLSearchParams,
  allowHttpError = false
): Promise<unknown> {
  const res = await proxyFetch(`${baseUrl}${REGISTRATION_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok && !allowHttpError) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as unknown
}

export async function startFeishuQrScan(
  domain: 'feishu' | 'lark' = 'feishu'
): Promise<FeishuScanStartResult> {
  const baseUrl = resolveBase(domain)
  if (IS_DEV) log.info('start scan', { domain, baseUrl })

  const initData = (await postRegistration(
    baseUrl,
    new URLSearchParams({
      action: 'init',
    })
  )) as InitResponse

  if (!initData.supported_auth_methods?.includes('client_secret')) {
    if (IS_DEV) log.warn('init unsupported auth methods', initData.supported_auth_methods)
    throw new Error('当前环境不支持 client_secret 授权')
  }

  const beginData = (await postRegistration(
    baseUrl,
    new URLSearchParams({
      action: 'begin',
      archetype: 'PersonalAgent',
      auth_method: 'client_secret',
      request_user_info: 'open_id',
    })
  )) as BeginResponse

  const deviceCode = beginData.device_code?.trim()
  const authUrl = beginData.verification_uri_complete?.trim()
  const intervalSec = beginData.interval ?? 5
  const expireInSec = beginData.expire_in ?? 600

  if (!deviceCode || !authUrl) {
    if (IS_DEV) log.warn('begin response invalid', beginData)
    throw new Error('获取飞书扫码信息失败，响应格式异常')
  }

  if (IS_DEV) {
    log.info('begin ok', {
      domain,
      intervalSec,
      expireInSec,
      deviceCode: maskToken(deviceCode),
    })
  }

  return { deviceCode, authUrl, intervalSec, expireInSec, domain }
}

export async function waitFeishuQrScan(
  deviceCode: string,
  options?: {
    domain?: 'feishu' | 'lark'
    intervalSec?: number
    timeoutMs?: number
  }
): Promise<FeishuScanWaitResult> {
  const code = deviceCode.trim()
  if (!code) throw new Error('缺少飞书扫码会话 deviceCode')

  let currentDomain = options?.domain ?? 'feishu'
  let baseUrl = resolveBase(currentDomain)
  let currentIntervalSec = options?.intervalSec ?? 5
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()
  let domainSwitched = false
  let attempt = 0
  let lastPollSummary = ''

  if (IS_DEV) {
    log.info('wait scan start', {
      domain: currentDomain,
      intervalSec: currentIntervalSec,
      timeoutMs,
      deviceCode: maskToken(code),
    })
  }

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1
    let pollData: PollResponse
    try {
      pollData = (await postRegistration(
        baseUrl,
        new URLSearchParams({
          action: 'poll',
          device_code: code,
        }),
        true
      )) as PollResponse
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`轮询失败: ${message}`)
    }

    const tenantBrand = pollData.user_info?.tenant_brand
    lastPollSummary = JSON.stringify({
      error: pollData.error,
      errorDescription: pollData.error_description,
      tenantBrand,
      hasAppId: !!pollData.client_id,
      hasAppSecret: !!pollData.client_secret,
      hasOpenId: !!pollData.user_info?.open_id,
    })
    if (IS_DEV) {
      log.info('poll response', {
        attempt,
        domain: currentDomain,
        intervalSec: currentIntervalSec,
        summary: lastPollSummary,
      })
    }
    if (!domainSwitched && tenantBrand === 'lark' && currentDomain !== 'lark') {
      currentDomain = 'lark'
      baseUrl = resolveBase(currentDomain)
      domainSwitched = true
      if (IS_DEV) log.info('poll domain switched to lark', { attempt })
      continue
    }

    const appId = pollData.client_id?.trim()
    const appSecret = pollData.client_secret?.trim()
    if (appId && appSecret) {
      if (IS_DEV) log.info('poll success with credentials', { attempt, domain: currentDomain })
      return {
        appId,
        appSecret,
        domain: currentDomain,
        openId: pollData.user_info?.open_id?.trim() || undefined,
      }
    }

    if (pollData.error) {
      switch (pollData.error) {
        case 'authorization_pending':
          break
        case 'slow_down':
          currentIntervalSec += 5
          if (IS_DEV) log.info('poll slow_down', { attempt, nextIntervalSec: currentIntervalSec })
          break
        case 'access_denied':
          if (IS_DEV) log.warn('poll access denied', { attempt })
          throw new Error('用户拒绝授权')
        case 'expired_token':
          if (IS_DEV) log.warn('poll expired token', { attempt })
          throw new Error('扫码会话已过期，请重新扫码')
        default:
          if (IS_DEV) log.warn('poll returned error', { attempt, error: pollData.error })
          throw new Error(
            pollData.error_description
              ? `${pollData.error}: ${pollData.error_description}`
              : pollData.error
          )
      }
    }

    await new Promise((resolve) => setTimeout(resolve, currentIntervalSec * 1000))
  }

  log.warn('feishu qr scan timed out', {
    domain: currentDomain,
    attempt,
    lastPollSummary,
  })
  throw new Error(
    lastPollSummary ? `扫码超时，请重试（最后状态：${lastPollSummary}）` : '扫码超时，请重试'
  )
}
