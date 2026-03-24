export interface AgentConfig {
  id: string
  default?: boolean
  name?: string
  workspace?: string
  agentDir?: string
  model?: string | { primary: string; fallbacks?: string[] }
  identity?: {
    name?: string
    emoji?: string
    theme?: string
    [key: string]: unknown
  }
  tools?: {
    profile?: 'minimal' | 'coding' | 'messaging' | 'full'
    allow?: string[]
    deny?: string[]
    elevated?: { enabled?: boolean }
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface AgentFormValues {
  id: string
  displayName?: string
  emoji?: string
  theme?: string
  model?: string
  toolsProfile?: 'minimal' | 'coding' | 'messaging' | 'full'
  setAsDefault?: boolean
}

export interface ToolCatalogEntry {
  id: string
  label: string
  description: string
  source: 'core' | 'plugin'
  optional?: boolean
  pluginId?: string
  defaultProfiles: string[]
}

export interface ToolCatalogGroup {
  id: string
  label: string
  source: 'core' | 'plugin'
  pluginId?: string
  tools: ToolCatalogEntry[]
}

export interface ToolsCatalogResult {
  agentId: string
  profiles: { id: string; label: string }[]
  groups: ToolCatalogGroup[]
}

export type ToolEffectiveState = 'profile-on' | 'profile-off' | 'custom-allow' | 'custom-deny'

export interface AgentSideItemProps {
  agent: AgentConfig
  selected: boolean
  onClick: () => void
}

export interface AgentFilesTabProps {
  agentId: string
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
}

export interface AgentChannelsTabProps {
  agentId: string
}

export interface AgentCronTabProps {
  agentId: string
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
}

export interface AgentToolsTabProps {
  agent: AgentConfig
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
  onSaveAgent: (updated: AgentConfig) => Promise<void>
}

export interface SkillEntry {
  name: string
  source?: string
  bundled?: boolean
  emoji?: string
  description?: string
  always: boolean
  disabled: boolean
  blockedByAllowlist: boolean
  eligible: boolean
  missing?: {
    bins?: string[]
    env?: string[]
    config?: string[]
    os?: string[]
  }
}

export interface AgentSkillsTabProps {
  agent: AgentConfig
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
  onSaveAgent: (updated: AgentConfig) => Promise<void>
}

export interface AgentOverviewTabProps {
  agent: AgentConfig
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
  onSaveAgent: (updated: AgentConfig) => Promise<void>
}

export interface AgentDetailPanelProps {
  agent: AgentConfig
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
  onSaveAgent: (updated: AgentConfig) => Promise<void>
  onDelete: (agent: AgentConfig) => void
  onSetDefault: (agent: AgentConfig) => void
}

export interface AgentCreateDrawerProps {
  open: boolean
  onClose: () => void
  onCreate: (values: AgentFormValues) => Promise<void>
  saving: boolean
}

export interface NoSelectionStateProps {
  onCreate: () => void
}
