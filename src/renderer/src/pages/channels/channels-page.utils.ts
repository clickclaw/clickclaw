import type {
  ChannelConfig,
  ChannelFieldDef,
  ChannelFormValues,
  ChannelPresetForUI,
  DmPolicy,
  GroupPolicy,
} from './channels-page.types'

const CHANNEL_META_KEYS = new Set([
  'enabled',
  'dmPolicy',
  'allowFrom',
  'groupPolicy',
  'groupAllowFrom',
  'accounts',
  'defaultAccount',
])

export const VIRTUAL_DEFAULT_ACCOUNT_ID = 'default'

export function areRequiredChannelFieldsFilled(
  values: Record<string, unknown>,
  preset: ChannelPresetForUI
): boolean {
  const requiredFields = preset.fields.filter((field) => field.required)
  if (requiredFields.length === 0) return false

  return requiredFields.every((field) => {
    const value = values[field.key]
    return typeof value === 'string' && value.trim() !== ''
  })
}

export function getChannelCredentialStatus(
  values: Record<string, unknown>,
  preset: ChannelPresetForUI
): 'empty' | 'partial' | 'complete' {
  if (preset.fields.length === 0) return 'empty'

  const filledCount = preset.fields.filter((field) => {
    const value = values[field.key]
    return typeof value === 'string' && value.trim() !== ''
  }).length

  if (filledCount === 0) return 'empty'
  if (areRequiredChannelFieldsFilled(values, preset)) return 'complete'
  return 'partial'
}

export function buildFallbackPreset(key: string, config: ChannelConfig): ChannelPresetForUI {
  const letters = key.replace(/[^a-zA-Z]/g, '')
  const initials = (letters.slice(0, 2) || key.slice(0, 2)).toUpperCase()
  const name = key.charAt(0).toUpperCase() + key.slice(1)

  const fields: ChannelFieldDef[] = Object.keys(config)
    .filter((k) => !CHANNEL_META_KEYS.has(k) && typeof config[k] === 'string')
    .map((k) => ({
      key: k,
      label: k,
      type: /secret|token|key|password|passwd/i.test(k) ? 'password' : ('text' as const),
      required: false,
      placeholder: '',
    }))

  return {
    key,
    name,
    group: 'international',
    color: '#8c8c8c',
    initials,
    tagline: undefined,
    docsUrl: undefined,
    fields,
    dmPolicies: ['pairing', 'allowlist', 'open', 'disabled'],
    supportsGroup: false,
    groupPolicies: [],
  }
}

export function resolveAccounts(
  config: ChannelConfig,
  preset: ChannelPresetForUI
): {
  accounts: Record<string, Record<string, unknown>>
  defaultAccountId: string
  isVirtual: boolean
} {
  const realAccounts = config.accounts ?? {}
  const realAccountIds = Object.keys(realAccounts)

  if (realAccountIds.length > 0) {
    return {
      accounts: realAccounts,
      defaultAccountId: config.defaultAccount ?? '',
      isVirtual: false,
    }
  }

  const rootCreds: Record<string, unknown> = {}
  let hasAnyCred = false
  for (const field of preset.fields) {
    const val = config[field.key]
    if (val !== undefined && val !== '') {
      rootCreds[field.key] = val
      hasAnyCred = true
    }
  }

  if (hasAnyCred) {
    return {
      accounts: { [VIRTUAL_DEFAULT_ACCOUNT_ID]: rootCreds },
      defaultAccountId: VIRTUAL_DEFAULT_ACCOUNT_ID,
      isVirtual: true,
    }
  }

  return {
    accounts: {},
    defaultAccountId: '',
    isVirtual: false,
  }
}

export function configToForm(config: ChannelConfig, preset: ChannelPresetForUI): ChannelFormValues {
  const values: ChannelFormValues = {
    enabled: config.enabled !== false,
    dmPolicy: (config.dmPolicy as DmPolicy) ?? preset.dmPolicies[0] ?? 'pairing',
    allowFrom: Array.isArray(config.allowFrom) ? config.allowFrom.join('\n') : '',
    groupPolicy: (config.groupPolicy as GroupPolicy) ?? preset.groupPolicies[0] ?? 'allowlist',
    groupAllowFrom: Array.isArray(config.groupAllowFrom) ? config.groupAllowFrom.join('\n') : '',
  }
  for (const field of preset.fields) {
    const raw = config[field.key]
    if (field.key === 'domain') {
      values[field.key] = raw === 'lark' ? 'lark' : 'feishu'
      continue
    }
    values[field.key] = typeof raw === 'string' ? raw : ''
  }
  values.streaming = config.streaming !== false
  values.blockStreaming = config.blockStreaming === true
  return values
}

export function formToConfig(
  values: ChannelFormValues,
  existing: ChannelConfig | undefined,
  preset: ChannelPresetForUI
): ChannelConfig {
  const base: ChannelConfig = {
    ...(existing ?? {}),
    enabled: values.enabled !== false,
    dmPolicy: values.dmPolicy ?? preset.dmPolicies[0],
    allowFrom:
      values.dmPolicy === 'open'
        ? ['*']
        : typeof values.allowFrom === 'string'
          ? values.allowFrom
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
    groupPolicy: values.groupPolicy ?? preset.groupPolicies[0],
    groupAllowFrom:
      typeof values.groupAllowFrom === 'string'
        ? values.groupAllowFrom
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
  }

  if (typeof values.streaming === 'boolean') {
    base.streaming = values.streaming
  }
  if (typeof values.blockStreaming === 'boolean') {
    base.blockStreaming = values.blockStreaming
  }

  const creds: Record<string, unknown> = {}
  for (const field of preset.fields) {
    const val = values[field.key]
    if (typeof val === 'string' && val.trim() === '') {
      if (base[field.key] !== undefined && base[field.key] !== '') continue
    }
    base[field.key] = val
    creds[field.key] = val
  }

  const existingAccounts = existing?.accounts ?? {}
  const existingAccountIds = Object.keys(existingAccounts)
  const isSingleAccountMode = existingAccountIds.length <= 1

  if (isSingleAccountMode) {
    const hasCreds = Object.values(creds).some((v) => typeof v === 'string' && v.trim() !== '')
    if (hasCreds) {
      if (!base.accounts) base.accounts = {}
      base.accounts[VIRTUAL_DEFAULT_ACCOUNT_ID] = {
        ...(existingAccounts[VIRTUAL_DEFAULT_ACCOUNT_ID] ?? {}),
        ...creds,
      }
      if (!base.defaultAccount) base.defaultAccount = VIRTUAL_DEFAULT_ACCOUNT_ID
    }
  }

  return base
}
