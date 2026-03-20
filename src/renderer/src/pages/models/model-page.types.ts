export interface ModelDef {
  id: string
  name?: string
  input?: string[]
  recommended?: boolean
  tier?: 'primary' | 'vision' | 'advanced'
}

export type ApiType =
  | 'anthropic-messages'
  | 'openai-completions'
  | 'openai-responses'
  | 'google-generative-ai'

export interface ProviderConfig {
  apiKey?: string
  baseUrl?: string
  api?: ApiType
  models?: ModelDef[]
  [key: string]: unknown
}

export interface ProviderEntry {
  key: string
  config: ProviderConfig
}

export type TestStatus = 'idle' | 'testing' | 'ok' | 'fail'

export interface ModelTestState {
  status: TestStatus
  latencyMs?: number
  error?: string
}

export interface BrandPlatform {
  key: string
  name: string
  baseUrl: string
  api: ApiType
  apiKeyUrl: string
  models: ModelDef[]
}

export interface DisplayBrand {
  key: string
  name: string
  tagline: string
  group: 'china' | 'international'
  recommendedRank?: number
  logoUrl?: string
  color: string
  initials: string
  allKeys: string[]
  platforms: BrandPlatform[]
}

export interface DisplayBrandSection {
  key: ProviderPresetSection['key']
  items: DisplayBrand[]
}

export interface ProviderAvatarProps {
  providerKey?: string
  logoUrl?: string
  color: string
  initials: string
  size?: number
}

export interface ProviderAvatarByKeyProps {
  providerKey: string
  brands: DisplayBrand[]
  size?: number
}

export interface BrandPickerDrawerProps {
  open: boolean
  sections: DisplayBrandSection[]
  configuredKeys: string[]
  onSelect: (brand: DisplayBrand | 'custom') => void
  onClose: () => void
}

export interface ProviderSetupDrawerProps {
  open: boolean
  brand: DisplayBrand | 'custom' | null
  editingEntry: ProviderEntry | null
  brands: DisplayBrand[]
  onClose: () => void
  onSave: (key: string, config: ProviderConfig) => Promise<void>
  saving: boolean
}

export interface ModelDrawerProps {
  open: boolean
  providerKey: string
  brands: DisplayBrand[]
  editingModel: ModelDef | null
  onClose: () => void
  onSave: (key: string, model: ModelDef) => Promise<void>
  saving: boolean
}

export interface ModelRowProps {
  model: ModelDef
  index: number
  isPrimary: boolean
  testState: ModelTestState
  onSetPrimary: () => void
  onTest: () => void
  onEdit: () => void
  onDelete: () => void
}

export interface ProviderCardProps {
  entry: ProviderEntry
  brands: DisplayBrand[]
  defaultModel: string | { primary: string; fallbacks?: string[] } | null
  onEdit: (e: ProviderEntry) => void
  onDelete: (key: string) => void
  onAddModel: (key: string) => void
  onEditModel: (key: string, m: ModelDef) => void
  onDeleteModel: (key: string, id: string) => void
  onSetPrimary: (key: string, id: string) => void
  onFetchRemote: (key: string) => void
}

export interface RemoteListModalProps {
  open: boolean
  loading: boolean
  remoteModels: string[]
  existingModelIds: string[]
  onClose: () => void
  onAdd: (ids: string[]) => void
}

export interface DefaultModelBannerProps {
  defaultModel: string | { primary: string; fallbacks?: string[] } | null
  brands: DisplayBrand[]
  onEditFallbacks?: () => void
}

export interface EmptyStateProps {
  brands: DisplayBrand[]
  onCreate: () => void
}
