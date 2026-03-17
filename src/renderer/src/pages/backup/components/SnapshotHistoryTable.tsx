import { RollbackOutlined } from '@ant-design/icons'
import { Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import type { SnapshotHistoryTableProps } from '../backup-page.types'

export function SnapshotHistoryTable({
  snapshots,
  loading,
  onRestore,
}: SnapshotHistoryTableProps): React.ReactElement {
  const { t } = useTranslation()

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
    {
      title: t('backup.cols.actions'),
      key: 'actions',
      width: 100,
      render: (_: unknown, record: SnapshotListItem) => (
        <Button size="small" icon={<RollbackOutlined />} onClick={() => onRestore(record.fileName)}>
          {t('backup.restore')}
        </Button>
      ),
    },
  ]

  return (
    <Table
      dataSource={snapshots}
      columns={columns}
      rowKey="fileName"
      loading={loading}
      pagination={{ pageSize: 20, showSizeChanger: false }}
      size="small"
      locale={{ emptyText: t('backup.noSnapshots') }}
    />
  )
}
