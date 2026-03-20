import { app, shell, BrowserWindow, protocol, net, nativeImage } from 'electron'
import { join, isAbsolute, normalize } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { detect } from './runtime'
import { registerIpcHandlers } from './ipc-handlers'
import { getGatewayProcess } from './gateway'
import { createLogger } from './logger'
import { createTray, destroyTray } from './tray'
import { loadAppState, saveAppState } from './config/app-cache'
import { initUpdater } from './services/updater'
import { fetchPresetsInBackground } from './services/remote-presets'
import { getSettings } from './settings'
import { applyElectronProxy } from './utils/proxy'
import { installCli } from './services/cli-integration'
import { OPENCLAW_HOME } from './constants'

// ─── 注册自定义协议（必须在 app.whenReady() 之前调用） ───
//
// 使用 app:// 替代 file:// 加载 renderer，目的：
// - 打包后 WebSocket 握手 Origin 头为 "app://localhost"（而非 file:// 的 "null"）
// - 可将 "app://localhost" 写入 gateway.controlUi.allowedOrigins，只允许 ClickClaw 自身连接
// - 比 "null" 更安全：任意本地 HTML 文件无法冒充此 origin
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true, // 视为标准 URL（支持相对路径解析）
      secure: true, // 视为安全上下文（等同 https://）
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

const log = createLogger('main')

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): void {
  // 恢复上次保存的窗口位置和尺寸
  const savedBounds = loadAppState().windowBounds

  const isMac = process.platform === 'darwin'

  // 开发模式：从源码 assets/ 目录读取；打包模式：从 extraResources 注入的 resources/ 读取
  const iconPath = is.dev
    ? join(__dirname, '../../assets/icon-256.png')
    : join(process.resourcesPath, 'icon-256.png')

  mainWindow = new BrowserWindow({
    ...(savedBounds
      ? { x: savedBounds.x, y: savedBounds.y, width: savedBounds.width, height: savedBounds.height }
      : { width: 1200, height: 800 }),
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'ClickClaw',
    autoHideMenuBar: true,
    icon: iconPath,
    // macOS：隐藏标题栏保留红绿灯；Windows/Linux：完全无边框，由渲染层 TitleBar 接管
    ...(isMac
      ? { titleBarStyle: 'hidden' as const, trafficLightPosition: { x: 16, y: 13 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 关闭窗口时最小化到托盘，而非退出
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  // 保存窗口位置和尺寸（节流：resize/moved 均触发）
  const saveBounds = (): void => {
    if (!mainWindow || mainWindow.isMinimized() || mainWindow.isMaximized()) return
    const b = mainWindow.getBounds()
    saveAppState({ windowBounds: { x: b.x, y: b.y, width: b.width, height: b.height } })
  }
  mainWindow.on('resize', saveBounds)
  mainWindow.on('moved', saveBounds)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    // 使用自定义协议加载，Origin 头为 "app://localhost"
    mainWindow.loadURL('app://localhost')
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // macOS 开发态默认会显示 "Electron"，这里强制应用名与 About 信息使用产品名
    app.setName('ClickClaw')
    app.setAboutPanelOptions({
      applicationName: 'ClickClaw',
      applicationVersion: app.getVersion(),
      version: app.getVersion(),
    })
    if (process.platform === 'darwin' && is.dev) {
      const dockIconPath = join(__dirname, '../../assets/icon.icns')
      const dockIcon = nativeImage.createFromPath(dockIconPath)
      if (!dockIcon.isEmpty()) {
        app.dock?.setIcon(dockIcon)
      } else {
        log.warn('dock icon load failed:', dockIconPath)
      }
    }

    electronApp.setAppUserModelId('cn.clickclaw.app')

    // 注册 app:// 协议处理器，将请求映射到 renderer 静态文件
    // 打包后：Origin 头固定为 "app://localhost"，写入 allowedOrigins 即可
    protocol.handle('app', async (request) => {
      const url = new URL(request.url)
      if (url.host === 'local-file') {
        const rawPath = url.searchParams.get('path')
        const decodedPath = rawPath ? decodeURIComponent(rawPath) : ''
        const normalizedPath = normalize(decodedPath)
        const mediaRoot = join(OPENCLAW_HOME, 'media')

        // 仅允许读取 ~/.openclaw/media 下的本地媒体，避免任意文件泄露
        if (!decodedPath || !isAbsolute(normalizedPath) || !normalizedPath.startsWith(mediaRoot)) {
          log.warn('Blocked local-file request:', decodedPath)
          return new Response('Forbidden', { status: 403 })
        }

        log.debug('local-file request:', normalizedPath)
        return net.fetch(pathToFileURL(normalizedPath).toString())
      }

      const { pathname } = url
      // pathname='/' → index.html；其余去掉前导 /
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
      const filePath = join(__dirname, '../renderer', relative)
      return net.fetch(`file://${filePath}`)
    })

    // 注册所有 IPC handlers
    registerIpcHandlers()

    // 启动时应用已保存的代理设置到 Electron session
    applyElectronProxy(getSettings()).catch((err) => {
      log.warn('启动时代理设置应用失败:', err)
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    // 创建系统托盘
    if (mainWindow) {
      createTray(mainWindow)
      // 初始化自动更新（注册事件 + 延迟 10s 静默检查）
      initUpdater(mainWindow)
    }

    // 后台静默拉取远程预设（延迟 3s，不阻塞启动）
    fetchPresetsInBackground()

    // 后台自动安装 CLI wrapper（首次启动 / 应用路径变更时更新）
    // 使用 setTimeout 延迟 2s，避免与启动流程争抢资源
    setTimeout(() => {
      try {
        installCli()
        log.info('CLI wrapper 自动安装完成')
      } catch (err) {
        log.warn('CLI wrapper 自动安装失败（不影响主功能）:', err)
      }
    }, 2000)

    // 启动时执行环境检测
    detect()
      .then((result) => {
        log.info('===== Environment Detection =====')
        log.info(
          'Existing config:',
          result.existingConfig.found
            ? `valid=${result.existingConfig.valid}, providers=${result.existingConfig.hasProviders}, agents=${result.existingConfig.agentCount}`
            : 'none'
        )
        log.info(
          'Gateway:',
          result.existingGateway.running
            ? `running (port=${result.existingGateway.port}, pid=${result.existingGateway.pid})`
            : `stopped (port=${result.existingGateway.port})`
        )
        log.info('Bundled version:', result.bundledOpenclaw.version)
        log.info('=================================')
      })
      .catch((err) => {
        log.error('Environment detection failed:', err)
      })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', async (e) => {
    if (isQuitting) return
    isQuitting = true

    destroyTray()

    const gw = getGatewayProcess()
    gw.stopStatusPolling()
    if (gw.getState() !== 'stopped') {
      e.preventDefault()
      log.info('stopping gateway before quit...')
      try {
        await gw.stop()
      } catch (err) {
        log.error('gateway stop on quit failed:', err)
      }
      app.quit()
    }
  })

  // macOS：所有窗口关闭时不退出（托盘驻留）
  // Windows/Linux：窗口关闭已通过 close 事件拦截，保持托盘
  app.on('window-all-closed', () => {
    // 有托盘时不退出，由托盘"退出"菜单项控制
    // macOS 例外：无托盘时遵循系统惯例
    if (process.platform === 'darwin') {
      // macOS: 保持 app 运行（Dock 图标仍在）
    }
    // Windows/Linux: 已最小化到托盘，不退出
  })
}
