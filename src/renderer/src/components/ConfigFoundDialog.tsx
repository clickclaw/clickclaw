import { Button, Typography, Space, Tag } from 'antd'
import { CheckCircleOutlined, SettingOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import LanguageSelect from './LanguageSelect'
import AppVersion from './AppVersion'

const { Title, Text, Paragraph } = Typography

interface DetectionSummary {
  hasProviders: boolean
  hasChannels: boolean
  agentCount: number
}

interface ConfigFoundDialogProps {
  detection: DetectionSummary
  onUseExisting: () => void
  onReconfigure: () => void
}

function ConfigFoundDialog({
  detection,
  onUseExisting,
  onReconfigure,
}: ConfigFoundDialogProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f5f5f5',
        position: 'relative',
      }}
    >
      {/* 右上角语言选择 */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSelect />
      </div>

      {/* 右下角版本号 */}
      <div style={{ position: 'absolute', bottom: 16, right: 20 }}>
        <AppVersion />
      </div>
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '40px 48px',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#FF4D2A' }} />
            <Title level={4} style={{ marginTop: 16, marginBottom: 4 }}>
              {t('app.configFound.title')}
            </Title>
            <Paragraph type="secondary">{t('app.configFound.description')}</Paragraph>
          </div>

          <div
            style={{
              background: '#fafafa',
              borderRadius: 8,
              padding: '16px 20px',
              border: '1px solid #f0f0f0',
            }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text type="secondary">{t('app.configFound.provider')}：</Text>
                <Tag color={detection.hasProviders ? 'green' : 'orange'}>
                  {detection.hasProviders
                    ? t('app.configFound.configured')
                    : t('app.configFound.notConfigured')}
                </Tag>
              </div>
              {detection.hasChannels && (
                <div>
                  <Text type="secondary">{t('app.configFound.channel')}：</Text>
                  <Tag color="green">{t('app.configFound.configured')}</Tag>
                </div>
              )}
              {detection.agentCount > 0 && (
                <div>
                  <Text type="secondary">{t('app.configFound.agentLabel')}：</Text>
                  <Tag color="blue">{detection.agentCount}</Tag>
                </div>
              )}
            </Space>
          </div>

          <Space style={{ width: '100%', justifyContent: 'center' }} size="middle">
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={onUseExisting}
            >
              {t('app.configFound.useExisting')}
            </Button>
            <Button size="large" icon={<SettingOutlined />} onClick={onReconfigure}>
              {t('app.configFound.reconfigure')}
            </Button>
          </Space>
        </Space>
      </div>
    </div>
  )
}

export default ConfigFoundDialog
