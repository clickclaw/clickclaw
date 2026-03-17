import { App } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { resolveOutputDir } from '../backup-page.utils'

export function useBackupPage() {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()

  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const loadSnapshots = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const list = await window.api.backup.listSnapshots()
      setSnapshots(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSnapshots()
  }, [loadSnapshots])

  const handleCreateSnapshot = useCallback(async (): Promise<void> => {
    setCreating(true)
    try {
      const result = await window.api.backup.createSnapshot()
      if (result) {
        message.success(t('backup.snapshotCreated'))
        await loadSnapshots()
      } else {
        message.info(t('backup.snapshotNoChange'))
      }
    } finally {
      setCreating(false)
    }
  }, [loadSnapshots, message, t])

  const handleRestore = useCallback(
    (fileName: string): void => {
      modal.confirm({
        title: t('backup.confirmRestore'),
        content: t('backup.confirmRestoreDesc'),
        okText: t('backup.restore'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        onOk: async () => {
          try {
            await window.api.backup.restoreSnapshot(fileName)
            message.success(t('backup.restoreSuccess'))
            await loadSnapshots()
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            message.error(t('backup.restoreFailed', { error: msg }))
          }
        },
      })
    },
    [loadSnapshots, message, modal, t]
  )

  const handleCreateFull = useCallback(async (): Promise<void> => {
    const result = await window.api.dialog.showSaveDialog({
      title: t('backup.selectOutputDir'),
      defaultPath: `openclaw-backup-${new Date().toISOString().slice(0, 10)}`,
      filters: [{ name: 'Tar Archive', extensions: ['tar.gz'] }],
    })

    if (result.canceled || !result.filePath) return

    const outputDir = resolveOutputDir(result.filePath as string)

    setArchiving(true)
    try {
      const backupResult = await window.api.backup.createFull(outputDir)
      if (backupResult.success) {
        message.success(
          t('backup.fullArchiveCreated', { path: backupResult.archivePath || outputDir })
        )
      } else {
        message.error(t('backup.createFailed', { error: backupResult.error || 'unknown error' }))
      }
    } finally {
      setArchiving(false)
    }
  }, [message, t])

  return {
    snapshots,
    loading,
    creating,
    archiving,
    handleCreateSnapshot,
    handleRestore,
    handleCreateFull,
  }
}
