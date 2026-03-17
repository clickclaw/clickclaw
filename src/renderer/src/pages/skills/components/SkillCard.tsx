import { Card, Space, Typography, Tag, Button } from 'antd'
import { CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

const { Text, Paragraph } = Typography

interface SkillCardProps {
  slug: string
  displayName: string
  summary: string
  emoji?: string
  version?: string
  stats?: { downloads?: number; stars?: number }
  isInstalled: boolean
  isInstalling: boolean
  onInstall: (slug: string) => void
}

export function SkillCard({
  slug,
  displayName,
  summary,
  emoji,
  version,
  stats,
  isInstalled,
  isInstalling,
  onInstall,
}: SkillCardProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Card
      size="small"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      <Space direction="vertical" style={{ width: '100%', flex: 1 }} size={8}>
        <Space align="start">
          {emoji && <span style={{ fontSize: 24 }}>{emoji}</span>}
          <div>
            <Text strong style={{ fontSize: 14 }}>
              {displayName}
            </Text>
            {version && (
              <Tag color="default" style={{ marginLeft: 6, fontSize: 11 }}>
                v{version}
              </Tag>
            )}
          </div>
        </Space>
        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: 12 }}>
          {summary}
        </Paragraph>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
          }}
        >
          <Space size={12}>
            {stats?.downloads != null && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                ↓ {stats.downloads.toLocaleString()} {t('skills.downloads')}
              </Text>
            )}
            {stats?.stars != null && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                ★ {stats.stars.toLocaleString()}
              </Text>
            )}
          </Space>
          {isInstalled ? (
            <Button
              size="small"
              disabled
              icon={<CheckCircleOutlined />}
              type="text"
              style={{ color: '#52c41a' }}
            >
              {t('skills.installed')}
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              loading={isInstalling}
              onClick={() => onInstall(slug)}
            >
              {t('skills.install')}
            </Button>
          )}
        </div>
      </Space>
    </Card>
  )
}
