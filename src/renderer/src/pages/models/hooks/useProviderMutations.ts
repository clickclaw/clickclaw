import { App } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ModelDef, ProviderConfig, ProviderEntry } from '../model-page.types'
import {
  buildDefaultModelPathIfMissing,
  removeModel,
  upsertModel,
} from '@shared/models/model-hook-helpers'

interface UseProviderMutationsParams {
  providers: ProviderEntry[]
  defaultModel: string | { primary: string; fallbacks?: string[] } | null
  setDefaultModel: (value: string | { primary: string; fallbacks?: string[] } | null) => void
  touch: () => void
}

export function useProviderMutations({
  providers,
  defaultModel,
  setDefaultModel,
  touch,
}: UseProviderMutationsParams) {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [savingProvider, setSavingProvider] = useState(false)
  const [savingModel, setSavingModel] = useState(false)

  const ensureDefaultModelIfMissing = useCallback(
    async (providerKey: string, models: ModelDef[] | undefined) => {
      const nextDefault = buildDefaultModelPathIfMissing(defaultModel, providerKey, models)
      if (!nextDefault) return
      await window.api.model.setDefault(nextDefault, [])
      setDefaultModel({ primary: nextDefault, fallbacks: [] })
    },
    [defaultModel, setDefaultModel]
  )

  const updateProviderModels = useCallback(
    async (providerKey: string, newModels: ModelDef[]) => {
      const entry = providers.find((p) => p.key === providerKey)
      if (!entry) return false
      await window.api.model.saveProvider(providerKey, { ...entry.config, models: newModels })
      return true
    },
    [providers]
  )

  const saveProvider = useCallback(
    async (key: string, config: ProviderConfig) => {
      setSavingProvider(true)
      try {
        await window.api.model.saveProvider(key, config)
        await ensureDefaultModelIfMissing(key, config.models)
        message.success(t('models.saveProviderSuccess'))
        touch()
      } catch (err) {
        message.error(
          t('models.saveProviderFailed', {
            error: err instanceof Error ? err.message : String(err),
          })
        )
        throw err
      } finally {
        setSavingProvider(false)
      }
    },
    [ensureDefaultModelIfMissing, message, t, touch]
  )

  const deleteProvider = useCallback(
    async (key: string) => {
      await window.api.model.deleteProvider(key)
      message.success(t('models.deleteProviderSuccess'))
      touch()
    },
    [message, t, touch]
  )

  const saveModel = useCallback(
    async (providerKey: string, model: ModelDef) => {
      setSavingModel(true)
      try {
        const entry = providers.find((p) => p.key === providerKey)
        if (!entry) return
        const existing = entry.config.models || []
        const newModels = upsertModel(existing, model)
        await window.api.model.saveProvider(providerKey, { ...entry.config, models: newModels })
        await ensureDefaultModelIfMissing(providerKey, newModels)
        message.success(t('models.saveModelSuccess'))
        touch()
      } catch (err) {
        message.error(
          t('models.saveProviderFailed', {
            error: err instanceof Error ? err.message : String(err),
          })
        )
        throw err
      } finally {
        setSavingModel(false)
      }
    },
    [ensureDefaultModelIfMissing, message, providers, t, touch]
  )

  const deleteModel = useCallback(
    async (providerKey: string, modelId: string) => {
      const entry = providers.find((p) => p.key === providerKey)
      if (!entry) return
      const existing = entry.config.models || []
      await window.api.model.saveProvider(providerKey, {
        ...entry.config,
        models: removeModel(existing, modelId),
      })
      message.success(t('models.deleteModelSuccess'))
      touch()
    },
    [message, providers, t, touch]
  )

  const setPrimary = useCallback(
    async (providerKey: string, modelId: string) => {
      await window.api.model.setDefault(`${providerKey}/${modelId}`, [])
      message.success(t('models.setDefaultSuccess'))
      touch()
    },
    [message, t, touch]
  )

  return {
    savingProvider,
    savingModel,
    ensureDefaultModelIfMissing,
    updateProviderModels,
    saveProvider,
    deleteProvider,
    saveModel,
    deleteModel,
    setPrimary,
  }
}
