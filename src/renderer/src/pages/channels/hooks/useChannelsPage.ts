import { App } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  AgentConfig,
  BindingConfig,
  BindingRouteRule,
  ChannelConfig,
  ChannelPresetForUI,
} from '../channels-page.types'
import {
  buildFallbackPreset,
  resolveAccounts,
  VIRTUAL_DEFAULT_ACCOUNT_ID,
} from '../channels-page.utils'

export function useChannelsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [presets, setPresets] = useState<{
    domestic: ChannelPresetForUI[]
    international: ChannelPresetForUI[]
  }>({
    domestic: [],
    international: [],
  })
  const [channels, setChannels] = useState<Record<string, ChannelConfig>>({})
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [bindings, setBindings] = useState<BindingConfig[]>([])
  const [bindingRules, setBindingRules] = useState<BindingRouteRule[]>([])
  const [bindingRulesOpen, setBindingRulesOpen] = useState(false)
  const [bindingRulesLoading, setBindingRulesLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<ChannelPresetForUI | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false)
  const [accountChannelKey, setAccountChannelKey] = useState<string | null>(null)
  const [accountPreset, setAccountPreset] = useState<ChannelPresetForUI | null>(null)
  const [accountEditingId, setAccountEditingId] = useState<string | null>(null)
  const [accountEditingData, setAccountEditingData] = useState<Record<string, unknown> | null>(null)
  const [accountSaving, setAccountSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [presetsResult, channelsResult, agentsResult, bindingsResult] = await Promise.all([
        window.api.channel.getPresets(),
        window.api.channel.list(),
        window.api.agent.list(),
        window.api.binding.list(),
      ])
      setPresets(presetsResult as typeof presets)
      setChannels(channelsResult as typeof channels)
      setAgents(agentsResult as AgentConfig[])
      setBindings(bindingsResult as BindingConfig[])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBindingRules = useCallback(async () => {
    setBindingRulesLoading(true)
    try {
      const result = await window.api.binding.listRules()
      setBindingRules(result as BindingRouteRule[])
    } finally {
      setBindingRulesLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    void loadBindingRules()
  }, [loadBindingRules])

  const allPresets = useMemo(() => [...presets.domestic, ...presets.international], [presets])
  const configuredKeys = useMemo(() => Object.keys(channels), [channels])

  const findPreset = useCallback(
    (key: string, config: ChannelConfig): ChannelPresetForUI =>
      allPresets.find((p) => p.key === key) ?? buildFallbackPreset(key, config),
    [allPresets]
  )

  const handleAddChannel = useCallback((): void => setPickerOpen(true), [])

  const handlePickerSelect = useCallback(
    (preset: ChannelPresetForUI): void => {
      setPickerOpen(false)
      if (configuredKeys.includes(preset.key)) {
        const config = channels[preset.key]
        const resolvedPreset = findPreset(preset.key, config)
        setAccountChannelKey(preset.key)
        setAccountPreset(resolvedPreset)
        setAccountEditingId(null)
        setAccountEditingData(null)
        setAccountDrawerOpen(true)
        return
      }
      setSelectedPreset(preset)
      setEditingKey(null)
      setConfigOpen(true)
    },
    [channels, configuredKeys, findPreset]
  )

  const handleEdit = useCallback(
    (key: string): void => {
      const preset = findPreset(key, channels[key])
      setSelectedPreset(preset)
      setEditingKey(key)
      setConfigOpen(true)
    },
    [channels, findPreset]
  )

  const handleSave = useCallback(
    async (
      preset: ChannelPresetForUI,
      config: ChannelConfig,
      options?: { successMessage?: string }
    ): Promise<void> => {
      setSaving(true)
      try {
        await window.api.channel.save(preset.key, config)
        message.success(options?.successMessage ?? t('channels.saveSuccess'))
        setConfigOpen(false)
        await load()
      } catch (err) {
        message.error(
          t('channels.saveFailed', { error: err instanceof Error ? err.message : String(err) })
        )
      } finally {
        setSaving(false)
      }
    },
    [load, message, t]
  )

  const handleDelete = useCallback(
    async (key: string): Promise<void> => {
      try {
        await window.api.channel.delete(key)
        message.success(t('channels.deleteSuccess'))
        await load()
      } catch (err) {
        message.error(String(err))
      }
    },
    [load, message, t]
  )

  const handleToggle = useCallback(
    async (key: string, enabled: boolean): Promise<void> => {
      const existing = channels[key]
      if (!existing) return
      try {
        await window.api.channel.save(key, { ...existing, enabled })
        await load()
      } catch (err) {
        message.error(String(err))
      }
    },
    [channels, load, message]
  )

  const handleOpenAddAccount = useCallback(
    (channelKey: string): void => {
      const preset = findPreset(channelKey, channels[channelKey])
      setAccountChannelKey(channelKey)
      setAccountPreset(preset)
      setAccountEditingId(null)
      setAccountEditingData(null)
      setAccountDrawerOpen(true)
    },
    [channels, findPreset]
  )

  const handleOpenEditAccount = useCallback(
    (channelKey: string, accountId: string): void => {
      const config = channels[channelKey]
      const preset = findPreset(channelKey, config)
      const { accounts: resolvedAccounts } = resolveAccounts(config, preset)
      const accountData = resolvedAccounts[accountId] ?? {}
      setAccountChannelKey(channelKey)
      setAccountPreset(preset)
      setAccountEditingId(accountId)
      setAccountEditingData(accountData)
      setAccountDrawerOpen(true)
    },
    [channels, findPreset]
  )

  const handleSaveAccount = useCallback(
    async (
      channelKey: string,
      accountId: string,
      data: Record<string, unknown>,
      options?: { successMessage?: string }
    ): Promise<void> => {
      setAccountSaving(true)
      try {
        const config = channels[channelKey]
        const preset = findPreset(channelKey, config)
        const { isVirtual } = resolveAccounts(config, preset)
        const isAddingNew = !accountEditingId
        const existingRealAccountCount = Object.keys(config.accounts ?? {}).length

        if (isVirtual && !isAddingNew && accountId === VIRTUAL_DEFAULT_ACCOUNT_ID) {
          const updated: ChannelConfig = { ...config }
          for (const field of preset.fields) {
            if (data[field.key] !== undefined) updated[field.key] = data[field.key]
          }
          if (!updated.accounts) updated.accounts = {}
          updated.accounts[VIRTUAL_DEFAULT_ACCOUNT_ID] = {
            ...(updated.accounts[VIRTUAL_DEFAULT_ACCOUNT_ID] ?? {}),
            ...data,
          }
          updated.defaultAccount = VIRTUAL_DEFAULT_ACCOUNT_ID
          await window.api.channel.save(channelKey, updated)
        } else if (isVirtual && isAddingNew) {
          const updated: ChannelConfig = { ...config }
          if (!updated.accounts) updated.accounts = {}
          if (!updated.accounts[VIRTUAL_DEFAULT_ACCOUNT_ID]) {
            const rootCreds: Record<string, unknown> = {}
            for (const field of preset.fields) {
              if (updated[field.key] !== undefined && updated[field.key] !== '') {
                rootCreds[field.key] = updated[field.key]
              }
            }
            updated.accounts[VIRTUAL_DEFAULT_ACCOUNT_ID] = rootCreds
          }
          for (const field of preset.fields) {
            delete updated[field.key]
          }
          if (!updated.defaultAccount) updated.defaultAccount = VIRTUAL_DEFAULT_ACCOUNT_ID

          await window.api.channel.save(channelKey, updated)
          await window.api.channel.saveAccount(channelKey, accountId, data)
        } else if (!isVirtual && isAddingNew && existingRealAccountCount === 0) {
          await window.api.channel.saveAccount(channelKey, accountId, data)
          const refreshed = channels[channelKey]
          const updated: ChannelConfig = { ...(refreshed ?? config) }
          for (const field of preset.fields) {
            if (data[field.key] !== undefined) updated[field.key] = data[field.key]
          }
          await window.api.channel.save(channelKey, updated)
        } else {
          await window.api.channel.saveAccount(channelKey, accountId, data)
          const existing = channels[channelKey]
          const hasRootCreds = preset.fields.some(
            (f) => existing?.[f.key] !== undefined && existing[f.key] !== ''
          )
          if (hasRootCreds) {
            const updated: ChannelConfig = { ...existing }
            for (const field of preset.fields) delete updated[field.key]
            await window.api.channel.save(channelKey, updated)
          }
        }

        message.success(options?.successMessage ?? t('channels.accounts.saveSuccess'))
        setAccountDrawerOpen(false)
        await load()
      } catch (err) {
        message.error(
          t('channels.accounts.saveFailed', {
            error: err instanceof Error ? err.message : String(err),
          })
        )
      } finally {
        setAccountSaving(false)
      }
    },
    [accountEditingId, channels, findPreset, load, message, t]
  )

  const handleDeleteAccount = useCallback(
    async (channelKey: string, accountId: string): Promise<void> => {
      try {
        const config = channels[channelKey]
        const preset = findPreset(channelKey, config)
        const { isVirtual } = resolveAccounts(config, preset)

        if (isVirtual && accountId === VIRTUAL_DEFAULT_ACCOUNT_ID) {
          const updated: ChannelConfig = { ...config }
          for (const field of preset.fields) {
            delete updated[field.key]
          }
          if (updated.accounts) {
            delete updated.accounts[VIRTUAL_DEFAULT_ACCOUNT_ID]
            if (Object.keys(updated.accounts).length === 0) {
              delete updated.accounts
            }
          }
          if (updated.defaultAccount === VIRTUAL_DEFAULT_ACCOUNT_ID) {
            delete updated.defaultAccount
          }
          await window.api.channel.save(channelKey, updated)
        } else {
          await window.api.channel.deleteAccount(channelKey, accountId)
        }

        message.success(t('channels.accounts.deleteSuccess'))
        await load()
      } catch (err) {
        message.error(String(err))
      }
    },
    [channels, findPreset, load, message, t]
  )

  const handleSetDefaultAccount = useCallback(
    async (channelKey: string, accountId: string): Promise<void> => {
      try {
        await window.api.channel.setDefaultAccount(channelKey, accountId)
        message.success(t('channels.accounts.setDefaultSuccess'))
        await load()
      } catch (err) {
        message.error(String(err))
      }
    },
    [load, message, t]
  )

  const handleSetBinding = useCallback(
    async (channelKey: string, accountId: string, agentId: string | null): Promise<void> => {
      try {
        if (agentId) {
          await window.api.binding.save(agentId, channelKey, accountId)
        } else {
          await window.api.binding.delete(channelKey, accountId)
        }
        await load()
      } catch (err) {
        message.error(String(err))
      }
    },
    [load, message]
  )

  return {
    presets,
    channels,
    agents,
    bindings,
    bindingRules,
    bindingRulesOpen,
    setBindingRulesOpen,
    bindingRulesLoading,
    loadBindingRules,
    loading,
    pickerOpen,
    setPickerOpen,
    configOpen,
    setConfigOpen,
    selectedPreset,
    editingKey,
    saving,
    accountDrawerOpen,
    setAccountDrawerOpen,
    accountChannelKey,
    accountPreset,
    accountEditingId,
    accountEditingData,
    accountSaving,
    allPresets,
    configuredKeys,
    findPreset,
    handleAddChannel,
    handlePickerSelect,
    handleEdit,
    handleSave,
    handleDelete,
    handleToggle,
    handleOpenAddAccount,
    handleOpenEditAccount,
    handleSaveAccount,
    handleDeleteAccount,
    handleSetDefaultAccount,
    handleSetBinding,
  }
}
