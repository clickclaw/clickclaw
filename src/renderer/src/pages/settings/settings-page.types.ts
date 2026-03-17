import type { Dispatch, ReactNode, RefObject, SetStateAction } from 'react'

export interface SettingRowProps {
  label: string
  desc?: string
  control: ReactNode
  last?: boolean
  highlight?: boolean
}

export interface SectionProps {
  title: string
  children: ReactNode
}

export interface ProxyState {
  enabled: boolean
  url: string
  bypass: string
}

export interface VetterModelGroup {
  providerKey: string
  providerName: string
  models: Array<{ id: string; name: string }>
}

export interface ProxySectionProps {
  gwState: GatewayState
  savedProxy: ProxyState
  draftProxy: ProxyState
  setDraftProxy: Dispatch<SetStateAction<ProxyState>>
  setProxyTestResult: Dispatch<
    SetStateAction<{ ok: boolean; latencyMs?: number; error?: string } | null>
  >
  proxyDirty: boolean
  proxySaving: boolean
  proxyJustSaved: boolean
  proxyTesting: boolean
  proxyTestResult: { ok: boolean; latencyMs?: number; error?: string } | null
  handleProxySave: () => Promise<void>
  handleProxyTest: () => Promise<void>
}

export interface VersionsSectionProps {
  version: string
  updateInfo: UpdateInfo
  openclawUpdateInfo: OpenclawUpdateInfo
  openclawInstalling: boolean
  openclawLogLines: string[]
  logEndRef: RefObject<HTMLDivElement | null>
  handleCheckOpenclawUpdate: () => Promise<void>
  handleInstallOpenclawUpdate: (versionToInstall: string) => Promise<void>
}

export interface GeneralSectionProps {
  language: string
  onChangeLanguage: (lang: 'zh-CN' | 'en') => void
  launchAtLogin: boolean
  onChangeLaunchAtLogin: (val: boolean) => Promise<void>
}

export interface GatewaySectionProps {
  gwState: GatewayState
  gatewayToken: string
  editPort: number
  setEditPort: Dispatch<SetStateAction<number>>
  savingPort: boolean
  portDirty: boolean
  portJustSaved: boolean
  autoStart: boolean
  onSavePort: () => Promise<void>
  onChangeAutoStart: (val: boolean) => Promise<void>
  openclawDir?: string
  onOpenPath: (path: string) => void
}

export interface RemotePresetsSectionProps {
  status: RemotePresetsStatus | null
  refreshing: boolean
  onRefresh: () => Promise<void>
}

export interface SecuritySectionProps {
  vetterEnabled: boolean
  vetterUseCustom: boolean
  vetterCustomModel: string
  vetterModelGroups: VetterModelGroup[]
  onChangeVetterEnabled: (val: boolean) => Promise<void>
  onChangeVetterMode: (useCustom: boolean) => Promise<void>
  onChangeVetterCustomModel: (val: string) => Promise<void>
}

export interface LogsSectionProps {
  logDir?: string
  onOpenPath: (path: string) => void
}
