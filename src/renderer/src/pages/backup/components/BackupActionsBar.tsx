import { DatabaseOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Divider, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import type { BackupActionsBarProps } from '../backup-page.types'

const { Text } = Typography

export function BackupActionsBar({
  creating,
  archiving,
  onCreateSnapshot,
  onCreateFull,
}: BackupActionsBarProps): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 24,
        padding: '14px 20px',
        background: 'rgba(0,0,0,0.02)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 8,
      }}
    >
      <Space align="center">
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={creating}
          onClick={onCreateSnapshot}
        >
          {t('backup.createSnapshot')}
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('backup.snapshotDesc')}
        </Text>
      </Space>

      <Divider type="vertical" style={{ height: 28, margin: '0 24px' }} />

      <Space align="center">
        <Button icon={<DatabaseOutlined />} loading={archiving} onClick={onCreateFull}>
          {t('backup.createFull')}
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('backup.fullDesc')}
        </Text>
      </Space>
    </div>
  )
}
