/**
 * 系统托盘管理
 *
 * 方案：自定义弹出窗口（替代原生系统菜单）
 * - 左键点击托盘图标：直接显示/聚焦主窗口
 * - 右键点击托盘图标：弹出/关闭自定义 BrowserWindow 菜单
 * - 弹窗失焦自动隐藏
 * - macOS：弹窗出现在菜单栏图标正下方
 * - Windows：弹窗出现在任务栏图标正上方
 * - 单例：弹窗创建一次后复用，不重复创建
 */

import { Tray, BrowserWindow, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getGatewayProcess } from './gateway'
import { createLogger } from './logger'

const log = createLogger('tray')

const POPUP_WIDTH = 280
const POPUP_HEIGHT = 360

let tray: Tray | null = null
let popup: BrowserWindow | null = null

// ========== 弹窗创建 ==========

function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#161616',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  // 加载与主窗口相同的 renderer，通过 hash 路由区分
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/tray-popup`)
  } else {
    win.loadURL('app://localhost/#/tray-popup')
  }

  // 失焦自动隐藏
  win.on('blur', () => win.hide())

  return win
}

// ========== 弹窗定位 ==========

function positionPopup(): void {
  if (!tray || !popup) return

  const trayBounds = tray.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const workArea = display.workArea
  const isMac = process.platform === 'darwin'

  // macOS：图标在顶部菜单栏，弹窗向下；Windows：图标在底部任务栏，弹窗向上
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2)
  let y = isMac
    ? Math.round(trayBounds.y + trayBounds.height + 4)
    : Math.round(trayBounds.y - POPUP_HEIGHT - 8)

  // 防止弹窗超出屏幕工作区
  x = Math.max(workArea.x + 4, Math.min(x, workArea.x + workArea.width - POPUP_WIDTH - 4))
  y = Math.max(workArea.y + 4, Math.min(y, workArea.y + workArea.height - POPUP_HEIGHT - 4))

  popup.setPosition(x, y)
}

// ========== 弹窗切换 ==========

function togglePopup(): void {
  if (!popup) return
  if (popup.isVisible()) {
    popup.hide()
  } else {
    positionPopup()
    popup.show()
    popup.focus()
  }
}

// ========== Tooltip ==========

function updateTooltip(state: string): void {
  if (!tray) return
  const tips: Record<string, string> = {
    stopped: 'ClickClaw — Gateway 已停止',
    starting: 'ClickClaw — Gateway 启动中...',
    running: 'ClickClaw — Gateway 运行中',
    stopping: 'ClickClaw — Gateway 停止中...',
  }
  tray.setToolTip(tips[state] ?? 'ClickClaw')
}

// ========== 初始化 ==========

export function createTray(win: BrowserWindow): void {
  if (tray) return

  // 开发模式：从源码 assets/ 目录读取；打包模式：从 extraResources 注入的 resources/ 读取
  const iconPath = is.dev
    ? join(__dirname, '../../assets/icon-256.png')
    : join(process.resourcesPath, 'icon-256.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)
  tray.setToolTip('ClickClaw')

  popup = createPopupWindow()

  // 左键点击：直接显示主窗口
  tray.on('click', () => {
    if (win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
    // 如果弹窗正在显示，顺手关掉
    if (popup?.isVisible()) popup.hide()
  })

  // 右键点击：弹出菜单（全平台统一）
  tray.on('right-click', togglePopup)

  // 监听 Gateway 状态变化，更新 tooltip
  getGatewayProcess().addStateChangeListener((change) => {
    updateTooltip(change.to)
  })

  log.info('tray created (left-click=main, right-click=popup)')
}

// ========== 销毁 ==========

export function destroyTray(): void {
  if (popup) {
    popup.destroy()
    popup = null
  }
  if (tray) {
    tray.destroy()
    tray = null
  }
}
