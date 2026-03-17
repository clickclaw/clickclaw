/**
 * Gateway 认证 Token 管理
 *
 * Token 用于 ClickClaw ↔ Gateway 的安全通信。
 * 生成策略：
 * 1. 优先从 openclaw.json 的 gateway.auth.token 读取
 * 2. 不存在则生成随机 Token 并回写配置
 * 3. Token 通过环境变量 OPENCLAW_GATEWAY_TOKEN 注入子进程
 * 4. 同时注入 BrowserWindow 的 localStorage 供 Control UI 使用
 */

import { randomBytes } from 'crypto'
import { app } from 'electron'
import { createLogger } from '../logger'
import { readConfig, writeConfig } from '../config/manager'
import { loadOrCreateDeviceIdentity, signDevicePayload } from './device-identity'
import { loadDeviceToken } from './device-auth-store'

const log = createLogger('gateway-auth')

const TOKEN_LENGTH = 16 // 16 字节 = 32 字符 hex
const TOKEN_PREFIX = 'clickclaw-'

function resolveClientVersion(): string {
  const version = app.getVersion()?.trim()
  return version && version.length > 0 ? version : 'dev'
}

/**
 * 解析或生成 Gateway Token
 * 如果配置中没有 token，自动生成并写回
 */
export function resolveGatewayToken(): string {
  const config = readConfig()
  const gateway = config.gateway as
    | ({ auth?: { token?: string } } & Record<string, unknown>)
    | undefined

  // 尝试从配置读取
  const existingToken = gateway?.auth?.token
  if (typeof existingToken === 'string' && existingToken.trim().length > 0) {
    log.debug(`token loaded from config: ${maskToken(existingToken)}`)
    return existingToken.trim()
  }

  // 生成新 Token
  const newToken = generateToken()
  log.info(`generated new gateway token: ${maskToken(newToken)}`)

  // 回写配置（不触发快照，因为这是自动补全行为）
  if (!config.gateway) config.gateway = {}
  if (!config.gateway.auth) (config.gateway as Record<string, unknown>).auth = {}
  ;(config.gateway as Record<string, Record<string, unknown>>).auth.token = newToken
  ;(config.gateway as Record<string, Record<string, unknown>>).auth.mode = 'token'

  writeConfig(config, { skipSnapshot: true })
  return newToken
}

/**
 * 生成随机 Token
 */
export function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_LENGTH).toString('hex')}`
}

/**
 * Token 脱敏（日志用）
 */
export function maskToken(token: string): string {
  if (token.length <= TOKEN_PREFIX.length + 8) return '***'
  if (token.startsWith(TOKEN_PREFIX)) {
    const suffix = token.slice(TOKEN_PREFIX.length)
    return `${TOKEN_PREFIX}${suffix.slice(0, 4)}...${suffix.slice(-4)}`
  }
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

/**
 * 生成注入 BrowserWindow localStorage 的 JS 代码
 * Gateway Control UI 从 localStorage 读取 token 和 URL
 */
export function buildTokenInjectionScript(port: number, token: string): string {
  const escaped = token.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const gatewayUrl = `ws://127.0.0.1:${port}`

  return `
    (() => {
      const key = "openclaw.control.settings.v1";
      const raw = localStorage.getItem(key);
      const s = raw ? JSON.parse(raw) : {};
      s.token = "${escaped}";
      s.gatewayUrl = "${gatewayUrl}";
      localStorage.setItem(key, JSON.stringify(s));
    })();
  `
}

/**
 * 构建标准 Ed25519 connect 握手帧（v3 签名协议）
 *
 * payload 格式（与 Gateway 服务端 buildDeviceAuthPayload 完全一致）：
 * v3|deviceId|clientId|clientMode|role|scopes|signedAt|token|nonce|platform|deviceFamily
 *
 * - 优先复用已存储的 deviceToken，无需重签
 * - 不存在 deviceToken 时，使用 gatewayToken 作为 auth.token 并进行设备签名
 * - nonce 来自 Gateway 发送的 connect.challenge 事件
 */
export function buildConnectFrame(nonce: string): object {
  const identity = loadOrCreateDeviceIdentity()
  const stored = loadDeviceToken(identity.deviceId, 'operator')
  const gatewayToken = resolveGatewayToken()
  const authToken = stored?.token ?? gatewayToken
  const clientVersion = resolveClientVersion()

  const role = 'operator'
  const scopes = [
    'operator.admin',
    'operator.approvals',
    'operator.pairing',
    'operator.read',
    'operator.write',
  ]
  const signedAtMs = Date.now()
  const deviceFamily = 'desktop'
  // Node.js process.platform 用 win32/darwin，Gateway 期望 windows/macos/linux
  const osName =
    process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'

  // v3 签名 payload（顺序必须与 Gateway 服务端完全一致）
  // v3|deviceId|clientId|clientMode|role|scopes|signedAt|token|nonce|platform|deviceFamily
  const payload = [
    'v3',
    identity.deviceId,
    'openclaw-control-ui',
    'ui',
    role,
    scopes.join(','),
    String(signedAtMs),
    authToken ?? '',
    nonce,
    osName,
    deviceFamily,
  ].join('|')

  const signature = signDevicePayload(identity.privateKeyPkcs8Base64, payload)
  const id = `connect-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  return {
    type: 'req',
    id,
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui', // GATEWAY_CLIENT_IDS 枚举值，Gateway 侧硬校验
        version: clientVersion,
        platform: osName,
        deviceFamily,
        mode: 'ui',
      },
      role,
      scopes,
      device: {
        id: identity.deviceId,
        publicKey: identity.publicKeyBase64url,
        signature,
        signedAt: signedAtMs,
        nonce,
      },
      auth: authToken ? { token: authToken } : undefined,
      caps: ['tool-events'],
      locale: 'zh-CN',
      userAgent: `clickclaw/${clientVersion}`,
    },
  }
}
