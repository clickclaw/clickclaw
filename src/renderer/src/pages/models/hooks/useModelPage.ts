import { useCallback, useMemo } from 'react'
import type { ModelDef, ProviderConfig } from '../model-page.types'
import { getPrimaryModelPath } from '../model-page.utils'
import { useModelPageUiState } from './useModelPageUiState'
import { useProviderMutations } from './useProviderMutations'
import { useProviderPresets } from './useProviderPresets'
import { useProviderQuery } from './useProviderQuery'
import { useRemoteModels } from './useRemoteModels'

export function useModelPage() {
  const { brands, brandSections } = useProviderPresets()

  const { providers, defaultModel, setDefaultModel, loading, loadError, loadData, touch } =
    useProviderQuery()

  const {
    savingProvider,
    savingModel,
    ensureDefaultModelIfMissing,
    updateProviderModels,
    saveProvider,
    deleteProvider,
    saveModel,
    deleteModel,
    setPrimary,
    setFallbacks,
    setPrimaryAndFallbacks,
  } = useProviderMutations({
    providers,
    defaultModel,
    setDefaultModel,
    touch,
  })

  const {
    brandPickerOpen,
    setBrandPickerOpen,
    setupDrawerOpen,
    setSetupDrawerOpen,
    selectedBrand,
    editingProvider,
    modelDrawerOpen,
    setModelDrawerOpen,
    modelDrawerProviderKey,
    editingModel,
    handleBrandSelect,
    handleEditProvider,
    openCreateModelDrawer,
    openEditModelDrawer,
  } = useModelPageUiState({ brands })

  const {
    remoteOpen,
    setRemoteOpen,
    remoteModels,
    remoteLoading,
    existingModelIds,
    handleFetchRemote,
    handleAddRemoteModels,
  } = useRemoteModels({
    providers,
    ensureDefaultModelIfMissing,
    updateProviderModels,
    touch,
  })

  const handleSaveProvider = useCallback(
    async (key: string, config: ProviderConfig) => {
      const nextConfig = editingProvider
        ? { ...config, models: editingProvider.config.models || [] }
        : config
      await saveProvider(key, nextConfig)
      setSetupDrawerOpen(false)
    },
    [editingProvider, saveProvider, setSetupDrawerOpen]
  )

  const handleSaveModel = useCallback(
    async (providerKey: string, model: ModelDef) => {
      await saveModel(providerKey, model)
      setModelDrawerOpen(false)
    },
    [saveModel, setModelDrawerOpen]
  )

  const fallbackOptions = useMemo(
    () =>
      providers.flatMap((entry) =>
        (entry.config.models || []).map((model) => `${entry.key}/${model.id}`)
      ),
    [providers]
  )

  const fallbackValue = useMemo(
    () => (defaultModel && typeof defaultModel === 'object' ? defaultModel.fallbacks || [] : []),
    [defaultModel]
  )

  const primaryModelPath = useMemo(() => getPrimaryModelPath(defaultModel), [defaultModel])

  return {
    brands,
    brandSections,
    providers,
    defaultModel,
    loading,
    loadError,
    brandPickerOpen,
    setBrandPickerOpen,
    setupDrawerOpen,
    setSetupDrawerOpen,
    selectedBrand,
    editingProvider,
    savingProvider,
    modelDrawerOpen,
    setModelDrawerOpen,
    modelDrawerProviderKey,
    editingModel,
    savingModel,
    remoteOpen,
    setRemoteOpen,
    remoteModels,
    remoteLoading,
    existingModelIds,
    loadData,
    handleBrandSelect,
    handleEditProvider,
    handleSaveProvider,
    handleDeleteProvider: deleteProvider,
    openCreateModelDrawer,
    openEditModelDrawer,
    handleSaveModel,
    handleDeleteModel: deleteModel,
    handleSetPrimary: setPrimary,
    handleSetFallbacks: setFallbacks,
    handleSetPrimaryAndFallbacks: setPrimaryAndFallbacks,
    fallbackOptions,
    fallbackValue,
    primaryModelPath,
    handleFetchRemote,
    handleAddRemoteModels,
  }
}
