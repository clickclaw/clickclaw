import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  // ========== 共享类型 ==========

  /** 环境检测结果 */
  interface DetectionResult {
    existingConfig: {
      found: boolean
      valid: boolean
      hasProviders: boolean
      hasChannels: boolean
      agentCount: number
    }
    existingGateway: {
      running: boolean
      port: number
      pid: number | null
    }
    bundledOpenclaw: {
      version: string
      nodeVersion: string
    }
  }

  /** Provider 子平台 */
  interface ProviderPlatform {
    key: string
    name: string
    baseUrl: string
    api: string
    apiKeyUrl: string
    envKey: string
    models: Array<{ id: string; name: string; input: Array<'text' | 'image'> }>
  }

  /** Provider 预设 */
  interface ProviderPresetForUI {
    key: string
    name: string
    group: 'international' | 'china'
    recommendedRank?: number
    logoUrl?: string
    description?: string
    /** 品牌主色（十六进制），用于 Monogram 头像背景 */
    color: string
    /** 2 字母缩写，Monogram 头像文字 */
    initials: string
    /** 品牌简短描述，显示在品牌选择器 */
    tagline?: string
    platforms: ProviderPlatform[]
  }

  interface ProviderPresetSection {
    key: 'recommended' | 'china' | 'international'
    title: string
    description?: string
    items: ProviderPresetForUI[]
  }

  /** API Key 验证结果 */
  interface VerifyResult {
    success: boolean
    message?: string
  }

  /** Gateway 状态 */
  type GatewayState = 'stopped' | 'starting' | 'running' | 'stopping'

  /** Gateway 启动结果 */
  interface GatewayStartResult {
    success: boolean
    port: number
    error?: string
  }

  /** 快照列表项 */
  interface SnapshotListItem {
    fileName: string
    timestamp: string
    source: string
    summary: string
    healthy: boolean
    size: number
  }

  /** 启动路由检测结果 */
  interface InitialRouteResult {
    route: '/dashboard' | '/setup'
    hasConfig: boolean
    detection: DetectionResult
  }

  /** CLI wrapper 安装状态 */
  interface CliStatus {
    installed: boolean
    wrapperPath: string
    wrapperExists: boolean
    inPath: boolean
  }

  /** Agent 配置（与 main 进程定义对应） */
  interface AgentConfig {
    id: string
    default?: boolean
    name?: string
    workspace?: string
    model?: string | { primary: string; fallbacks?: string[] }
    systemPrompt?: string
    identity?: {
      name?: string
      emoji?: string
      theme?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }

  /** Provider 配置 */
  interface ProviderConfig {
    apiKey?: string
    baseUrl?: string
    api?: 'anthropic-messages' | 'openai-completions' | 'openai-responses' | 'google-generative-ai'
    models?: Array<{
      id: string
      name?: string
      input?: string[]
    }>
    [key: string]: unknown
  }

  /** 模型测试参数 */
  interface ModelTestParams {
    baseUrl: string
    api: string
    apiKey: string
    modelId: string
  }

  /** 模型测试结果 */
  interface ModelTestResult {
    success: boolean
    latencyMs?: number
    error?: string
  }

  /** 远程列表获取参数 */
  interface FetchRemoteListParams {
    baseUrl: string
    apiKey: string
  }

  /** 默认模型配置 */
  type DefaultModelConfig = string | { primary: string; fallbacks?: string[] } | null

  /** 渠道 DM 策略 */
  type DmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled'
  /** 渠道群组策略 */
  type GroupPolicy = 'allowlist' | 'open' | 'disabled'

  /** 渠道凭证字段定义 */
  interface ChannelFieldDef {
    key: string
    label: string
    type: 'text' | 'password' | 'select'
    required: boolean
    placeholder?: string
    options?: Array<{ label: string; value: string }>
    apiKeyUrl?: string
    helpText?: string
  }

  /** 渠道预设（含 key，供 UI 使用） */
  interface ChannelPresetForUI {
    key: string
    name: string
    group: 'domestic' | 'international'
    color: string
    initials: string
    tagline?: string
    docsUrl?: string
    fields: ChannelFieldDef[]
    dmPolicies: DmPolicy[]
    supportsGroup: boolean
    groupPolicies: GroupPolicy[]
  }

  /** 渠道运行时配置 */
  interface ChannelConfig {
    enabled: boolean
    dmPolicy?: DmPolicy
    allowFrom?: string[]
    groupPolicy?: GroupPolicy
    groupAllowFrom?: string[]
    [key: string]: unknown
  }

  /** 渠道凭证验证结果 */
  interface ChannelVerifyResult {
    success: boolean
    message?: string
  }

  /** Provider 模型分组（用于 Agent 模型选择下拉） */
  interface ProviderModelGroup {
    providerKey: string
    providerName: string
    color: string
    models: Array<{ id: string; name: string }>
  }

  /** Binding 配置（渠道账户 → Agent 路由） */
  interface BindingConfig {
    agentId: string
    match: { channel: string; accountId?: string; [key: string]: unknown }
    [key: string]: unknown
  }

  interface BindingRouteRule extends BindingConfig {
    id: string
    type?: 'route'
    priority?: number
    match: {
      channel: string
      accountId?: string
      peer?: { kind: string; id: string }
      guildId?: string
      teamId?: string
      roles?: string[]
      [key: string]: unknown
    }
  }

  /** App 状态（UI 持久化） */
  interface AppState {
    setupCompleted?: boolean
    sidebarCollapsed: boolean
    autoStartGateway: boolean
    dashboardGuideMode?: 'auto' | 'always' | 'hidden'
    hasGatewayStartedOnce?: boolean
    hasSeenConfigFoundDialog?: boolean
    windowBounds: { x: number; y: number; width: number; height: number } | null
  }

  /** 应用数据目录路径 */
  interface AppDataPaths {
    logDir: string
    openclawDir: string
  }

  /** 自动更新状态 */
  type UpdateStatus =
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'

  /** 自动更新信息快照 */
  interface UpdateInfo {
    status: UpdateStatus
    /** 可用的新版本号 */
    version?: string
    /** 下载进度 0~100 */
    progress?: number
    /** 错误信息 */
    error?: string
  }

  /** OpenClaw JSONL 日志条目 */
  interface OpenclawLogEntry {
    time: string
    level: string
    subsystem?: string
    message: string
    [key: string]: unknown
  }

  /** 完整归档结果 */
  interface FullBackupResult {
    success: boolean
    archivePath?: string
    error?: string
  }

  /** Skill 市场信息 */
  interface SkillMarketplaceInfo {
    id: string
    name: string
    baseUrl: string
  }

  /** Skill 搜索结果 */
  interface SkillSearchResult {
    slug: string
    displayName: string
    summary: string
    version: string
    updatedAt: number
    score?: number
  }

  /** Skill 浏览列表项 */
  interface SkillBrowseItem {
    slug: string
    displayName: string
    summary: string
    stats: { downloads?: number; stars?: number }
    updatedAt: number
    latestVersion?: { version: string }
  }

  /** Skill 浏览结果（含翻页游标） */
  interface SkillBrowseResult {
    items: SkillBrowseItem[]
    nextCursor: string | null
  }

  /** 已安装 Skill 信息 */
  interface InstalledSkillInfo {
    dirName: string
    filePath: string
    /** skill 目录绝对路径（卸载时使用此路径） */
    baseDir: string
    name: string
    description?: string
    version?: string
    author?: string
    emoji?: string
    /** 简化来源分类（向后兼容），建议使用 rawSource 做精确判断 */
    source: 'workspace' | 'managed' | 'bundled' | 'extra'
    /** Gateway 返回的原始来源字符串，如 openclaw-bundled / openclaw-extra / agents-skills-personal */
    rawSource?: string
    /** 是否为系统内置/扩展（rawSource 以 openclaw- 开头），不可卸载 */
    isSystem?: boolean
    /** 是否满足所有运行前置条件 */
    eligible?: boolean
    /** 缺少的运行前置条件（eligible=false 时有值） */
    missing?: {
      bins?: string[]
      anyBins?: string[]
      env?: string[]
      config?: string[]
      os?: string[]
    }
    /** openclaw.json 中的 config key */
    skillKey?: string
    /** 当前是否启用（来自 skills.status RPC，目录扫描时为 undefined） */
    enabled?: boolean
    /** 运行时错误信息（来自 skills.status RPC） */
    error?: string
    /** 该 Skill 所需 API Key 对应的环境变量名（如 OPENAI_API_KEY），有值则可设置 API Key */
    primaryEnv?: string
    /** 是否为始终启用状态（不可关闭） */
    always?: boolean
  }

  /** Skill 安装结果 */
  interface SkillInstallResult {
    success: boolean
    error?: string
  }

  /** Skill 安全审查结果 */
  interface VetResult {
    slug: string
    version: string
    riskLevel: 'low' | 'medium' | 'high' | 'extreme'
    verdict: 'safe' | 'caution' | 'unsafe'
    redFlags: string[]
    permissions: { files: string[]; network: string[]; commands: string[] }
    notes: string
    rawReport: string
    vetAt: number
  }

  /** Skill 安全审查设置 */
  interface SkillVetterSettings {
    enabled: boolean
    customModel: string | null
  }

  /** Skill 审查进度事件 */
  interface VetProgressEvent {
    stage: 'downloading' | 'parsing' | 'analyzing' | 'done'
    message?: string
    /** 流式输出的文本块（仅 analyzing 阶段有） */
    chunk?: string
  }

  /** 远程预设状态快照 */
  interface RemotePresetsStatus {
    fetchedAt: string | null
    providerCount: number
    fetching: boolean
  }

  /** 远程预设刷新结果 */
  interface RemotePresetsRefreshResult {
    success: boolean
    error?: string
  }

  /** OpenClaw 升级状态 */
  type OpenclawUpdateStatus =
    | 'idle'
    | 'checking'
    | 'up-to-date'
    | 'available'
    | 'installing'
    | 'done'
    | 'error'

  /** OpenClaw 升级信息 */
  interface OpenclawUpdateInfo {
    status: OpenclawUpdateStatus
    /** 当前运行版本（用户目录优先，回退内置） */
    currentVersion: string
    /** npm registry 上的最新版本 */
    latestVersion?: string
    error?: string
    /** npm install 流式输出日志行 */
    logLines: string[]
  }

  interface ProxySettings {
    proxyEnabled: boolean
    proxyUrl: string
    proxyBypass: string
  }

  interface PairingRequestForUI {
    code: string
    id: string
    name: string
    createdAt: string
    lastSeenAt: string
    channel: string
  }

  interface PairingChannelStateForUI {
    channel: string
    pendingCount: number
    requests: Array<Omit<PairingRequestForUI, 'channel'>>
  }

  interface PairingStateForUI {
    pendingCount: number
    requests: PairingRequestForUI[]
    channels: Record<string, PairingChannelStateForUI>
    updatedAt: number
  }

  // ========== API 定义 ==========

  interface ClickClawAPI {
    getVersion: () => Promise<string>

    /** 应用级操作 */
    app: {
      getInitialRoute: () => Promise<InitialRouteResult>
      autoStartGateway: () => Promise<GatewayStartResult>
      /** 显示主窗口（托盘弹窗调用） */
      showMainWindow: () => void
      /** 退出应用（托盘弹窗调用） */
      quit: () => void
    }

    /** 环境检测 */
    runtime: {
      detect: () => Promise<DetectionResult>
      getMode: () => Promise<'bundled'>
    }

    /** Gateway 管理 */
    gateway: {
      start: () => Promise<GatewayStartResult>
      startWithRecovery: () => Promise<GatewayStartResult>
      stop: () => Promise<void>
      restart: () => Promise<GatewayStartResult>
      getState: () => Promise<GatewayState>
      getPort: () => Promise<number>
      getToken: () => Promise<string>
      /** 获取主进程日志环形缓冲（最多 500 条），供页面挂载时加载历史日志 */
      getLogBuffer: () => Promise<string[]>
      /** 构建 Ed25519 connect 握手帧（含签名），传入 Gateway challenge 的 nonce */
      buildConnectFrame: (nonce: string) => Promise<object>
      /** 获取本机 deviceId（SHA-256 公钥哈希，64字符十六进制） */
      getDeviceId: () => Promise<string>
      /**
       * 自动配对：写入 allowedOrigins，不重启 Gateway
       * 调用方在调用后自行决定是否重启
       */
      autoPairDevice: () => Promise<{ success: boolean; deviceId: string }>
      /** 持久化 Gateway 颁发的 deviceToken */
      storeDeviceToken: (
        deviceId: string,
        role: string,
        token: string,
        scopes: string[]
      ) => Promise<void>
      /** 清除 deviceToken（TOKEN_MISMATCH 时使用，下次重新用 gatewayToken 签名） */
      clearDeviceToken: (deviceId: string, role: string) => Promise<void>
      onStateChange: (callback: (state: GatewayState) => void) => () => void
      onLog: (callback: (line: string) => void) => () => void
    }

    /** 配置管理 */
    config: {
      read: () => Promise<Record<string, unknown>>
      write: (config: Record<string, unknown>) => Promise<void>
      getSnapshots: () => Promise<SnapshotListItem[]>
      restoreSnapshot: (fileName: string) => Promise<void>
    }

    /** Provider */
    provider: {
      getPresets: () => Promise<ProviderPresetSection[]>
      verify: (
        providerKey: string,
        platformKey: string,
        apiKey: string,
        modelId: string
      ) => Promise<VerifyResult>
    }

    /** Setup 向导 */
    setup: {
      /** 完成向导：写入配置 + .env + 启动 Gateway */
      complete: (data: {
        providerKey: string
        platformKey: string
        apiKey: string
        modelId: string
        channels?: Record<string, Record<string, unknown>>
      }) => Promise<GatewayStartResult>
    }

    /** 系统操作 */
    shell: {
      openExternal: (url: string) => Promise<void>
      openPath: (path: string) => Promise<string>
    }

    /** CLI 集成 */
    cli: {
      getStatus: () => Promise<CliStatus>
      install: () => Promise<void>
      uninstall: () => Promise<void>
    }

    /** 开机自启 */
    launch: {
      /** 获取当前是否已启用开机自启 */
      getStatus: () => Promise<boolean>
      /** 设置开机自启（true 启用 / false 禁用） */
      setEnabled: (enabled: boolean) => Promise<void>
    }

    /** 自动更新 */
    update: {
      /** 获取当前更新状态快照 */
      getInfo: () => Promise<UpdateInfo>
      /** 手动触发检查更新 */
      check: () => Promise<void>
      /** 开始下载（available 状态时有效） */
      download: () => Promise<void>
      /** 退出并安装（downloaded 状态时有效） */
      install: () => Promise<void>
      /** 订阅状态推送（主进程 → renderer） */
      onStatusChanged: (callback: (info: UpdateInfo) => void) => () => void
    }

    /** Agent 管理 */
    agent: {
      list: () => Promise<AgentConfig[]>
      save: (agent: Partial<AgentConfig> & { id?: string }) => Promise<AgentConfig>
      delete: (agentId: string) => Promise<void>
      setDefault: (agentId: string) => Promise<void>
    }

    /** Model/Provider 管理 */
    model: {
      listProviders: () => Promise<Record<string, ProviderConfig>>
      saveProvider: (name: string, config: ProviderConfig) => Promise<void>
      deleteProvider: (name: string) => Promise<void>
      getDefault: () => Promise<DefaultModelConfig>
      setDefault: (primary: string, fallbacks: string[]) => Promise<void>
      test: (params: ModelTestParams) => Promise<ModelTestResult>
      fetchRemoteList: (params: FetchRemoteListParams) => Promise<string[]>
      getPresetModels: () => Promise<ProviderModelGroup[]>
    }

    /** 渠道管理 */
    channel: {
      getPresets: () => Promise<{
        domestic: ChannelPresetForUI[]
        international: ChannelPresetForUI[]
      }>
      list: () => Promise<Record<string, ChannelConfig>>
      save: (key: string, config: ChannelConfig) => Promise<void>
      delete: (key: string) => Promise<void>
      verify: (key: string, fields: Record<string, string>) => Promise<ChannelVerifyResult>
      saveAccount: (
        channelKey: string,
        accountId: string,
        data: Record<string, unknown>
      ) => Promise<void>
      deleteAccount: (channelKey: string, accountId: string) => Promise<void>
      setDefaultAccount: (channelKey: string, accountId: string) => Promise<void>
      wecomScanStart: () => Promise<{ scode: string; authUrl: string }>
      wecomScanWait: (
        scode: string,
        timeoutMs?: number
      ) => Promise<{ botId: string; secret: string }>
      feishuScanStart: (domain?: 'feishu' | 'lark') => Promise<{
        deviceCode: string
        authUrl: string
        intervalSec: number
        expireInSec: number
        domain: 'feishu' | 'lark'
      }>
      feishuScanWait: (
        deviceCode: string,
        options?: {
          domain?: 'feishu' | 'lark'
          intervalSec?: number
          timeoutMs?: number
        }
      ) => Promise<{
        appId: string
        appSecret: string
        domain: 'feishu' | 'lark'
        openId?: string
      }>
      weixinScanStart: (params?: {
        accountId?: string
        force?: boolean
        timeoutMs?: number
      }) => Promise<{
        qrDataUrl?: string
        message: string
        sessionKey: string
      }>
      weixinScanWait: (params: {
        sessionKey?: string
        accountId?: string
        timeoutMs?: number
      }) => Promise<{
        connected: boolean
        message: string
        accountId?: string
      }>
      weixinScanCancel: (sessionKey?: string) => Promise<void>
      weixinLogout: (accountId: string) => Promise<void>
      getWeixinStatus: () => Promise<{
        bundled: boolean
        installedToUserDir: boolean
        enabled: boolean
        configMissing: boolean
      }>
    }

    /** 路由绑定管理 */
    binding: {
      list: () => Promise<BindingConfig[]>
      save: (agentId: string, channel: string, accountId: string) => Promise<void>
      delete: (channel: string, accountId: string) => Promise<void>
      listRules: () => Promise<BindingRouteRule[]>
      saveRule: (rule: Omit<BindingRouteRule, 'id'> & { id?: string }) => Promise<BindingRouteRule>
      deleteRule: (id: string) => Promise<void>
      reorder: (ids: string[]) => Promise<BindingRouteRule[]>
    }

    /** App 状态持久化（侧栏折叠、窗口位置） */
    appState: {
      get: () => Promise<AppState>
      set: (
        patch: Partial<
          Pick<
            AppState,
            | 'sidebarCollapsed'
            | 'windowBounds'
            | 'autoStartGateway'
            | 'dashboardGuideMode'
            | 'hasGatewayStartedOnce'
            | 'hasSeenConfigFoundDialog'
            | 'setupCompleted'
          >
        >
      ) => Promise<void>
    }

    /** 应用数据路径 */
    appPaths: {
      get: () => Promise<AppDataPaths>
    }

    /** 日志读取 */
    log: {
      readClickclaw: () => Promise<string[]>
      getOpenclawLogPath: () => Promise<string>
      readOpenclaw: (opts?: { limit?: number; level?: string }) => Promise<OpenclawLogEntry[]>
      write: (entry: {
        level?: 'info' | 'warn' | 'error' | 'debug'
        tag?: string
        message: string
      }) => Promise<void>
    }

    /** 配置备份管理 */
    backup: {
      listSnapshots: () => Promise<SnapshotListItem[]>
      createSnapshot: () => Promise<string | null>
      restoreSnapshot: (fileName: string) => Promise<void>
      createFull: (outputDir: string) => Promise<FullBackupResult>
    }

    /** 系统对话框 */
    dialog: {
      showSaveDialog: (opts: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
    }

    /** Skill 市场管理 */
    skill: {
      /** 列出所有已注册的 skill 市场 */
      listMarketplaces: () => Promise<SkillMarketplaceInfo[]>
      /** 在指定市场中搜索 skills */
      search: (
        marketplaceId: string,
        query: string,
        opts?: { limit?: number }
      ) => Promise<SkillSearchResult[]>
      /** 浏览指定市场的 skill 列表 */
      browse: (
        marketplaceId: string,
        opts?: { limit?: number; sort?: string; cursor?: string }
      ) => Promise<SkillBrowseResult>
      /** 从指定市场下载并安装 skill */
      install: (
        marketplaceId: string,
        slug: string,
        version?: string,
        installDir?: string
      ) => Promise<SkillInstallResult>
      /** 列出本地已安装的 skills */
      listInstalled: () => Promise<InstalledSkillInfo[]>
      /** 卸载本地 skill（传入 baseDir 绝对路径） */
      uninstall: (baseDir: string) => Promise<void>
      /** 读取 SKILL.md 内容 */
      readMd: (filePath: string) => Promise<string>
      /** 将 skill 目录导出为 ZIP 文件 */
      exportZip: (
        baseDir: string,
        skillName: string
      ) => Promise<{ canceled: boolean; filePath?: string }>
      /** 打开 skills 目录 */
      openDir: () => Promise<string>
      /** 安装前安全审查（下载 ZIP + AI 分析），返回风险报告 */
      vet: (
        marketplaceId: string,
        slug: string,
        version?: string,
        locale?: string
      ) => Promise<VetResult>
      /** 取消正在进行的安全审查 */
      vetCancel: (slug: string, version?: string) => void
      /** 订阅审查进度事件，返回取消订阅函数 */
      onVetProgress: (callback: (event: VetProgressEvent) => void) => () => void
      /** 获取/保存安全审查设置 */
      vetSettings: {
        get: () => Promise<SkillVetterSettings>
        save: (s: SkillVetterSettings) => Promise<void>
      }
    }

    /** 窗口控制（自定义标题栏，非 macOS 使用） */
    win: {
      minimize: () => void
      maximize: () => void
      close: () => void
      isMaximized: () => Promise<boolean>
      /** 当前平台，如 'darwin' | 'win32' | 'linux' */
      platform: string
    }

    /** 远程预设管理（模型数据源） */
    remotePresets: {
      /** 获取当前状态（拉取时间、Provider 数量） */
      getStatus: () => Promise<RemotePresetsStatus>
      /** 手动触发拉取并刷新缓存 */
      refresh: () => Promise<RemotePresetsRefreshResult>
    }

    /** OpenClaw 版本升级（仅 bundled 模式下有完整功能） */
    openclawUpdate: {
      /** 检查 npm registry 上的最新版本 */
      check: () => Promise<OpenclawUpdateInfo>
      /** 执行升级（npm install openclaw@version 到用户目录） */
      install: (version: string) => Promise<{ success: boolean; error?: string }>
      /** 获取当前版本信息 */
      getInfo: () => Promise<{ currentVersion: string }>
      /** 订阅 npm install 日志推送 */
      onLog: (cb: (line: string) => void) => void
      /** 取消订阅日志推送 */
      offLog: () => void
    }

    /** 代理设置 */
    proxy: {
      get: () => Promise<ProxySettings>
      set: (patch: Partial<ProxySettings>) => Promise<ProxySettings>
      test: (opts?: {
        proxyUrl?: string
        proxyBypass?: string
      }) => Promise<{ ok: boolean; latencyMs?: number; error?: string }>
    }

    /** 配对审批 */
    pairing: {
      getState: () => Promise<PairingStateForUI>
      approve: (channel: string, code: string) => Promise<{ success: boolean; message?: string }>
      reject: (channel: string, code: string) => Promise<void>
      refresh: (
        channel?: string
      ) => Promise<PairingStateForUI | Array<Omit<PairingRequestForUI, 'channel'>>>
      onStateChanged: (callback: (state: PairingStateForUI) => void) => () => void
    }
  }

  interface Window {
    electron: ElectronAPI
    api: ClickClawAPI
  }
}
