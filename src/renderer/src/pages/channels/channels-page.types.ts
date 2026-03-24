export type DmPolicy = 'pairing' | 'allowlist' | 'open' | 'disabled'
export type GroupPolicy = 'allowlist' | 'open' | 'disabled'

export interface AgentConfig {
  id: string
  name?: string
  identity?: { name?: string; [key: string]: unknown }
  [key: string]: unknown
}

export interface BindingConfig {
  agentId: string
  match: { channel: string; accountId?: string; [key: string]: unknown }
  [key: string]: unknown
}

export interface BindingRouteRule extends BindingConfig {
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

export interface ChannelFieldDef {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
  apiKeyUrl?: string
  helpText?: string
}

export interface ChannelPresetForUI {
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

export interface ChannelConfig {
  enabled: boolean
  dmPolicy?: DmPolicy
  allowFrom?: string[]
  groupPolicy?: GroupPolicy
  groupAllowFrom?: string[]
  accounts?: Record<string, Record<string, unknown>>
  defaultAccount?: string
  [key: string]: unknown
}

export interface ChannelFormValues {
  enabled: boolean
  dmPolicy?: DmPolicy
  allowFrom?: string
  groupPolicy?: GroupPolicy
  groupAllowFrom?: string
  [key: string]: string | boolean | DmPolicy | GroupPolicy | undefined
}

export interface AccountFormValues {
  accountId: string
  [key: string]: string | undefined
}

export interface ChannelMonogramProps {
  channelKey?: string
  initials: string
  color: string
  size?: number
}

export interface EmptyChannelsStateProps {
  onAdd: () => void
  presets: ChannelPresetForUI[]
}

export interface ChannelCardProps {
  channelKey: string
  config: ChannelConfig
  preset: ChannelPresetForUI
  isCustom: boolean
  agents: AgentConfig[]
  bindings: BindingConfig[]
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  onAddAccount: () => void
  onEditAccount: (accountId: string) => void
  onDeleteAccount: (accountId: string) => void
  onSetDefaultAccount: (accountId: string) => void
  onSetBinding: (accountId: string, agentId: string | null) => void
}

export interface ChannelPickerDrawerProps {
  open: boolean
  presets: { domestic: ChannelPresetForUI[]; international: ChannelPresetForUI[] }
  configuredKeys: string[]
  onSelect: (preset: ChannelPresetForUI) => void
  onClose: () => void
}

export interface ChannelConfigDrawerProps {
  open: boolean
  preset: ChannelPresetForUI | null
  existingConfig?: ChannelConfig
  onClose: () => void
  onSave: (
    preset: ChannelPresetForUI,
    config: ChannelConfig,
    options?: { successMessage?: string }
  ) => Promise<void>
  saving: boolean
}

export interface AccountConfigDrawerProps {
  open: boolean
  preset: ChannelPresetForUI | null
  channelKey: string | null
  editingAccountId: string | null
  editingAccountData: Record<string, unknown> | null
  onClose: () => void
  onSave: (
    channelKey: string,
    accountId: string,
    data: Record<string, unknown>,
    options?: { successMessage?: string }
  ) => Promise<void>
  saving: boolean
}

export interface BindingRulesDrawerProps {
  open: boolean
  rules: BindingRouteRule[]
  loading: boolean
  agents: AgentConfig[]
  channels: Record<string, ChannelConfig>
  presets: ChannelPresetForUI[]
  onClose: () => void
  onRefresh: () => Promise<void>
}
