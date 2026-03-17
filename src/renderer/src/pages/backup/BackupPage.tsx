import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import { BackupActionsBar } from './components/BackupActionsBar'
import { SnapshotHistoryTable } from './components/SnapshotHistoryTable'
import { useBackupPage } from './hooks/useBackupPage'

function BackupPage(): React.ReactElement {
  const { t } = useTranslation()
  const {
    snapshots,
    loading,
    creating,
    archiving,
    handleCreateSnapshot,
    handleRestore,
    handleCreateFull,
  } = useBackupPage()

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader title={t('backup.title')} />
      <BackupActionsBar
        creating={creating}
        archiving={archiving}
        onCreateSnapshot={handleCreateSnapshot}
        onCreateFull={handleCreateFull}
      />
      <SnapshotHistoryTable snapshots={snapshots} loading={loading} onRestore={handleRestore} />
    </div>
  )
}

export default BackupPage
