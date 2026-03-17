/**
 * 内置模式 Runtime — 使用打包的 Node.js 22 + openclaw
 */

import { execFile } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { promisify } from 'util'
import type { OpenclawRuntime, RuntimeInfo } from './types'
import {
  resolveBundledNodeBin,
  resolveBundledGatewayEntry,
  resolveBundledGatewayCwd,
  resolveBundledNpmBin,
  isPackaged,
} from '../constants'

const execFileAsync = promisify(execFile)

export class BundledRuntime implements OpenclawRuntime {
  readonly mode = 'bundled' as const

  getNodePath(): string {
    return resolveBundledNodeBin()
  }

  getGatewayEntry(): string {
    return resolveBundledGatewayEntry()
  }

  getGatewayCwd(): string {
    return resolveBundledGatewayCwd()
  }

  getEnv(): Record<string, string> {
    const env: Record<string, string> = {
      OPENCLAW_NO_RESPAWN: '1',
      OPENCLAW_LENIENT_CONFIG: '1', // 内置模式对配置错误更宽容
    }

    // macOS 打包模式需要 ELECTRON_RUN_AS_NODE
    if (isPackaged() && process.platform === 'darwin') {
      env.ELECTRON_RUN_AS_NODE = '1'
    }

    // Node.js 22 默认 IPv6 优先，国内可能超时
    env.NODE_OPTIONS = '--dns-result-order=ipv4first'

    // npm bin 路径
    const npmBin = resolveBundledNpmBin()
    if (existsSync(npmBin)) {
      env.OPENCLAW_NPM_BIN = npmBin
    }

    return env
  }

  async getNodeVersion(): Promise<string> {
    const nodePath = this.getNodePath()
    try {
      const env: Record<string, string> = {}
      if (isPackaged() && process.platform === 'darwin') {
        env.ELECTRON_RUN_AS_NODE = '1'
      }
      const { stdout } = await execFileAsync(nodePath, ['--version'], {
        timeout: 5000,
        env: { ...process.env, ...env },
      })
      return stdout.trim().replace(/^v/, '')
    } catch {
      return '22' // 内置版本固定
    }
  }

  async getOpenclawVersion(): Promise<string> {
    try {
      const cwd = this.getGatewayCwd()
      const pkgPath = join(cwd, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        return pkg.version || 'unknown'
      }
    } catch {
      // 忽略
    }
    return 'unknown'
  }

  async getInfo(): Promise<RuntimeInfo> {
    const [nodeVersion, openclawVersion] = await Promise.all([
      this.getNodeVersion(),
      this.getOpenclawVersion(),
    ])
    return {
      mode: 'bundled',
      nodePath: this.getNodePath(),
      nodeVersion,
      openclawVersion,
      gatewayEntry: this.getGatewayEntry(),
      gatewayCwd: this.getGatewayCwd(),
    }
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    // 1. 检查 Gateway 入口存在
    const entry = this.getGatewayEntry()
    if (!existsSync(entry)) {
      return { valid: false, error: `内置 Gateway 入口不存在: ${entry}` }
    }

    // 2. 检查 Node.js 存在（开发模式下可能还没下载）
    const nodePath = this.getNodePath()
    if (!existsSync(nodePath)) {
      // 开发模式下可以容忍，提示运行 package-resources 脚本
      if (!isPackaged()) {
        return {
          valid: false,
          error: '内置 Node.js 未下载，请先运行 npm run package-resources',
        }
      }
      return { valid: false, error: `内置 Node.js 不存在: ${nodePath}` }
    }

    return { valid: true }
  }
}
