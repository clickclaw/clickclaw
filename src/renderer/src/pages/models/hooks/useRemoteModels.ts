import { App } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelDef, ProviderEntry } from '../model-page.types'
import { mergeRemoteModels } from '@shared/models/model-hook-helpers'

interface UseRemoteModelsParams {
  providers: ProviderEntry[]
  ensureDefaultModelIfMissing: (
    providerKey: string,
    models: ModelDef[] | undefined
  ) => Promise<void>
  updateProviderModels: (providerKey: string, newModels: ModelDef[]) => Promise<boolean>
  touch: () => void
}

export function useRemoteModels({
  providers,
  ensureDefaultModelIfMissing,
  updateProviderModels,
  touch,
}: UseRemoteModelsParams) {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [remoteOpen, setRemoteOpen] = useState(false)
  const [remoteProviderKey, setRemoteProviderKey] = useState('')
  const [remoteModels, setRemoteModels] = useState<string[]>([])
  const [remoteLoading, setRemoteLoading] = useState(false)

  const handleFetchRemote = useCallback(
    async (providerKey: string) => {
      const entry = providers.find((p) => p.key === providerKey)
      if (!entry?.config.baseUrl) return
      setRemoteProviderKey(providerKey)
      setRemoteModels([])
      setRemoteLoading(true)
      setRemoteOpen(true)
      try {
        const list = await window.api.model.fetchRemoteList({
          baseUrl: entry.config.baseUrl,
          apiKey: entry.config.apiKey || '',
        })
        setRemoteModels(list)
      } catch (err) {
        message.error(
          t('models.fetchFailed', { error: err instanceof Error ? err.message : String(err) })
        )
        setRemoteOpen(false)
      } finally {
        setRemoteLoading(false)
      }
    },
    [message, providers, t]
  )

  const handleAddRemoteModels = useCallback(
    async (modelIds: string[]) => {
      const entry = providers.find((p) => p.key === remoteProviderKey)
      if (!entry) return
      const existing = entry.config.models || []
      const newModels = mergeRemoteModels(existing, modelIds)
      const updated = await updateProviderModels(remoteProviderKey, newModels)
      if (!updated) return
      await ensureDefaultModelIfMissing(remoteProviderKey, newModels)
      message.success(t('models.addedModels', { count: modelIds.length }))
      setRemoteOpen(false)
      touch()
    },
    [
      ensureDefaultModelIfMissing,
      message,
      providers,
      remoteProviderKey,
      t,
      touch,
      updateProviderModels,
    ]
  )

  const existingModelIds = useMemo(
    () => providers.find((p) => p.key === remoteProviderKey)?.config.models?.map((m) => m.id) || [],
    [providers, remoteProviderKey]
  )

  return {
    remoteOpen,
    setRemoteOpen,
    remoteModels,
    remoteLoading,
    existingModelIds,
    handleFetchRemote,
    handleAddRemoteModels,
  }
}
