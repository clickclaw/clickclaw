/**
 * 自动更新服务
 *
 * 基于 electron-updater（Generic CDN provider）
 * CDN 地址：https://update.clickclaw.cn
 *
 * 更新状态流转：
 *   idle → checking → not-available / available → downloading → downloaded
 *   任意阶段 → error（不影响 app 正常使用）
 *
 * 使用方式：
 *   - 启动时调用 initUpdater(win) 注册事件并在后台静默检查一次
 *   - renderer 通过 IPC 触发手动检查（update:check）
 *   - 用户确认后调用 update:install 退出并安装
 */

import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { createLogger } from '../logger'

const log = createLogger('updater')

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateInfo {
  status: UpdateStatus
  version?: string // 可用的新版本号
  progress?: number // 下载进度 0~100
  error?: string // 错误信息
}

let currentInfo: UpdateInfo = { status: 'idle' }
let mainWindow: BrowserWindow | null = null

// ────────────────────────────────────
// 工具：推送状态到 renderer
// ────────────────────────────────────

function pushStatus(info: Partial<UpdateInfo>): void {
  currentInfo = { ...currentInfo, ...info }
  mainWindow?.webContents.send('update:status-changed', currentInfo)
  log.info(`update status: ${currentInfo.status}`, info.version ?? info.error ?? '')
}

// ────────────────────────────────────
// 初始化
// ────────────────────────────────────

export function initUpdater(win: BrowserWindow): void {
  mainWindow = win

  // 不在开发模式下自动检查（避免每次启动都因无法连接 CDN 报错）
  autoUpdater.autoDownload = false // 发现新版本时不自动下载，由用户确认
  autoUpdater.autoInstallOnAppQuit = true // 已下载时退出即安装
  autoUpdater.logger = null // 使用自定义 logger，不让 electron-updater 内部 log

  // ── 事件注册 ──

  autoUpdater.on('checking-for-update', () => {
    pushStatus({ status: 'checking', error: undefined })
  })

  autoUpdater.on('update-available', (info) => {
    pushStatus({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    pushStatus({ status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    pushStatus({ status: 'downloading', progress: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    pushStatus({ status: 'downloaded', version: info.version, progress: 100 })
  })

  autoUpdater.on('error', (err) => {
    pushStatus({ status: 'error', error: err.message })
    log.warn('updater error:', err.message)
  })

  // 启动后延迟 10s 静默检查一次（不打扰启动流程）
  setTimeout(() => {
    checkForUpdates()
  }, 10_000)
}

// ────────────────────────────────────
// 公共 API
// ────────────────────────────────────

/** 检查更新（手动触发 or 定时） */
export function checkForUpdates(): void {
  if (currentInfo.status === 'checking' || currentInfo.status === 'downloading') return

  // electron-updater 在开发态默认不可用，直接给出可见错误，避免“点击无响应”的体感
  if (!app.isPackaged) {
    pushStatus({ status: 'error', error: 'update check is only available in packaged app' })
    return
  }

  // 先进入 checking 态，确保按钮点击后立即有 UI 反馈
  pushStatus({ status: 'checking', error: undefined })

  autoUpdater.checkForUpdates().catch((err) => {
    pushStatus({ status: 'error', error: err.message })
  })
}

/** 开始下载已发现的更新 */
export function downloadUpdate(): void {
  if (currentInfo.status !== 'available') return
  autoUpdater.downloadUpdate().catch((err) => {
    pushStatus({ status: 'error', error: err.message })
  })
}

/** 退出并安装（仅 downloaded 状态有效） */
export function quitAndInstall(): void {
  if (currentInfo.status !== 'downloaded') return
  autoUpdater.quitAndInstall(false, true)
}

/** 获取当前更新状态快照 */
export function getUpdateInfo(): UpdateInfo {
  return { ...currentInfo }
}
