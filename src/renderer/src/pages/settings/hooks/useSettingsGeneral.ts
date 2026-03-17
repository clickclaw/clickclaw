import { useCallback, useState } from 'react'

interface UseSettingsGeneralArgs {
  gwState: GatewayState
  t: (key: string, options?: Record<string, unknown>) => string
  onSuccess: (text: string) => void
  onError: (text: string) => void
}

interface ApplyGeneralInitialArgs {
  version: string
  config: Record<string, unknown>
  appState: AppState
  paths: AppDataPaths
  launchAtLogin: boolean
  remotePresetsStatus: RemotePresetsStatus
  gatewayToken: string
}

export function useSettingsGeneral({ gwState, t, onSuccess, onError }: UseSettingsGeneralArgs) {
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState('')
  const [paths, setPaths] = useState<{ logDir: string; openclawDir: string } | null>(null)
  const [gatewayToken, setGatewayToken] = useState('')

  const [currentPort, setCurrentPort] = useState(18789)
  const [editPort, setEditPort] = useState(18789)
  const [savingPort, setSavingPort] = useState(false)
  const [portJustSaved, setPortJustSaved] = useState(false)
  const portDirty = editPort !== currentPort

  const [autoStart, setAutoStart] = useState(true)
  const [launchAtLogin, setLaunchAtLogin] = useState(false)

  const [remotePresetsStatus, setRemotePresetsStatus] = useState<RemotePresetsStatus | null>(null)
  const [remotePresetsRefreshing, setRemotePresetsRefreshing] = useState(false)

  const applyInitial = useCallback((data: ApplyGeneralInitialArgs): void => {
    setVersion(data.version)
    const port =
      ((data.config.gateway as Record<string, unknown> | undefined)?.port as number | undefined) ??
      18789
    setCurrentPort(port)
    setEditPort(port)
    setAutoStart(data.appState.autoStartGateway !== false)
    setPaths(data.paths)
    setLaunchAtLogin(data.launchAtLogin)
    setRemotePresetsStatus(data.remotePresetsStatus)
    setGatewayToken(data.gatewayToken)
  }, [])

  const finishLoading = useCallback(() => setLoading(false), [])

  const handleSavePort = useCallback(async (): Promise<void> => {
    setSavingPort(true)
    try {
      const cfg = (await window.api.config.read()) as Record<string, unknown>
      await window.api.config.write({
        ...cfg,
        gateway: { ...((cfg.gateway as object) || {}), port: editPort },
      })
      setCurrentPort(editPort)

      if (gwState === 'running') {
        await window.api.gateway.restart()
        onSuccess(t('common.restartSuccess'))
      } else {
        onSuccess(t('settings.portSaved'))
      }

      setPortJustSaved(true)
      setTimeout(() => setPortJustSaved(false), 1800)
    } catch {
      onError(t('common.restartFailed'))
    } finally {
      setSavingPort(false)
    }
  }, [editPort, gwState, onError, onSuccess, t])

  const handleAutoStartChange = useCallback(async (val: boolean): Promise<void> => {
    setAutoStart(val)
    await window.api.appState.set({ autoStartGateway: val })
  }, [])

  const handleLaunchAtLoginChange = useCallback(async (val: boolean): Promise<void> => {
    setLaunchAtLogin(val)
    await window.api.launch.setEnabled(val)
  }, [])

  const openPath = useCallback((path: string): void => {
    window.api.shell.openPath(path).catch(() => {})
  }, [])

  const handleRefreshRemotePresets = useCallback(async (): Promise<void> => {
    setRemotePresetsRefreshing(true)
    try {
      const result = await window.api.remotePresets.refresh()
      if (result.success) {
        onSuccess(t('settings.remotePresets.refreshSuccess'))
      } else {
        onError(result.error || t('settings.remotePresets.refreshFailed'))
      }
      const status = await window.api.remotePresets.getStatus()
      setRemotePresetsStatus(status)
    } catch {
      onError(t('settings.remotePresets.refreshFailed'))
    } finally {
      setRemotePresetsRefreshing(false)
    }
  }, [onError, onSuccess, t])

  return {
    loading,
    version,
    paths,
    gatewayToken,
    currentPort,
    editPort,
    setEditPort,
    savingPort,
    portJustSaved,
    portDirty,
    autoStart,
    launchAtLogin,
    remotePresetsStatus,
    remotePresetsRefreshing,
    applyInitial,
    finishLoading,
    handleSavePort,
    handleAutoStartChange,
    handleLaunchAtLoginChange,
    openPath,
    handleRefreshRemotePresets,
  }
}
