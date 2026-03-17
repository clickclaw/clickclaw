import { useCallback, useState } from 'react'
import type { DisplayBrand, ModelDef, ProviderEntry } from '../model-page.types'
import { getBrandByKey } from '../model-page.utils'

interface UseModelPageUiStateParams {
  brands: DisplayBrand[]
}

export function useModelPageUiState({ brands }: UseModelPageUiStateParams) {
  const [brandPickerOpen, setBrandPickerOpen] = useState(false)
  const [setupDrawerOpen, setSetupDrawerOpen] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<DisplayBrand | 'custom' | null>(null)
  const [editingProvider, setEditingProvider] = useState<ProviderEntry | null>(null)

  const [modelDrawerOpen, setModelDrawerOpen] = useState(false)
  const [modelDrawerProviderKey, setModelDrawerProviderKey] = useState('')
  const [editingModel, setEditingModel] = useState<ModelDef | null>(null)

  const handleBrandSelect = useCallback((brand: DisplayBrand | 'custom') => {
    setBrandPickerOpen(false)
    setSelectedBrand(brand)
    setEditingProvider(null)
    setSetupDrawerOpen(true)
  }, [])

  const handleEditProvider = useCallback(
    (entry: ProviderEntry) => {
      setSelectedBrand(getBrandByKey(entry.key, brands) || 'custom')
      setEditingProvider(entry)
      setSetupDrawerOpen(true)
    },
    [brands]
  )

  const openCreateModelDrawer = useCallback((providerKey: string) => {
    setModelDrawerProviderKey(providerKey)
    setEditingModel(null)
    setModelDrawerOpen(true)
  }, [])

  const openEditModelDrawer = useCallback((providerKey: string, model: ModelDef) => {
    setModelDrawerProviderKey(providerKey)
    setEditingModel(model)
    setModelDrawerOpen(true)
  }, [])

  return {
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
  }
}
