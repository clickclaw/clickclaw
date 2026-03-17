/**
 * Ed25519 设备身份管理
 *
 * 每台运行 ClickClaw 的设备持有一对 Ed25519 密钥。
 * - deviceId：公钥的 SHA-256 十六进制摘要（64字符）
 * - 密钥对生成后写入 ~/.clickclaw/device-identity.json，下次启动直接复用
 * - 读写失败时静默降级，不阻塞主流程（与 app-cache.ts 风格一致）
 *
 * 签名格式：Ed25519 对 UTF-8 payload 的原始签名，base64url 编码
 */

import { generateKeyPairSync, createHash, createPrivateKey, sign } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { DEVICE_IDENTITY_PATH } from '../constants'
import { createLogger } from '../logger'

const log = createLogger('device-identity')
let cachedIdentity: DeviceIdentity | null = null

// ========== 类型定义 ==========

export interface DeviceIdentity {
  version: number
  /** SHA-256(rawPublicKey) 的十六进制字符串，共 64 字符 */
  deviceId: string
  /** 32 字节原始公钥的 base64url 编码（发给 Gateway） */
  publicKeyBase64url: string
  /** 完整 PKCS8 DER 私钥的 base64 编码（用于 createPrivateKey 还原） */
  privateKeyPkcs8Base64: string
  createdAtMs: number
}

// ========== 内部工具 ==========

/** Buffer → base64url（无 padding） */
function toBase64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** 生成新的 Ed25519 密钥对身份 */
function generateIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')

  // SPKI DER 格式：前 12 字节是固定 ASN.1 header，后 32 字节是原始公钥
  const spkiDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  const rawPublicKey = spkiDer.slice(12)

  // PKCS8 DER 格式存储私钥，方便后续 createPrivateKey({ format: 'der', type: 'pkcs8' }) 还原
  const pkcs8Der = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer

  const deviceId = createHash('sha256').update(rawPublicKey).digest('hex')

  return {
    version: 1,
    deviceId,
    publicKeyBase64url: toBase64url(rawPublicKey),
    privateKeyPkcs8Base64: pkcs8Der.toString('base64'),
    createdAtMs: Date.now(),
  }
}

// ========== 公开 API ==========

/**
 * 加载已有设备身份，不存在则生成并持久化。
 * 读写失败时静默降级（返回临时生成的身份，不写入磁盘）。
 */
export function loadOrCreateDeviceIdentity(): DeviceIdentity {
  if (cachedIdentity) return cachedIdentity

  // 尝试从磁盘加载
  try {
    if (existsSync(DEVICE_IDENTITY_PATH)) {
      const content = readFileSync(DEVICE_IDENTITY_PATH, 'utf-8')
      const identity = JSON.parse(content) as DeviceIdentity
      if (
        identity.version === 1 &&
        identity.deviceId &&
        identity.privateKeyPkcs8Base64 &&
        identity.publicKeyBase64url
      ) {
        log.debug(`device identity loaded: ${identity.deviceId}`)
        cachedIdentity = identity
        return identity
      }
    }
  } catch (err) {
    log.warn('failed to read device-identity.json:', err)
  }

  // 生成新身份
  const identity = generateIdentity()
  log.info(`device identity created: ${identity.deviceId}`)

  // 持久化
  try {
    const dir = dirname(DEVICE_IDENTITY_PATH)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(DEVICE_IDENTITY_PATH, JSON.stringify(identity, null, 2), 'utf-8')
  } catch (err) {
    log.warn('failed to write device-identity.json:', err)
  }

  cachedIdentity = identity
  return identity
}

/**
 * 用私钥对 payload 进行 Ed25519 签名，返回 base64url 编码的签名。
 * @param pkcs8Base64 - PKCS8 DER 私钥的 base64 编码（来自 DeviceIdentity.privateKeyPkcs8Base64）
 * @param payload     - 待签名的 UTF-8 字符串
 */
export function signDevicePayload(pkcs8Base64: string, payload: string): string {
  const privateKey = createPrivateKey({
    key: Buffer.from(pkcs8Base64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  })
  // null 表示使用 Ed25519 内置的哈希（不额外 hash）
  const sig = sign(null, Buffer.from(payload, 'utf-8'), privateKey)
  return toBase64url(sig)
}
