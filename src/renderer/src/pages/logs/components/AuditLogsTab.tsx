import { Empty, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AUDIT_TABLE_HEIGHT } from '../logs-page.utils'

export function AuditLogsTab(): React.ReactElement {
  const { t } = useTranslation()
  const [snapshots, setSnapshots] = useState<SnapshotListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.backup.listSnapshots().then((list) => {
      setSnapshots(list)
      setLoading(false)
    })
  }, [])

  const columns: ColumnsType<SnapshotListItem> = [
    {
      title: t('backup.cols.time'),
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t('backup.cols.source'),
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('backup.cols.summary'),
      dataIndex: 'summary',
      key: 'summary',
    },
    {
      title: t('backup.cols.status'),
      dataIndex: 'healthy',
      key: 'healthy',
      width: 100,
      render: (v: boolean) =>
        v ? <Tag color="success">{t('backup.healthy')}</Tag> : <Tag>{t('backup.unhealthy')}</Tag>,
    },
  ]

  if (!loading && snapshots.length === 0) {
    return <Empty description={t('logs.noAuditLogs')} style={{ marginTop: 40 }} />
  }

  return (
    <Table
      dataSource={snapshots}
      columns={columns}
      rowKey="fileName"
      loading={loading}
      pagination={false}
      scroll={{ y: AUDIT_TABLE_HEIGHT }}
      size="small"
    />
  )
}
