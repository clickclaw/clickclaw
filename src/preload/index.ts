import { contextBridge, ipcRenderer, shell } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),

  app: {
    getInitialRoute: (): Promise<unknown> => ipcRenderer.invoke('app:get-initial-route'),
    autoStartGateway: (): Promise<unknown> => ipcRenderer.invoke('app:auto-start-gateway'),
    showMainWindow: (): void => ipcRenderer.send('app:show-main-window'),
    quit: (): void => ipcRenderer.send('app:quit'),
  },

  runtime: {
    detect: (): Promise<unknown> => ipcRenderer.invoke('runtime:detect'),
    getMode: (): Promise<string> => ipcRenderer.invoke('runtime:get-mode'),
  },

  gateway: {
    start: (): Promise<unknown> => ipcRenderer.invoke('gateway:start'),
    startWithRecovery: (): Promise<unknown> => ipcRenderer.invoke('gateway:start-with-recovery'),
    stop: (): Promise<void> => ipcRenderer.invoke('gateway:stop'),
    restart: (): Promise<unknown> => ipcRenderer.invoke('gateway:restart'),
    getState: (): Promise<string> => ipcRenderer.invoke('gateway:get-state'),
    getPort: (): Promise<number> => ipcRenderer.invoke('gateway:get-port'),
    getToken: (): Promise<string> => ipcRenderer.invoke('gateway:get-token'),
    getLogBuffer: (): Promise<string[]> => ipcRenderer.invoke('gateway:get-log-buffer'),
    buildConnectFrame: (nonce: string): Promise<object> =>
      ipcRenderer.invoke('gateway:build-connect-frame', nonce),
    getDeviceId: (): Promise<string> => ipcRenderer.invoke('gateway:get-device-id'),
    autoPairDevice: (): Promise<{ success: boolean; deviceId: string }> =>
      ipcRenderer.invoke('gateway:auto-pair-device'),
    storeDeviceToken: (
      deviceId: string,
      role: string,
      token: string,
      scopes: string[]
    ): Promise<void> =>
      ipcRenderer.invoke('gateway:store-device-token', deviceId, role, token, scopes),
    clearDeviceToken: (deviceId: string, role: string): Promise<void> =>
      ipcRenderer.invoke('gateway:clear-device-token', deviceId, role),
    onStateChange: (callback: (state: string) => void): (() => void) => {
      const listener = (_event: unknown, state: string): void => callback(state)
      ipcRenderer.on('gateway:state-changed', listener)
      return () => ipcRenderer.removeListener('gateway:state-changed', listener)
    },
    onLog: (callback: (line: string) => void): (() => void) => {
      const listener = (_event: unknown, line: string): void => callback(line)
      ipcRenderer.on('gateway:log', listener)
      return () => ipcRenderer.removeListener('gateway:log', listener)
    },
  },

  config: {
    read: (): Promise<unknown> => ipcRenderer.invoke('config:read'),
    write: (config: unknown): Promise<void> => ipcRenderer.invoke('config:write', config),
    getSnapshots: (): Promise<unknown[]> => ipcRenderer.invoke('config:get-snapshots'),
    restoreSnapshot: (fileName: string): Promise<void> =>
      ipcRenderer.invoke('config:restore-snapshot', fileName),
  },

  provider: {
    getPresets: (): Promise<unknown> => ipcRenderer.invoke('provider:get-presets'),
    verify: (
      providerKey: string,
      platformKey: string,
      apiKey: string,
      modelId: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('provider:verify', providerKey, platformKey, apiKey, modelId),
  },

  setup: {
    complete: (data: unknown): Promise<unknown> => ipcRenderer.invoke('setup:complete', data),
  },

  shell: {
    openExternal: (url: string): Promise<void> => shell.openExternal(url),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:open-path', path),
  },

  cli: {
    getStatus: (): Promise<unknown> => ipcRenderer.invoke('cli:get-status'),
    install: (): Promise<void> => ipcRenderer.invoke('cli:install'),
    uninstall: (): Promise<void> => ipcRenderer.invoke('cli:uninstall'),
  },

  launch: {
    getStatus: (): Promise<boolean> => ipcRenderer.invoke('launch:get-status'),
    setEnabled: (enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('launch:set-enabled', enabled),
  },

  update: {
    getInfo: (): Promise<unknown> => ipcRenderer.invoke('update:get-info'),
    check: (): Promise<void> => ipcRenderer.invoke('update:check'),
    download: (): Promise<void> => ipcRenderer.invoke('update:download'),
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    onStatusChanged: (callback: (info: unknown) => void): (() => void) => {
      const listener = (_event: unknown, info: unknown): void => callback(info)
      ipcRenderer.on('update:status-changed', listener)
      return () => ipcRenderer.removeListener('update:status-changed', listener)
    },
  },

  agent: {
    list: (): Promise<unknown[]> => ipcRenderer.invoke('agent:list'),
    save: (agent: unknown): Promise<unknown> => ipcRenderer.invoke('agent:save', agent),
    delete: (agentId: string): Promise<void> => ipcRenderer.invoke('agent:delete', agentId),
    setDefault: (agentId: string): Promise<void> =>
      ipcRenderer.invoke('agent:set-default', agentId),
  },

  model: {
    listProviders: (): Promise<unknown> => ipcRenderer.invoke('model:list-providers'),
    saveProvider: (name: string, config: unknown): Promise<void> =>
      ipcRenderer.invoke('model:save-provider', name, config),
    deleteProvider: (name: string): Promise<void> =>
      ipcRenderer.invoke('model:delete-provider', name),
    getDefault: (): Promise<unknown> => ipcRenderer.invoke('model:get-default'),
    setDefault: (primary: string, fallbacks: string[]): Promise<void> =>
      ipcRenderer.invoke('model:set-default', primary, fallbacks),
    test: (params: unknown): Promise<unknown> => ipcRenderer.invoke('model:test', params),
    fetchRemoteList: (params: unknown): Promise<string[]> =>
      ipcRenderer.invoke('model:fetch-remote-list', params),
    getPresetModels: (): Promise<unknown[]> => ipcRenderer.invoke('model:get-preset-models'),
  },

  channel: {
    getPresets: (): Promise<unknown> => ipcRenderer.invoke('channel:get-presets'),
    list: (): Promise<unknown> => ipcRenderer.invoke('channel:list'),
    save: (key: string, config: unknown): Promise<void> =>
      ipcRenderer.invoke('channel:save', key, config),
    delete: (key: string): Promise<void> => ipcRenderer.invoke('channel:delete', key),
    verify: (key: string, fields: unknown): Promise<unknown> =>
      ipcRenderer.invoke('channel:verify', key, fields),
    saveAccount: (channelKey: string, accountId: string, data: unknown): Promise<void> =>
      ipcRenderer.invoke('channel:save-account', channelKey, accountId, data),
    deleteAccount: (channelKey: string, accountId: string): Promise<void> =>
      ipcRenderer.invoke('channel:delete-account', channelKey, accountId),
    setDefaultAccount: (channelKey: string, accountId: string): Promise<void> =>
      ipcRenderer.invoke('channel:set-default-account', channelKey, accountId),
    wecomScanStart: (): Promise<{ scode: string; authUrl: string }> =>
      ipcRenderer.invoke('channel:wecom-scan-start'),
    wecomScanWait: (
      scode: string,
      timeoutMs?: number
    ): Promise<{ botId: string; secret: string }> =>
      ipcRenderer.invoke('channel:wecom-scan-wait', scode, timeoutMs),
    feishuScanStart: (
      domain?: 'feishu' | 'lark'
    ): Promise<{
      deviceCode: string
      authUrl: string
      intervalSec: number
      expireInSec: number
      domain: 'feishu' | 'lark'
    }> => ipcRenderer.invoke('channel:feishu-scan-start', domain),
    feishuScanWait: (
      deviceCode: string,
      options?: {
        domain?: 'feishu' | 'lark'
        intervalSec?: number
        timeoutMs?: number
      }
    ): Promise<{
      appId: string
      appSecret: string
      domain: 'feishu' | 'lark'
      openId?: string
    }> => ipcRenderer.invoke('channel:feishu-scan-wait', deviceCode, options),
    weixinScanStart: (params?: {
      accountId?: string
      force?: boolean
      timeoutMs?: number
    }): Promise<{
      qrDataUrl?: string
      message: string
      sessionKey: string
    }> => ipcRenderer.invoke('channel:weixin-scan-start', params),
    weixinScanWait: (params: {
      sessionKey?: string
      accountId?: string
      timeoutMs?: number
    }): Promise<{
      connected: boolean
      message: string
      accountId?: string
    }> => ipcRenderer.invoke('channel:weixin-scan-wait', params),
    weixinScanCancel: (sessionKey?: string): Promise<void> =>
      ipcRenderer.invoke('channel:weixin-scan-cancel', sessionKey),
    weixinLogout: (accountId: string): Promise<void> =>
      ipcRenderer.invoke('channel:weixin-logout', accountId),
    getWeixinStatus: (): Promise<{
      bundled: boolean
      installedToUserDir: boolean
      enabled: boolean
      configMissing: boolean
    }> => ipcRenderer.invoke('channel:weixin-status'),
  },

  binding: {
    list: (): Promise<unknown[]> => ipcRenderer.invoke('binding:list'),
    listRules: (): Promise<unknown[]> => ipcRenderer.invoke('binding:list-rules'),
    save: (agentId: string, channel: string, accountId: string): Promise<void> =>
      ipcRenderer.invoke('binding:save', agentId, channel, accountId),
    saveRule: (rule: unknown): Promise<unknown> => ipcRenderer.invoke('binding:save-rule', rule),
    delete: (channel: string, accountId: string): Promise<void> =>
      ipcRenderer.invoke('binding:delete', channel, accountId),
    deleteRule: (id: string): Promise<void> => ipcRenderer.invoke('binding:delete-rule', id),
    reorder: (ids: string[]): Promise<unknown[]> => ipcRenderer.invoke('binding:reorder', ids),
  },

  appState: {
    get: (): Promise<unknown> => ipcRenderer.invoke('app-state:get'),
    set: (patch: unknown): Promise<void> => ipcRenderer.invoke('app-state:set', patch),
  },

  appPaths: {
    get: (): Promise<unknown> => ipcRenderer.invoke('app:get-data-paths'),
  },

  log: {
    readClickclaw: (): Promise<string[]> => ipcRenderer.invoke('log:read-clickclaw'),
    getOpenclawLogPath: (): Promise<string> => ipcRenderer.invoke('log:get-openclaw-log-path'),
    readOpenclaw: (opts?: { limit?: number; level?: string }): Promise<unknown[]> =>
      ipcRenderer.invoke('log:read-openclaw', opts),
    write: (entry: {
      level?: 'info' | 'warn' | 'error' | 'debug'
      tag?: string
      message: string
    }): Promise<void> => ipcRenderer.invoke('log:write', entry),
  },

  backup: {
    listSnapshots: (): Promise<unknown[]> => ipcRenderer.invoke('backup:list-snapshots'),
    createSnapshot: (): Promise<string | null> => ipcRenderer.invoke('backup:create-snapshot'),
    restoreSnapshot: (fileName: string): Promise<void> =>
      ipcRenderer.invoke('backup:restore-snapshot', fileName),
    createFull: (outputDir: string): Promise<unknown> =>
      ipcRenderer.invoke('backup:create-full', outputDir),
  },

  dialog: {
    showSaveDialog: (opts: unknown): Promise<unknown> =>
      ipcRenderer.invoke('dialog:show-save', opts),
  },

  skill: {
    listMarketplaces: (): Promise<unknown> => ipcRenderer.invoke('skill:list-marketplaces'),
    search: (marketplaceId: string, query: string, opts?: { limit?: number }): Promise<unknown> =>
      ipcRenderer.invoke('skill:search', marketplaceId, query, opts),
    browse: (
      marketplaceId: string,
      opts?: { limit?: number; sort?: string; cursor?: string }
    ): Promise<unknown> => ipcRenderer.invoke('skill:browse', marketplaceId, opts),
    install: (
      marketplaceId: string,
      slug: string,
      version?: string,
      installDir?: string
    ): Promise<unknown> =>
      ipcRenderer.invoke('skill:install', marketplaceId, slug, version, installDir),
    listInstalled: (): Promise<unknown> => ipcRenderer.invoke('skill:list-installed'),
    uninstall: (baseDir: string): Promise<void> => ipcRenderer.invoke('skill:uninstall', baseDir),
    readMd: (filePath: string): Promise<string> => ipcRenderer.invoke('skill:read-md', filePath),
    exportZip: (
      baseDir: string,
      skillName: string
    ): Promise<{ canceled: boolean; filePath?: string }> =>
      ipcRenderer.invoke('skill:export-zip', baseDir, skillName),
    openDir: (): Promise<string> => ipcRenderer.invoke('skill:open-dir'),
    vet: (
      marketplaceId: string,
      slug: string,
      version?: string,
      locale?: string
    ): Promise<unknown> => ipcRenderer.invoke('skill:vet', marketplaceId, slug, version, locale),
    vetCancel: (slug: string, version?: string): void =>
      ipcRenderer.send('skill:vet-cancel', slug, version),
    onVetProgress: (callback: (event: unknown) => void): (() => void) => {
      const listener = (_: unknown, payload: unknown) => callback(payload)
      ipcRenderer.on('skill:vet-progress', listener)
      return () => ipcRenderer.removeListener('skill:vet-progress', listener)
    },
    vetSettings: {
      get: (): Promise<unknown> => ipcRenderer.invoke('skill:vet-settings:get'),
      save: (s: unknown): Promise<void> => ipcRenderer.invoke('skill:vet-settings:save', s),
    },
  },

  // 窗口控制（自定义标题栏，非 macOS 平台使用）
  win: {
    minimize: (): void => ipcRenderer.send('window:minimize'),
    maximize: (): void => ipcRenderer.send('window:maximize'),
    close: (): void => ipcRenderer.send('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    platform: process.platform,
  },

  remotePresets: {
    getStatus: (): Promise<unknown> => ipcRenderer.invoke('remote-presets:get-status'),
    refresh: (): Promise<unknown> => ipcRenderer.invoke('remote-presets:refresh'),
  },

  proxy: {
    get: (): Promise<unknown> => ipcRenderer.invoke('proxy:get'),
    set: (patch: unknown): Promise<unknown> => ipcRenderer.invoke('proxy:set', patch),
    test: (opts?: {
      proxyUrl?: string
      proxyBypass?: string
    }): Promise<{ ok: boolean; latencyMs?: number; error?: string }> =>
      ipcRenderer.invoke('proxy:test', opts),
  },

  pairing: {
    getState: (): Promise<unknown> => ipcRenderer.invoke('pairing:get-state'),
    approve: (channel: string, code: string): Promise<{ success: boolean; message?: string }> =>
      ipcRenderer.invoke('pairing:approve', channel, code),
    reject: (channel: string, code: string): Promise<void> =>
      ipcRenderer.invoke('pairing:reject', channel, code),
    refresh: (channel?: string): Promise<unknown> => ipcRenderer.invoke('pairing:refresh', channel),
    onStateChanged: (callback: (state: unknown) => void): (() => void) => {
      const listener = (_: unknown, state: unknown) => callback(state)
      ipcRenderer.on('pairing:state-changed', listener)
      return () => ipcRenderer.removeListener('pairing:state-changed', listener)
    },
  },

  openclawUpdate: {
    check: (): Promise<unknown> => ipcRenderer.invoke('openclaw-update:check'),
    install: (version: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('openclaw-update:install', version),
    getInfo: (): Promise<{ currentVersion: string }> =>
      ipcRenderer.invoke('openclaw-update:get-info'),
    onLog: (cb: (line: string) => void): void => {
      ipcRenderer.on('openclaw-update:log', (_e, line) => cb(line))
    },
    offLog: (): void => {
      ipcRenderer.removeAllListeners('openclaw-update:log')
    },
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error -- non-contextIsolated fallback for dev
  window.electron = electronAPI
  // @ts-expect-error -- non-contextIsolated fallback for dev
  window.api = api
}
