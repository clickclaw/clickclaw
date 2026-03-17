/**
 * Gateway deviceToken 持久化存储
 *
 * Gateway 首次 Ed25519 签名握手成功后颁发 deviceToken；
 * 后续重连直接复用 deviceToken，无需重签（节省 CPU 并减少日志噪音）。
 *
 * 文件位置：~/.clickclaw/device-auth.json
 * 读写失败均静默处理，不抛出异常。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { DEVICE_AUTH_PATH } from '../constants'
import { createLogger } from '../logger'

const log = createLogger('device-auth-store')

// ========== 类型定义 ==========

interface TokenEntry {
  token: string
  scopes: string[]
  updatedAtMs: number
}

interface DeviceAuthFile {
  version: number
  deviceId: string
  tokens: Record<string, TokenEntry> // role → entry
}

// ========== 内部工具 ==========

function readFile(): DeviceAuthFile | null {
  try {
    if (!existsSync(DEVICE_AUTH_PATH)) return null
    const content = readFileSync(DEVICE_AUTH_PATH, 'utf-8')
    return JSON.parse(content) as DeviceAuthFile
  } catch (err) {
    log.warn('failed to read device-auth.json:', err)
    return null
  }
}

function writeFile(data: DeviceAuthFile): void {
  try {
    const dir = dirname(DEVICE_AUTH_PATH)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(DEVICE_AUTH_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    log.warn('failed to write device-auth.json:', err)
  }
}

// ========== 公开 API ==========

/**
 * 读取指定 deviceId + role 的 deviceToken
 * @returns 存在则返回 { token, scopes, updatedAtMs }，否则返回 null
 */
export function loadDeviceToken(
  deviceId: string,
  role: string
): { token: string; scopes: string[]; updatedAtMs: number } | null {
  try {
    const file = readFile()
    if (!file || file.deviceId !== deviceId) return null
    const entry = file.tokens?.[role]
    if (!entry?.token) return null
    return entry
  } catch {
    return null
  }
}

/**
 * 持久化 Gateway 颁发的 deviceToken
 */
export function storeDeviceToken(
  deviceId: string,
  role: string,
  token: string,
  scopes: string[]
): void {
  try {
    const existing = readFile()
    // 如果已有文件且 deviceId 不同，说明设备身份重置了，清空旧 tokens
    const base: DeviceAuthFile =
      existing?.deviceId === deviceId ? existing : { version: 1, deviceId, tokens: {} }

    base.tokens[role] = { token, scopes, updatedAtMs: Date.now() }
    writeFile(base)
    log.debug(`deviceToken stored for role=${role}, deviceId=${deviceId.slice(0, 8)}...`)
  } catch (err) {
    log.warn('failed to store deviceToken:', err)
  }
}

/**
 * 清除指定 role 的 deviceToken（TOKEN_MISMATCH 时调用，下次用 gatewayToken 重新签名）
 */
export function clearDeviceToken(deviceId: string, role: string): void {
  try {
    const file = readFile()
    if (!file || file.deviceId !== deviceId) return
    delete file.tokens[role]
    writeFile(file)
    log.debug(`deviceToken cleared for role=${role}, deviceId=${deviceId.slice(0, 8)}...`)
  } catch (err) {
    log.warn('failed to clear deviceToken:', err)
  }
}
