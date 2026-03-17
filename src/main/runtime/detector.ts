/**
 * 环境检测 — 仅检测已有配置、已有 Gateway 与内置 openclaw 版本
 */

import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import net from 'net'
import type { DetectionResult, ExistingConfigDetection, ExistingGatewayDetection } from './types'
import JSON5 from 'json5'
import { CONFIG_PATH, DEFAULT_PORT } from '../constants'
import { resolveBundledGatewayCwd } from '../constants'

const execFileAsync = promisify(execFile)

// ========== 已有配置检测 ==========

export function detectExistingConfig(): ExistingConfigDetection {
  const result: ExistingConfigDetection = {
    found: false,
    valid: false,
    hasProviders: false,
    hasChannels: false,
    agentCount: 0,
  }

  if (!existsSync(CONFIG_PATH)) return result
  result.found = true

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8')
    const config = JSON5.parse(content)
    result.valid = true

    if (config.models?.providers && Object.keys(config.models.providers).length > 0) {
      result.hasProviders = true
    }

    if (config.channels && Object.keys(config.channels).length > 0) {
      result.hasChannels = true
    }

    if (config.agents && typeof config.agents === 'object') {
      result.agentCount = Object.keys(config.agents).length
    }
  } catch {
    // JSON5 解析失败时保留默认 invalid 状态
  }

  return result
}

// ========== 已有 Gateway 检测 ==========

function execSilent(cmd: string, args: string[]): Promise<string | null> {
  return execFileAsync(cmd, args, {
    timeout: 5000,
    shell: process.platform === 'win32',
  })
    .then(({ stdout }) => stdout.trim())
    .catch(() => null)
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => {
      server.close()
      resolve(false)
    })
    server.listen(port, '127.0.0.1')
  })
}

async function getPortProcess(
  port: number
): Promise<{ pid: number | null; processName: string | null }> {
  if (process.platform === 'win32') {
    const out = await execSilent('netstat', ['-ano', '-p', 'TCP'])
    if (out) {
      for (const line of out.split('\n')) {
        if (line.includes(`:${port}`) && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/)
          const pid = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(pid)) {
            const taskInfo = await execSilent('tasklist', [
              '/FI',
              `PID eq ${pid}`,
              '/FO',
              'CSV',
              '/NH',
            ])
            const name = taskInfo?.split(',')[0]?.replace(/"/g, '') || null
            return { pid, processName: name }
          }
        }
      }
    }
  } else {
    const out = await execSilent('lsof', ['-i', `:${port}`, '-t'])
    if (out) {
      const pid = parseInt(out.split('\n')[0], 10)
      if (!isNaN(pid)) {
        const name = await execSilent('ps', ['-p', String(pid), '-o', 'comm='])
        return { pid, processName: name }
      }
    }
  }
  return { pid: null, processName: null }
}

export async function detectExistingGateway(port: number): Promise<ExistingGatewayDetection> {
  const inUse = await checkPort(port)
  if (!inUse) {
    return { running: false, port, pid: null, processName: null }
  }

  const { pid, processName } = await getPortProcess(port)
  return { running: true, port, pid, processName }
}

// ========== 内置 openclaw 版本 ==========

export function getBundledVersions(): { version: string; nodeVersion: string } {
  try {
    const pkgPath = join(resolveBundledGatewayCwd(), 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return {
        version: pkg.version || 'unknown',
        nodeVersion: '22',
      }
    }
  } catch {
    // 开发模式下内置资源可能还没下载
  }
  return { version: 'unknown', nodeVersion: '22' }
}

// ========== 主检测入口 ==========

export async function detectEnvironment(): Promise<DetectionResult> {
  const [existingGateway, bundledOpenclaw] = await Promise.all([
    detectExistingGateway(DEFAULT_PORT),
    Promise.resolve(getBundledVersions()),
  ])

  const existingConfig = detectExistingConfig()

  return {
    existingConfig,
    existingGateway,
    bundledOpenclaw,
  }
}
