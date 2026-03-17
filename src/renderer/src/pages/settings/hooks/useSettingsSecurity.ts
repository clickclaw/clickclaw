import { useCallback, useState } from 'react'
import type { VetterModelGroup } from '../settings-page.types'

export function useSettingsSecurity() {
  const [vetterEnabled, setVetterEnabled] = useState(true)
  const [vetterUseCustom, setVetterUseCustom] = useState(false)
  const [vetterCustomModel, setVetterCustomModel] = useState('')
  const [vetterModelGroups, setVetterModelGroups] = useState<VetterModelGroup[]>([])

  const applyInitial = useCallback(
    (
      vetSettings: SkillVetterSettings,
      presetModels: Array<{
        providerKey: string
        providerName: string
        color: string
        models: Array<{ id: string; name: string }>
      }>
    ): void => {
      setVetterEnabled(vetSettings.enabled)
      if (vetSettings.customModel) {
        setVetterUseCustom(true)
        setVetterCustomModel(vetSettings.customModel)
      }
      setVetterModelGroups(
        presetModels.map((g) => ({
          providerKey: g.providerKey,
          providerName: g.providerName,
          models: g.models,
        }))
      )
    },
    []
  )

  const saveVetterSettings = useCallback(
    async (enabled: boolean, useCustom: boolean, customModel: string): Promise<void> => {
      await window.api.skill.vetSettings.save({
        enabled,
        customModel: useCustom && customModel ? customModel : null,
      })
    },
    []
  )

  const handleVetterEnabledChange = useCallback(
    async (val: boolean): Promise<void> => {
      setVetterEnabled(val)
      await saveVetterSettings(val, vetterUseCustom, vetterCustomModel)
    },
    [saveVetterSettings, vetterCustomModel, vetterUseCustom]
  )

  const handleVetterModelModeChange = useCallback(
    async (useCustom: boolean): Promise<void> => {
      setVetterUseCustom(useCustom)
      await saveVetterSettings(vetterEnabled, useCustom, vetterCustomModel)
    },
    [saveVetterSettings, vetterCustomModel, vetterEnabled]
  )

  const handleVetterCustomModelChange = useCallback(
    async (val: string): Promise<void> => {
      setVetterCustomModel(val)
      await saveVetterSettings(vetterEnabled, vetterUseCustom, val)
    },
    [saveVetterSettings, vetterEnabled, vetterUseCustom]
  )

  return {
    vetterEnabled,
    vetterUseCustom,
    vetterCustomModel,
    vetterModelGroups,
    applyInitial,
    handleVetterEnabledChange,
    handleVetterModelModeChange,
    handleVetterCustomModelChange,
  }
}
