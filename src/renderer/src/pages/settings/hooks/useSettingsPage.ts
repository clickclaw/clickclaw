import { App as AntdApp } from 'antd'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGatewayContext } from '../../../contexts/GatewayContext'
import { useSettingsGeneral } from './useSettingsGeneral'
import { useSettingsProxy } from './useSettingsProxy'
import { useSettingsSecurity } from './useSettingsSecurity'
import { useSettingsUpdates } from './useSettingsUpdates'

export function useSettingsPage() {
  const { t } = useTranslation()
  const { message: msg } = AntdApp.useApp()
  const { gwState } = useGatewayContext()

  const general = useSettingsGeneral({
    gwState,
    t,
    onSuccess: (text) => msg.success(text),
    onError: (text) => msg.error(text),
  })

  const proxy = useSettingsProxy({
    gwState,
    t,
    onSuccess: (text) => msg.success(text),
    onError: (text) => msg.error(text),
  })

  const security = useSettingsSecurity()

  const updates = useSettingsUpdates({
    t,
    onSuccess: (text) => msg.success(text),
    onError: (text) => msg.error(text),
  })

  const applyGeneralInitial = general.applyInitial
  const finishGeneralLoading = general.finishLoading
  const applyProxyInitial = proxy.applyInitial
  const applySecurityInitial = security.applyInitial
  const applyUpdatesCurrentVersion = updates.applyInitialCurrentVersion

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const [
          version,
          config,
          appState,
          paths,
          launchAtLogin,
          remotePresetsStatus,
          gatewayToken,
          vetSettings,
          presetModels,
          proxyCfg,
          openclawInfo,
        ] = await Promise.all([
          window.api.getVersion(),
          window.api.config.read() as Promise<Record<string, unknown>>,
          window.api.appState.get(),
          window.api.appPaths.get(),
          window.api.launch.getStatus(),
          window.api.remotePresets.getStatus(),
          window.api.gateway.getToken().catch(() => ''),
          window.api.skill.vetSettings.get(),
          window.api.model.getPresetModels(),
          window.api.proxy.get(),
          window.api.openclawUpdate.getInfo(),
        ])

        applyGeneralInitial({
          version,
          config,
          appState,
          paths,
          launchAtLogin,
          remotePresetsStatus,
          gatewayToken,
        })
        applyProxyInitial(proxyCfg)
        applySecurityInitial(
          vetSettings,
          presetModels as Array<{
            providerKey: string
            providerName: string
            color: string
            models: Array<{ id: string; name: string }>
          }>
        )
        applyUpdatesCurrentVersion(openclawInfo.currentVersion)
      } finally {
        finishGeneralLoading()
      }
    }

    load()
  }, [
    applyGeneralInitial,
    finishGeneralLoading,
    applyProxyInitial,
    applySecurityInitial,
    applyUpdatesCurrentVersion,
  ])

  return {
    gwState,
    ...general,
    ...proxy,
    ...security,
    ...updates,
  }
}
