/**
 * IPC Handler 注册中心
 *
 * 集中注册所有 main ↔ renderer 的 IPC 通道。
 * 每个 handler 对接已实现的业务模块，不做业务逻辑。
 */

import { ipcMain, app, BrowserWindow, shell, dialog } from 'electron'
import { detect, selectRuntime, getCurrentMode } from './runtime'
import {
  readConfig,
  writeConfig,
  updateConfig,
  buildProviderConfig,
  buildCustomProviderConfig,
  getPresetsByGroup,
  getAllPresets,
  verifyProvider,
  verifyProviderConfig,
  listSnapshots,
  restoreFromSnapshot,
  createSnapshot,
  getAgents,
  setDefaultAgent,
  getProviders,
  setProvider,
  deleteProvider,
  setChannel,
  getChannels,
  deleteChannel,
  saveChannelAccount,
  deleteChannelAccount,
  setChannelDefaultAccount,
  getChannelPresetsByGroup,
  getChannelPreset,
  verifyChannel,
  getBindings,
  listBindingRules,
  saveBindingRule,
  deleteBindingRule,
  reorderBindingRules,
  saveBinding,
  deleteBinding,
} from './config'
import type { AgentConfig, ProviderConfig } from './config'
import {
  loadAppState,
  saveAppState,
  getSkillVetterSettings,
  saveSkillVetterSettings,
} from './config/app-cache'
import type { SkillVetterSettings } from './config/app-cache'
import { resolveLogDir, resolveLogPath, OPENCLAW_HOME } from './constants'
import { getGatewayProcess } from './gateway'
import type { GatewayStartResult } from './gateway'
import { resolveGatewayToken, buildConnectFrame } from './gateway/auth'
import { loadOrCreateDeviceIdentity } from './gateway/device-identity'
import { storeDeviceToken, clearDeviceToken } from './gateway/device-auth-store'
import { installCli, uninstallCli, getCliStatus } from './services/cli-integration'
import { getLaunchAtLoginEnabled, setLaunchAtLoginEnabled } from './services/launch-at-login'
import { checkForUpdates, downloadUpdate, quitAndInstall, getUpdateInfo } from './services/updater'
import {
  checkOpenclawUpdate,
  getBundledWeixinStatus,
  installOpenclawUpdate,
  getCurrentOpenclawVersion,
} from './services/openclaw-updater'
import { createAgentViaCli, deleteAgentViaCli } from './services/agent-lifecycle'
import { createLogger } from './logger'
import { getRuntime } from './runtime'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getMarketplaces, getMarketplace } from './services/skill-marketplace'
import type {
  SkillMarketplaceInfo,
  SkillSearchResult,
  SkillBrowseResult,
} from './services/skill-marketplace'
import {
  listInstalledSkills,
  installSkillFromZip,
  uninstallSkillByPath,
  readSkillMd,
  exportSkillToZip,
  getSkillsDir,
} from './services/skills-manager'
import { fetchAndCachePresets, getRemotePresetsStatus } from './services/remote-presets'
import { vetSkill } from './services/skill-vetter'
import { getSettings, saveSettings } from './settings'
import type { ProxySettings } from './settings'
import {
  applyElectronProxy,
  syncTelegramProxy,
  testProxyConnectivity,
  proxyFetch,
} from './utils/proxy'
import {
  PairingMonitor,
  listPairingRequests,
  approvePairingRequest,
  addRejectedCode,
} from './services/pairing-monitor'
import type { PairingState } from './services/pairing-monitor'
import { startWecomQrScan, waitWecomQrScan } from './services/wecom-qr'
import { startFeishuQrScan, waitFeishuQrScan } from './services/feishu-qr'
import {
  startWeixinQrScan,
  waitWeixinQrScan,
  logoutWeixinAccount,
  cancelWeixinQrScan,
} from './services/weixin-qr'
import { resolveInitialRoute } from './app-routing'

const execFileAsync = promisify(execFile)

const log = createLogger('ipc')

/** Skill ZIP 内存缓存：审查通过后复用已下载的 Buffer，避免重复下载。key: `${slug}@${version ?? 'latest'}` */
const pendingZipCache = new Map<string, Buffer>()

/** 正在进行的审查任务的 AbortController，key: `${slug}@${version}` */
const vetAbortControllers = new Map<string, AbortController>()

export function registerIpcHandlers(): void {
  let gatewayStartupPromise: Promise<GatewayStartResult> | null = null

  const startGatewayManaged = async (
    action: 'start' | 'start-with-recovery' | 'restart'
  ): Promise<GatewayStartResult> => {
    if (gatewayStartupPromise) {
      log.debug(`gateway ${action} joined existing startup task`)
      return gatewayStartupPromise
    }

    const gw = getGatewayProcess()
    gw.setUserStopped(false)
    ensureInsecureAuth()
    selectRuntime()

    const task = (async () => {
      if (action === 'restart') {
        return await gw.restart()
      }
      if (action === 'start-with-recovery') {
        return await gw.startWithRecovery()
      }
      return await gw.start()
    })()

    gatewayStartupPromise = task
    task.finally(() => {
      if (gatewayStartupPromise === task) {
        gatewayStartupPromise = null
      }
    })

    return gatewayStartupPromise
  }

  // ========== Window Controls（自定义标题栏，非 macOS 使用）==========
  ipcMain.on('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
  ipcMain.on('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })
  ipcMain.on('window:close', () => BrowserWindow.getFocusedWindow()?.close())
  ipcMain.handle(
    'window:is-maximized',
    () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false
  )

  // 显示主窗口（托盘弹窗使用）—— 找到非 alwaysOnTop 的主窗口
  ipcMain.on('app:show-main-window', () => {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isAlwaysOnTop() && !w.isDestroyed())
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  // 退出应用（托盘弹窗使用）
  ipcMain.on('app:quit', () => app.quit())

  // ========== App ==========
  ipcMain.handle('app:get-version', () => app.getVersion())

  ipcMain.handle('app:get-initial-route', async () => {
    const result = await detect()
    const appState = loadAppState()
    const hasValidConfig = result.existingConfig.found && result.existingConfig.valid
    const hasProviders = result.existingConfig.hasProviders
    return {
      ...resolveInitialRoute({
        hasValidConfig,
        hasProviders,
        setupCompleted: appState.setupCompleted === true,
        hasSeenConfigFoundDialog: appState.hasSeenConfigFoundDialog === true,
      }),
      detection: result,
    }
  })

  ipcMain.handle('app:auto-start-gateway', async () => {
    try {
      if (getGatewayProcess().getUserStopped()) {
        log.info('auto-start-gateway skipped: user stopped')
        return { success: false, port: 0, error: 'user stopped' }
      }
      return await startGatewayManaged('start')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('app:auto-start-gateway failed:', message)
      return { success: false, port: 0, error: message }
    }
  })

  // ========== Runtime ==========
  ipcMain.handle('runtime:detect', async () => {
    return await detect()
  })

  ipcMain.handle('runtime:get-mode', () => {
    return getCurrentMode()
  })

  // ========== Provider ==========
  ipcMain.handle('provider:get-presets', () => {
    return getPresetsByGroup()
  })

  ipcMain.handle(
    'provider:verify',
    async (_event, providerKey: string, platformKey: string, apiKey: string, modelId: string) => {
      return await verifyProvider(providerKey, platformKey, apiKey, modelId)
    }
  )

  // ========== Setup ==========
  ipcMain.handle('setup:complete', async (_event, data: unknown) => {
    const d = data as {
      providerKey: string
      platformKey: string
      apiKey: string
      modelId: string
      channels?: Record<string, Record<string, unknown>>
    }

    log.info('setup:complete called', {
      providerKey: d.providerKey,
      platformKey: d.platformKey,
      modelId: d.modelId,
    })

    try {
      // 1. 构建 Provider 配置
      let providerConfig: Record<string, unknown>
      if (d.platformKey === '__custom__') {
        const custom = d.channels?.__customProvider__ as
          | {
              baseUrl: string
              apiType: string
              input: string[]
            }
          | undefined
        providerConfig = buildCustomProviderConfig({
          apiKey: d.apiKey,
          baseUrl: custom?.baseUrl || '',
          api: (custom?.apiType || 'openai-completions') as 'openai-completions',
          modelId: d.modelId,
          input: (custom?.input || ['text']) as Array<'text' | 'image'>,
        })
      } else {
        providerConfig = buildProviderConfig({
          providerKey: d.providerKey,
          platformKey: d.platformKey,
          apiKey: d.apiKey,
          modelId: d.modelId,
        })
      }

      // 2. 构建并写入 openclaw.json（apiKey 直接写入，与 ModelPage 行为一致）
      // providerKey 为用户输入的服务商 ID（预设模式）或自定义 ID（自定义模式）
      const providerName = d.providerKey
      const configUpdate: Record<string, unknown> = {
        models: {
          providers: {
            [providerName]: providerConfig,
          },
        },
      }

      // 渠道配置（排除 __customProvider__ 内部字段）
      if (d.channels) {
        const channels: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(d.channels)) {
          if (key !== '__customProvider__') {
            const preset = getChannelPreset(key)
            const config = value as Record<string, unknown>
            const isComplete = preset
              ? preset.fields
                  .filter((field) => field.required)
                  .every((field) => {
                    const fieldValue = config[field.key]
                    return typeof fieldValue === 'string' && fieldValue.trim() !== ''
                  })
              : false

            if (isComplete) {
              channels[key] = value
            }
          }
        }
        if (Object.keys(channels).length > 0) {
          configUpdate.channels = channels
        }
      }

      // 设置默认模型
      configUpdate.agents = {
        defaults: {
          model: `${providerName}/${d.modelId}`,
        },
      }

      configUpdate.plugins = {
        entries: {
          'openclaw-weixin': {
            enabled: true,
          },
        },
      }

      // 写入必要的 Gateway 配置：
      // - mode: 'local' — openclaw 要求必须显式设置，否则拒绝启动
      // - allowInsecureAuth: true — 跳过 Ed25519 设备签名，仅凭 token 认证
      // - allowedOrigins: ["app://localhost"] — 仅允许 ClickClaw 自定义协议页面连接
      //   （打包后 renderer 通过 app:// 协议加载，Origin 头为 "app://localhost"）
      configUpdate.gateway = {
        mode: 'local',
        controlUi: {
          allowInsecureAuth: true,
          allowedOrigins: ['app://localhost'],
        },
      }

      updateConfig(configUpdate)
      log.info('config written successfully')

      saveAppState({
        setupCompleted: true,
        hasSeenConfigFoundDialog: true,
      })
      log.info('setup completion state persisted')

      // 4. 启动 Gateway
      const result = await startGatewayManaged('start')

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('setup:complete failed:', message)
      return { success: false, port: 0, error: message }
    }
  })

  // ========== Config ==========
  ipcMain.handle('config:read', () => {
    return readConfig()
  })

  ipcMain.handle('config:write', (_event, config: Record<string, unknown>) => {
    writeConfig(config, { source: 'manual', summary: 'UI 配置更新' })
  })

  ipcMain.handle('config:get-snapshots', () => {
    return listSnapshots()
  })

  ipcMain.handle('config:restore-snapshot', (_event, fileName: string) => {
    restoreFromSnapshot(fileName)
  })

  // ========== Gateway ==========

  /**
   * 启动前确保 Gateway controlUi 配置正确：
   * 1. allowInsecureAuth: true — 本地 WS 连接跳过 Ed25519 签名
   * 2. allowedOrigins 包含 "null" — 打包后 loadFile() 的 Origin 头为字符串 "null"
   */
  function ensureInsecureAuth(): void {
    try {
      const cfg = readConfig() as {
        gateway?: {
          mode?: string
          controlUi?: { allowInsecureAuth?: boolean; allowedOrigins?: string[] }
        }
      }
      const needsMode = cfg?.gateway?.mode !== 'local'
      const controlUi = cfg.gateway?.controlUi
      const needsAuth = controlUi?.allowInsecureAuth !== true
      const origins = controlUi?.allowedOrigins ?? []
      const needsNull = !origins.includes('app://localhost')

      if (needsMode || needsAuth || needsNull) {
        updateConfig({
          gateway: {
            ...(needsMode ? { mode: 'local' } : {}),
            controlUi: {
              allowInsecureAuth: true,
              // "app://localhost" 是 Electron 自定义协议 app:// 下的 WebSocket Origin 头
              allowedOrigins: needsNull
                ? [...origins.filter((o) => o !== 'null'), 'app://localhost']
                : origins,
            },
          },
        } as Parameters<typeof updateConfig>[0])
        log.info('ensureInsecureAuth: updated controlUi config')
      }
    } catch (err) {
      log.warn('ensureInsecureAuth: failed to update config', err)
    }
  }

  ipcMain.handle('gateway:start', async () => {
    return await startGatewayManaged('start')
  })

  ipcMain.handle('gateway:start-with-recovery', async () => {
    return await startGatewayManaged('start-with-recovery')
  })

  ipcMain.handle('gateway:stop', async () => {
    const gw = getGatewayProcess()
    gw.setUserStopped(true)
    await gw.stop()
  })

  ipcMain.handle('gateway:restart', async () => {
    return await startGatewayManaged('restart')
  })

  ipcMain.handle('gateway:get-state', () => {
    return getGatewayProcess().getState()
  })

  ipcMain.handle('gateway:get-port', () => {
    return getGatewayProcess().getPort()
  })

  ipcMain.handle('gateway:get-token', () => {
    return resolveGatewayToken()
  })

  // ========== Gateway 设备身份与认证 ==========

  /** 构建 Ed25519 connect 握手帧（含签名），返回给 renderer 直接发送 */
  ipcMain.handle('gateway:build-connect-frame', (_event, nonce: string) => {
    return buildConnectFrame(nonce)
  })

  /** 获取本机 deviceId（SHA-256 公钥哈希，64字符十六进制） */
  ipcMain.handle('gateway:get-device-id', () => {
    const identity = loadOrCreateDeviceIdentity()
    return identity.deviceId
  })

  /**
   * 自动配对：写入 gateway.controlUi.allowedOrigins = ['app://localhost']
   * 只写配置，不重启 Gateway（由调用方决定是否重启）
   */
  ipcMain.handle('gateway:auto-pair-device', () => {
    try {
      const config = readConfig()
      const gw = (config.gateway ?? (config.gateway = {})) as Record<string, unknown>
      const cui = (gw.controlUi ?? (gw.controlUi = {})) as Record<string, unknown>
      const origins: string[] = Array.isArray(cui.allowedOrigins) ? [...cui.allowedOrigins] : []
      if (!origins.includes('app://localhost')) {
        origins.push('app://localhost')
      }
      cui.allowedOrigins = origins
      writeConfig(config, { source: 'auto', summary: 'ClickClaw 自动配对：更新 allowedOrigins' })
      log.info('auto-pair-device: allowedOrigins updated')
      const identity = loadOrCreateDeviceIdentity()
      return { success: true, deviceId: identity.deviceId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('auto-pair-device failed:', message)
      return { success: false, deviceId: '' }
    }
  })

  /** 持久化 Gateway 颁发的 deviceToken */
  ipcMain.handle(
    'gateway:store-device-token',
    (_event, deviceId: string, role: string, token: string, scopes: string[]) => {
      storeDeviceToken(deviceId, role, token, scopes)
    }
  )

  /** 清除指定 role 的 deviceToken（TOKEN_MISMATCH 时使用） */
  ipcMain.handle('gateway:clear-device-token', (_event, deviceId: string, role: string) => {
    clearDeviceToken(deviceId, role)
  })

  // Gateway 日志环形缓冲（最多 500 条），供页面挂载时拉取历史
  const gatewayLogBuffer: string[] = []
  const LOG_BUFFER_MAX = 500

  ipcMain.handle('gateway:get-log-buffer', () => [...gatewayLogBuffer])

  // Gateway 状态变更 → 推送到所有渲染进程
  const setupGatewayEvents = () => {
    const gw = getGatewayProcess()

    gw.setOnStateChange((change) => {
      log.info(`gateway state: ${change.from} → ${change.to}`)
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('gateway:state-changed', change.to)
      }
    })

    gw.setOnLog((line) => {
      // 写入缓冲
      gatewayLogBuffer.push(line)
      if (gatewayLogBuffer.length > LOG_BUFFER_MAX) gatewayLogBuffer.shift()
      // 推送到所有渲染进程
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('gateway:log', line)
      }
    })

    // 启动状态轮询，实时同步外部启停的 Gateway 状态
    gw.startStatusPolling()
  }

  setupGatewayEvents()

  // ========== CLI ==========

  ipcMain.handle('cli:get-status', () => {
    return getCliStatus()
  })

  ipcMain.handle('cli:install', () => {
    installCli()
  })

  ipcMain.handle('cli:uninstall', () => {
    uninstallCli()
  })

  // ========== Launch at Login ==========

  ipcMain.handle('launch:get-status', () => getLaunchAtLoginEnabled())

  ipcMain.handle('launch:set-enabled', (_event, enabled: boolean) => {
    setLaunchAtLoginEnabled(enabled)
  })

  // ========== 自动更新（ClickClaw 本体） ==========

  ipcMain.handle('update:get-info', () => getUpdateInfo())
  ipcMain.handle('update:check', () => {
    checkForUpdates()
  })
  ipcMain.handle('update:download', () => {
    downloadUpdate()
  })
  ipcMain.handle('update:install', async () => {
    await quitAndInstall()
  })

  // ========== OpenClaw 版本升级 ==========

  ipcMain.handle('openclaw-update:check', async () => {
    return checkOpenclawUpdate()
  })

  ipcMain.handle('openclaw-update:install', async (event, version: string) => {
    return installOpenclawUpdate(version, (line) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('openclaw-update:log', line)
      }
    })
  })

  ipcMain.handle('openclaw-update:get-info', () => {
    return { currentVersion: getCurrentOpenclawVersion() }
  })

  ipcMain.handle('channel:weixin-status', () => {
    return getBundledWeixinStatus()
  })

  // ========== Agent ==========

  ipcMain.handle('agent:list', () => {
    return getAgents()
  })

  ipcMain.handle('agent:save', async (_event, agent: AgentConfig) => {
    return await createAgentViaCli(agent)
  })

  ipcMain.handle('agent:delete', async (_event, agentId: string) => {
    await deleteAgentViaCli(agentId)
  })

  ipcMain.handle('agent:set-default', (_event, agentId: string) => {
    setDefaultAgent(agentId)
  })

  // ========== Model ==========

  ipcMain.handle('model:list-providers', () => {
    return getProviders()
  })

  ipcMain.handle('model:save-provider', (_event, name: string, config: ProviderConfig) => {
    setProvider(name, config)
  })

  ipcMain.handle('model:delete-provider', (_event, name: string) => {
    deleteProvider(name)
  })

  ipcMain.handle('model:get-default', () => {
    const cfg = readConfig()
    return cfg.agents?.defaults?.model ?? null
  })

  ipcMain.handle('model:set-default', (_event, primary: string, fallbacks: string[]) => {
    const cfg = readConfig()
    if (!cfg.agents) cfg.agents = {}
    if (!cfg.agents.defaults) cfg.agents.defaults = {}
    cfg.agents.defaults.model = { primary, fallbacks: fallbacks || [] }
    writeConfig(cfg, { source: 'agent', summary: `设置默认模型: ${primary}` })
  })

  ipcMain.handle(
    'model:test',
    async (
      _event,
      params: {
        baseUrl: string
        api: string
        apiKey: string
        modelId: string
      }
    ) => {
      const start = Date.now()
      const result = await verifyProviderConfig({
        baseUrl: params.baseUrl,
        api: params.api as
          | 'anthropic-messages'
          | 'openai-completions'
          | 'openai-responses'
          | 'google-generative-ai',
        apiKey: params.apiKey,
        modelId: params.modelId,
      })
      return { ...result, latencyMs: Date.now() - start }
    }
  )

  ipcMain.handle(
    'model:fetch-remote-list',
    async (
      _event,
      params: {
        baseUrl: string
        apiKey: string
      }
    ) => {
      try {
        const normalizedBase = params.baseUrl.trim().replace(/\/+$/, '')
        const url = /\/v1$/i.test(normalizedBase)
          ? `${normalizedBase}/models`
          : `${normalizedBase}/v1/models`
        const response = await proxyFetch(url, {
          headers: { Authorization: `Bearer ${params.apiKey}` },
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = (await response.json()) as { data?: Array<{ id: string }> | Array<string> }
        const items = data.data || []
        return (items as Array<{ id: string } | string>).map((m) =>
          typeof m === 'string' ? m : m.id
        )
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : String(err))
      }
    }
  )

  // ========== Channel ==========

  ipcMain.handle('channel:get-presets', () => {
    return getChannelPresetsByGroup()
  })

  ipcMain.handle('channel:list', () => {
    return getChannels()
  })

  ipcMain.handle('channel:save', (_event, key: string, config: Record<string, unknown>) => {
    setChannel(key, config)
  })

  ipcMain.handle('channel:delete', (_event, key: string) => {
    deleteChannel(key)
  })

  ipcMain.handle('channel:verify', async (_event, key: string, fields: Record<string, string>) => {
    return await verifyChannel(key, fields)
  })

  ipcMain.handle('channel:wecom-scan-start', async () => {
    return await startWecomQrScan()
  })

  ipcMain.handle('channel:wecom-scan-wait', async (_event, scode: string, timeoutMs?: number) => {
    return await waitWecomQrScan(scode, typeof timeoutMs === 'number' ? timeoutMs : undefined)
  })

  ipcMain.handle('channel:feishu-scan-start', async (_event, domain?: 'feishu' | 'lark') => {
    return await startFeishuQrScan(domain)
  })

  ipcMain.handle(
    'channel:feishu-scan-wait',
    async (
      _event,
      deviceCode: string,
      options?: {
        domain?: 'feishu' | 'lark'
        intervalSec?: number
        timeoutMs?: number
      }
    ) => {
      return await waitFeishuQrScan(deviceCode, options)
    }
  )

  ipcMain.handle(
    'channel:weixin-scan-start',
    async (_event, params?: { accountId?: string; force?: boolean; timeoutMs?: number }) => {
      return await startWeixinQrScan(params)
    }
  )

  ipcMain.handle(
    'channel:weixin-scan-wait',
    async (_event, params: { sessionKey?: string; accountId?: string; timeoutMs?: number }) => {
      return await waitWeixinQrScan(params)
    }
  )

  ipcMain.handle('channel:weixin-scan-cancel', (_event, sessionKey?: string) => {
    cancelWeixinQrScan(sessionKey)
  })

  ipcMain.handle('channel:weixin-logout', (_event, accountId: string) => {
    logoutWeixinAccount(accountId)
  })

  ipcMain.handle(
    'channel:save-account',
    (_event, channelKey: string, accountId: string, data: Record<string, unknown>) => {
      saveChannelAccount(channelKey, accountId, data)
    }
  )

  ipcMain.handle('channel:delete-account', (_event, channelKey: string, accountId: string) => {
    deleteChannelAccount(channelKey, accountId)
  })

  ipcMain.handle('channel:set-default-account', (_event, channelKey: string, accountId: string) => {
    setChannelDefaultAccount(channelKey, accountId)
  })

  // ========== Model 预设模型列表 ==========

  /**
   * 从已配置的 Provider 中读取可用模型列表（无需网络请求）
   * 返回 Array<{ providerKey, providerName, color, models: {id, name}[] }>
   */
  ipcMain.handle('model:get-preset-models', () => {
    const providers = getProviders()
    const allPresets = getAllPresets()

    interface ProviderModelGroup {
      providerKey: string
      providerName: string
      color: string
      models: Array<{ id: string; name: string }>
    }

    const result: ProviderModelGroup[] = []

    for (const [providerKey, providerConfig] of Object.entries(providers)) {
      const models = providerConfig.models || []
      if (models.length === 0) continue

      // 优先直接匹配预设 key，再通过平台 key 查找
      const preset =
        allPresets.find((p) => p.key === providerKey) ||
        allPresets.find((p) => p.platforms.some((pl) => pl.key === providerKey))

      result.push({
        providerKey,
        providerName: preset?.name || providerKey,
        color: preset?.color || '#8c8c8c',
        models: models.map((m) => ({ id: m.id, name: m.name || m.id })),
      })
    }

    return result
  })

  // ========== Binding ==========

  ipcMain.handle('binding:list', () => {
    return getBindings()
  })

  ipcMain.handle('binding:list-rules', () => {
    return listBindingRules()
  })

  ipcMain.handle('binding:save', (_event, agentId: string, channel: string, accountId: string) => {
    saveBinding(agentId, channel, accountId)
  })

  ipcMain.handle(
    'binding:save-rule',
    (
      _event,
      rule: {
        id?: string
        type?: 'route'
        priority?: number
        agentId: string
        match: {
          channel: string
          accountId?: string
          peer?: { kind: string; id: string }
          guildId?: string
          teamId?: string
          roles?: string[]
        }
      }
    ) => {
      return saveBindingRule(rule)
    }
  )

  ipcMain.handle('binding:delete', (_event, channel: string, accountId: string) => {
    deleteBinding(channel, accountId)
  })

  ipcMain.handle('binding:delete-rule', (_event, id: string) => {
    deleteBindingRule(id)
  })

  ipcMain.handle('binding:reorder', (_event, ids: string[]) => {
    return reorderBindingRules(ids)
  })

  // ========== App State ==========

  ipcMain.handle('app-state:get', () => {
    return loadAppState()
  })

  ipcMain.handle('app-state:set', (_event, patch: Parameters<typeof saveAppState>[0]) => {
    saveAppState(patch)
  })

  // ========== Shell ==========

  ipcMain.handle('shell:open-path', (_event, path: string) => {
    return shell.openPath(path)
  })

  ipcMain.handle('app:get-data-paths', () => {
    return {
      logDir: resolveLogDir(),
      openclawDir: OPENCLAW_HOME,
    }
  })

  // ========== Log ==========

  // 读取 ClickClaw 日志文件（倒序，最多 1000 行）
  ipcMain.handle('log:read-clickclaw', async () => {
    try {
      const logPath = resolveLogPath()
      if (!existsSync(logPath)) return []
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())
      return lines.slice(-1000)
    } catch {
      return []
    }
  })

  // 获取 OpenClaw JSONL 日志路径
  ipcMain.handle('log:get-openclaw-log-path', async () => {
    try {
      const cfg = readConfig() as { logging?: { file?: string } }
      return (
        cfg.logging?.file ??
        `${OPENCLAW_HOME}/logs/openclaw-${new Date().toISOString().slice(0, 10)}.log`
      )
    } catch {
      return `${OPENCLAW_HOME}/logs/openclaw-${new Date().toISOString().slice(0, 10)}.log`
    }
  })

  // 读取 OpenClaw JSONL 日志（最多 limit 条，支持 level 过滤）
  ipcMain.handle('log:read-openclaw', async (_e, opts: { limit?: number; level?: string } = {}) => {
    try {
      const cfg = readConfig() as { logging?: { file?: string } }
      const logPath =
        cfg.logging?.file ??
        `${OPENCLAW_HOME}/logs/openclaw-${new Date().toISOString().slice(0, 10)}.log`
      if (!existsSync(logPath)) return []
      const content = readFileSync(logPath, 'utf-8')
      const lines = content.split('\n').filter((l) => l.trim())
      const entries = lines.flatMap((line) => {
        try {
          const entry = JSON.parse(line)
          if (opts.level && entry.level !== opts.level) return []
          return [entry]
        } catch {
          return []
        }
      })
      const limit = opts.limit ?? 500
      return entries.slice(-limit)
    } catch {
      return []
    }
  })

  // 渲染进程调试日志（统一写入 clickclaw.log，便于排查前端事件流）
  ipcMain.handle(
    'log:write',
    (
      _event,
      entry: { level?: 'info' | 'warn' | 'error' | 'debug'; tag?: string; message: string }
    ) => {
      const level = entry?.level || 'info'
      const tag = entry?.tag ? `[${entry.tag}] ` : ''
      const message = `${tag}${entry?.message || ''}`
      if (level === 'warn') log.warn(message)
      else if (level === 'error') log.error(message)
      else if (level === 'debug') log.debug(message)
      else log.info(message)
    }
  )

  // ========== Backup ==========

  // 列出所有快照
  ipcMain.handle('backup:list-snapshots', async () => listSnapshots())

  // 手动创建快照
  ipcMain.handle('backup:create-snapshot', async () => {
    return createSnapshot('manual', '用户手动快照')
  })

  // 还原快照
  ipcMain.handle('backup:restore-snapshot', async (_e, fileName: string) => {
    restoreFromSnapshot(fileName)
  })

  // 完整归档（调用 openclaw backup create CLI）
  ipcMain.handle('backup:create-full', async (_e, outputDir: string) => {
    const runtime = getRuntime()
    const env = runtime.getEnv()

    const nodePath = runtime.getNodePath()
    const gatewayEntry = runtime.getGatewayEntry()
    const args = [gatewayEntry, 'backup', 'create', '--output', outputDir, '--verify']
    try {
      const { stdout } = await execFileAsync(nodePath, args, {
        timeout: 60000,
        env: { ...process.env, ...env },
      })
      log.info(`full backup created: ${stdout.trim()}`)
      const match = stdout.match(/([^\s]+\.tar\.gz)/)
      return { success: true, archivePath: match ? match[1] : outputDir }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error('full backup failed:', message)
      return { success: false, error: message }
    }
  })

  // ========== Skill ==========

  ipcMain.handle('skill:list-marketplaces', (): SkillMarketplaceInfo[] => {
    return getMarketplaces().map(({ id, name, baseUrl }) => ({ id, name, baseUrl }))
  })

  ipcMain.handle(
    'skill:search',
    async (
      _e,
      marketplaceId: string,
      query: string,
      opts?: { limit?: number }
    ): Promise<SkillSearchResult[]> => {
      const mp = getMarketplace(marketplaceId)
      if (!mp) throw new Error(`Unknown marketplace: ${marketplaceId}`)
      return await mp.search(query, opts)
    }
  )

  ipcMain.handle(
    'skill:browse',
    async (
      _e,
      marketplaceId: string,
      opts?: { limit?: number; sort?: string; cursor?: string }
    ): Promise<SkillBrowseResult> => {
      const mp = getMarketplace(marketplaceId)
      if (!mp) throw new Error(`Unknown marketplace: ${marketplaceId}`)
      return await mp.browse(opts)
    }
  )

  ipcMain.handle(
    'skill:install',
    async (
      _e,
      marketplaceId: string,
      slug: string,
      version?: string,
      installDir?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const mp = getMarketplace(marketplaceId)
        if (!mp) throw new Error(`Unknown marketplace: ${marketplaceId}`)

        // 优先复用审查时已下载的 ZIP，避免重复下载
        const cacheKey = `${slug}@${version ?? 'latest'}`
        let zipBuffer = pendingZipCache.get(cacheKey)
        if (!zipBuffer) {
          zipBuffer = await mp.download(slug, version)
        }

        installSkillFromZip(slug, zipBuffer, installDir)

        // 安装成功后清理缓存
        pendingZipCache.delete(cacheKey)

        return { success: true }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        log.error(`skill:install failed for "${slug}":`, error)
        return { success: false, error }
      }
    }
  )

  ipcMain.handle(
    'skill:vet',
    async (event, marketplaceId: string, slug: string, version?: string, locale?: string) => {
      const mp = getMarketplace(marketplaceId)
      if (!mp) throw new Error(`Unknown marketplace: ${marketplaceId}`)

      const resolvedVersion = version ?? 'latest'
      const cacheKey = `${slug}@${resolvedVersion}`

      // 创建可取消控制器
      const controller = new AbortController()
      vetAbortControllers.set(cacheKey, controller)

      /** 向渲染进程推送进度事件 */
      const sendProgress = (
        stage: 'downloading' | 'parsing' | 'analyzing' | 'done',
        message?: string,
        chunk?: string
      ): void => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('skill:vet-progress', { stage, message, chunk })
        }
      }

      try {
        // Stage: downloading
        sendProgress('downloading', 'Downloading skill package...')
        const zipBuffer = await mp.download(slug, version)
        pendingZipCache.set(cacheKey, zipBuffer)

        // Stage: parsing + analyzing（由 vetSkill 回调触发）
        const result = await vetSkill(slug, resolvedVersion, zipBuffer, {
          signal: controller.signal,
          locale,
          onProgress: (stage, message, chunk) => {
            sendProgress(stage, message, chunk)
          },
        })

        sendProgress('done')
        return result
      } finally {
        vetAbortControllers.delete(cacheKey)
      }
    }
  )

  // 取消正在进行的审查
  ipcMain.on('skill:vet-cancel', (_e, slug: string, version?: string) => {
    const cacheKey = `${slug}@${version ?? 'latest'}`
    const controller = vetAbortControllers.get(cacheKey)
    if (controller) {
      controller.abort()
      vetAbortControllers.delete(cacheKey)
      log.info(`vet cancelled for ${cacheKey}`)
    }
  })

  ipcMain.handle('skill:vet-settings:get', (): SkillVetterSettings => {
    return getSkillVetterSettings()
  })

  ipcMain.handle('skill:vet-settings:save', (_e, s: SkillVetterSettings): void => {
    saveSkillVetterSettings(s)
  })

  ipcMain.handle('skill:list-installed', () => {
    // 降级：目录扫描（workspace/skills + ~/.openclaw/skills）
    // 主调用路径：SkillsPage 直接通过 GatewayContext.callRpc('skills.status') 获取
    return listInstalledSkills()
  })

  ipcMain.handle('skill:uninstall', (_e, baseDir: string) => {
    // 接收 skill 的 baseDir 绝对路径，后端进行安全校验
    uninstallSkillByPath(baseDir)
  })

  ipcMain.handle('skill:read-md', (_e, filePath: string) => {
    return readSkillMd(filePath)
  })

  ipcMain.handle('skill:export-zip', async (_e, baseDir: string, skillName: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: `导出 Skill: ${skillName}`,
      defaultPath: `${skillName}.zip`,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    try {
      const buf = exportSkillToZip(baseDir)
      const { writeFileSync: writeFs } = await import('fs')
      writeFs(filePath, buf)
      return { canceled: false, filePath }
    } catch (err) {
      throw new Error(String(err))
    }
  })

  ipcMain.handle('skill:open-dir', async () => {
    const dir = getSkillsDir()
    mkdirSync(dir, { recursive: true })
    return shell.openPath(dir)
  })

  // ========== Dialog ==========

  ipcMain.handle('dialog:show-save', async (_e, opts: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(opts)
  })

  // ========== Remote Presets ==========

  ipcMain.handle('remote-presets:get-status', () => {
    return getRemotePresetsStatus()
  })

  ipcMain.handle('remote-presets:refresh', async () => {
    return await fetchAndCachePresets()
  })

  // ========== 网络代理 ==========

  ipcMain.handle('proxy:get', () => {
    return getSettings()
  })

  ipcMain.handle('proxy:set', async (_e, patch: Partial<ProxySettings>) => {
    const settings = saveSettings(patch)

    // 层 1: 立即更新 Electron session 代理
    await applyElectronProxy(settings)

    // 层 3: 同步 Telegram 渠道代理配置
    const proxyUrl = settings.proxyEnabled ? settings.proxyUrl : ''
    syncTelegramProxy(proxyUrl)

    // 层 2: 重启 Gateway，使新的代理 env 生效
    const gw = getGatewayProcess()
    if (gw.getState() === 'running') {
      gw.restart().catch((err: unknown) => {
        log.warn('代理设置变更后 Gateway 重启失败:', err)
      })
    }

    return settings
  })

  ipcMain.handle('proxy:test', async (_e, opts?: { proxyUrl?: string; proxyBypass?: string }) => {
    return await testProxyConnectivity(opts)
  })

  // ========== Pairing 配对审批 ==========

  // 初始化配对监控，与 Gateway 状态联动
  const pairingMonitor = new PairingMonitor({
    gateway: getGatewayProcess(),
    onStateChange: (state: PairingState) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send('pairing:state-changed', state)
        }
      }
    },
    isAppInForeground: () => BrowserWindow.getAllWindows().some((w) => w.isFocused()),
  })

  // 监听 Gateway 状态，同步启停 monitor
  {
    const gw = getGatewayProcess()
    gw.addStateChangeListener((change) => {
      if (change.to === 'running') {
        pairingMonitor.start()
      } else if (change.to === 'stopped' || change.to === 'stopping') {
        pairingMonitor.stop()
      }
    })
    // 若 Gateway 已在运行（注册时已是 running 状态），立即启动
    if (gw.getState() === 'running') {
      pairingMonitor.start()
    }
  }

  ipcMain.handle('pairing:get-state', () => pairingMonitor.getState())

  ipcMain.handle('pairing:approve', async (_e, channel: string, code: string) => {
    const result = await approvePairingRequest(channel, code)
    if (result.success) {
      // 批准后立即刷新，更新 UI
      pairingMonitor.triggerNow()
    }
    return result
  })

  ipcMain.handle('pairing:reject', (_e, channel: string, code: string) => {
    addRejectedCode(channel, code)
    pairingMonitor.triggerNow()
  })

  ipcMain.handle('pairing:refresh', async (_e, channel?: string) => {
    if (channel) {
      return await listPairingRequests(channel)
    }
    pairingMonitor.triggerNow()
    return pairingMonitor.getState()
  })

  log.info('All IPC handlers registered')
}
