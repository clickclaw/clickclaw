/**
 * 配置管理模块统一导出
 */

export {
  readConfig,
  readConfigRaw,
  writeConfig,
  updateConfig,
  setConfigValue,
  deleteConfigValue,
  getConfigValue,
  setProvider,
  getProviders,
  deleteProvider,
  setChannel,
  getChannel,
  getChannels,
  deleteChannel,
  saveChannelAccount,
  deleteChannelAccount,
  setChannelDefaultAccount,
  getAgents,
  saveAgent,
  deleteAgent,
  setDefaultAgent,
  setDefaultModel,
  inspectConfigHealth,
  getBindings,
  listBindingRules,
  saveBindingRule,
  deleteBindingRule,
  reorderBindingRules,
  saveBinding,
  deleteBinding,
} from './manager'

export type {
  OpenclawConfig,
  ProviderConfig,
  AgentConfig,
  ConfigHealth,
  BindingConfig,
  BindingRouteRule,
} from './manager'

export { readEnv, getEnvValue, setEnvValues, deleteEnvValue, ENV_KEYS } from './env-file'

export type { EnvEntries } from './env-file'

export {
  // 智能快照
  createSnapshot,
  markCurrentConfigHealthy,
  restoreFromSnapshot,
  restoreLastHealthy,
  listSnapshots,
  findLastHealthySnapshot,
  getRecoveryData,
  // 配置健康守卫
  inspectConfigHealth as inspectBackupHealth,
  validateConfigContent,
  // OpenClaw 原生备份联动
  createFullBackup,
  verifyFullBackup,
} from './backup'

export type {
  SnapshotSource,
  SnapshotMeta,
  ConfigSnapshot,
  SnapshotListItem,
  RecoveryData,
  FullBackupResult,
} from './backup'

export {
  PROVIDER_PRESETS,
  getAllPresets,
  getPresetsByGroup,
  getPreset,
  getPlatform,
  buildProviderConfig,
  buildCustomProviderConfig,
  verifyProvider,
  verifyProviderConfig,
} from './provider-presets'

export type {
  ProviderPreset,
  ProviderPlatform,
  ProviderPresetForUI,
  ProviderPresetSection,
  ModelDef,
  VerifyResult,
  ApiType,
} from './provider-presets'

export {
  CHANNEL_PRESETS,
  getAllChannelPresets,
  getChannelPresetsByGroup,
  getChannelPreset,
  extractChannelConfig,
  buildChannelConfig,
  verifyChannel,
} from './channel-presets'

export type {
  DmPolicy,
  GroupPolicy,
  ChannelFieldDef,
  ChannelPreset,
  ChannelPresetForUI,
  ChannelConfig,
  ChannelEntry,
  ChannelVerifyResult,
} from './channel-presets'
