import { Tabs } from 'antd'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import { AuditLogsTab } from './components/AuditLogsTab'
import { BackupLogsTab } from './components/BackupLogsTab'
import { ErrorLogsTab } from './components/ErrorLogsTab'
import { LiveLogsTab } from './components/LiveLogsTab'

function LogsPage(): React.ReactElement {
  const { t } = useTranslation()

  const items = [
    { key: 'live', label: t('logs.tabs.live'), children: <LiveLogsTab /> },
    { key: 'errors', label: t('logs.tabs.errors'), children: <ErrorLogsTab /> },
    { key: 'backup', label: t('logs.tabs.backup'), children: <BackupLogsTab /> },
    { key: 'audit', label: t('logs.tabs.audit'), children: <AuditLogsTab /> },
  ]

  return (
    <div style={{ padding: '24px 28px', overflow: 'hidden' }}>
      <PageHeader title={t('logs.title')} />
      <Tabs items={items} defaultActiveKey="live" />
    </div>
  )
}

export default LogsPage
