import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSettingsUpdatesArgs {
  t: (key: string, options?: Record<string, unknown>) => string
  onSuccess: (text: string) => void
  onError: (text: string) => void
}

export function useSettingsUpdates({ t, onSuccess, onError }: UseSettingsUpdatesArgs) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ status: 'idle' })

  const [openclawUpdateInfo, setOpenclawUpdateInfo] = useState<OpenclawUpdateInfo>({
    status: 'idle',
    currentVersion: '',
    logLines: [],
  })
  const [openclawInstalling, setOpenclawInstalling] = useState(false)
  const [openclawLogLines, setOpenclawLogLines] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const offUpdateStatus = window.api.update.onStatusChanged(setUpdateInfo)
    window.api.update.getInfo().then(setUpdateInfo)

    window.api.openclawUpdate.onLog((line) => {
      setOpenclawLogLines((prev) => [...prev, line])
    })

    return () => {
      offUpdateStatus()
      window.api.openclawUpdate.offLog()
    }
  }, [])

  const applyInitialCurrentVersion = useCallback((currentVersion: string): void => {
    setOpenclawUpdateInfo((prev) => ({ ...prev, currentVersion }))
  }, [])

  const handleCheckOpenclawUpdate = useCallback(async (): Promise<void> => {
    setOpenclawUpdateInfo((prev) => ({ ...prev, status: 'checking' }))
    try {
      const info = await window.api.openclawUpdate.check()
      setOpenclawUpdateInfo({ ...info, logLines: [] })
    } catch (err) {
      setOpenclawUpdateInfo((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [])

  const handleInstallOpenclawUpdate = useCallback(
    async (versionToInstall: string): Promise<void> => {
      setOpenclawInstalling(true)
      setOpenclawLogLines([])
      setOpenclawUpdateInfo((prev) => ({ ...prev, status: 'installing' }))
      try {
        const result = await window.api.openclawUpdate.install(versionToInstall)
        if (result.success) {
          setOpenclawUpdateInfo((prev) => ({
            ...prev,
            status: 'done',
            currentVersion: versionToInstall,
          }))
          onSuccess(t('settings.openclaw.upgradeSuccess'))
        } else {
          setOpenclawUpdateInfo((prev) => ({
            ...prev,
            status: 'error',
            error: result.error,
          }))
          onError(t('settings.openclaw.upgradeFailed'))
        }
      } finally {
        setOpenclawInstalling(false)
      }
    },
    [onError, onSuccess, t]
  )

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [openclawLogLines])

  return {
    updateInfo,
    openclawUpdateInfo,
    openclawInstalling,
    openclawLogLines,
    logEndRef,
    applyInitialCurrentVersion,
    handleCheckOpenclawUpdate,
    handleInstallOpenclawUpdate,
  }
}
