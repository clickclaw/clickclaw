/**
 * 冲突检测 — 检测端口占用、已有进程、全局安装
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import net from 'net'

const execFileAsync = promisify(execFile)

async function execSilent(cmd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: 10000 })
    return stdout.trim()
  } catch {
    return null
  }
}

/**
 * 检测端口是否被占用
 */
export function isPortInUse(port: number): Promise<boolean> {
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

/**
 * 从指定端口开始查找可用端口
 */
export async function findAvailablePort(start: number, maxAttempts = 100): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i
    const inUse = await isPortInUse(port)
    if (!inUse) return port
  }
  throw new Error(`无法找到可用端口（已尝试 ${start} ~ ${start + maxAttempts - 1}）`)
}

/**
 * 强制终止占用端口的进程
 */
export async function killPortProcess(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      const out = await execSilent('netstat', ['-ano', '-p', 'TCP'])
      if (out) {
        for (const line of out.split('\n')) {
          if (line.includes(`:${port}`) && line.includes('LISTENING')) {
            const parts = line.trim().split(/\s+/)
            const pid = parts[parts.length - 1]
            if (pid && pid !== '0') {
              await execSilent('taskkill', ['/F', '/PID', pid])
              return true
            }
          }
        }
      }
    } else {
      const out = await execSilent('lsof', ['-i', `:${port}`, '-t'])
      if (out) {
        const pid = out.split('\n')[0]
        if (pid) {
          await execSilent('kill', ['-9', pid])
          return true
        }
      }
    }
  } catch {
    // 忽略
  }
  return false
}

/**
 * 检测全局安装的 openclaw
 */
export async function detectGlobalOpenclaw(): Promise<{
  found: boolean
  packages: string[]
}> {
  const packages: string[] = []

  for (const pkg of ['openclaw', 'openclaw-cn']) {
    const out = await execSilent('npm', ['list', '-g', pkg, '--depth=0'])
    if (out && !out.includes('empty') && !out.includes('ERR')) {
      packages.push(pkg)
    }
  }

  return { found: packages.length > 0, packages }
}

/**
 * 卸载全局 openclaw
 */
export async function uninstallGlobalOpenclaw(): Promise<void> {
  const { packages } = await detectGlobalOpenclaw()
  for (const pkg of packages) {
    await execSilent('npm', ['uninstall', '-g', pkg])
  }
}
