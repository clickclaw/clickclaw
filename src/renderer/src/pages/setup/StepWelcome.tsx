import { useEffect, useState } from 'react'
import { Button, Typography, Spin, Tag, Flex } from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { SetupData } from './SetupPage'
import logoSvg from '../../assets/logo.svg'

const { Title, Paragraph, Text } = Typography

interface Props {
  data: SetupData
  updateData: (partial: Partial<SetupData>) => void
  onNext: () => void
}

type DetectState = 'idle' | 'detecting' | 'done'

const DETECTION_FALLBACK = {
  existingConfig: {
    found: false,
    valid: false,
    hasProviders: false,
    hasChannels: false,
    agentCount: 0,
  },
  existingGateway: {
    running: false,
    port: 18789,
    pid: null,
  },
  bundledOpenclaw: {
    version: 'unknown',
    nodeVersion: '22',
  },
}

/** 单条检测结果行 */
function DetectRow({
  status,
  text,
}: {
  status: 'success' | 'warning' | 'error' | 'neutral'
  text: string
}): React.ReactElement {
  const colorMap = {
    success: { border: '#52c41a', bg: '#f6ffed', icon: '#52c41a' },
    warning: { border: '#faad14', bg: '#fffbe6', icon: '#faad14' },
    error: { border: '#ff4d4f', bg: '#fff2f0', icon: '#ff4d4f' },
    neutral: { border: '#d9d9d9', bg: '#fafafa', icon: '#bfbfbf' },
  }
  const c = colorMap[status]
  const IconComp =
    status === 'success'
      ? CheckCircleOutlined
      : status === 'error'
        ? CloseCircleOutlined
        : InfoCircleOutlined

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 14px',
        borderRadius: 8,
        borderLeft: `3px solid ${c.border}`,
        background: c.bg,
      }}
    >
      <IconComp style={{ color: c.icon, fontSize: 14, flexShrink: 0 }} />
      <Text style={{ fontSize: 13 }}>{text}</Text>
    </div>
  )
}

function StepWelcome({ data, updateData, onNext }: Props): React.ReactElement {
  const { t } = useTranslation()
  const [detectState, setDetectState] = useState<DetectState>(data.detection ? 'done' : 'idle')

  const runDetection = async (): Promise<void> => {
    setDetectState('detecting')
    try {
      const result = await window.api.runtime.detect()
      updateData({ detection: result as unknown as Record<string, unknown> })
      setDetectState('done')
    } catch (err) {
      console.error('detection failed:', err)
      setDetectState('done')
      updateData({ detection: DETECTION_FALLBACK })
    }
  }

  useEffect(() => {
    if (detectState === 'idle') {
      runDetection()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const detection = data.detection as Record<string, unknown> | null
  const existingConfig = detection?.existingConfig as Record<string, unknown> | undefined
  const existingGateway = detection?.existingGateway as Record<string, unknown> | undefined
  const bundledOpenclaw = detection?.bundledOpenclaw as Record<string, unknown> | undefined
  const portInUse = (existingGateway as Record<string, unknown>)?.running === true

  return (
    <div style={{ textAlign: 'center', maxWidth: 520, width: '100%' }}>
      {/* Logo */}
      <img src={logoSvg} alt="ClickClaw" style={{ width: 80, height: 80, marginBottom: 16 }} />
      <Title level={3} style={{ marginBottom: 8 }}>
        {t('setup.welcome.title')}
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 28, fontSize: 14 }}>
        {t('setup.welcome.subtitle')}
      </Paragraph>

      {/* 检测中 */}
      {detectState === 'detecting' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '20px 0',
          }}
        >
          <Spin indicator={<LoadingOutlined style={{ color: '#FF4D2A' }} />} />
          <Text type="secondary">{t('setup.welcome.detecting')}</Text>
        </div>
      )}

      {/* 检测完成 */}
      {detectState === 'done' && detection && (
        <Flex vertical gap={8} style={{ textAlign: 'left' }}>
          {/* 已有配置 */}
          <DetectRow
            status={existingConfig?.found ? 'success' : 'neutral'}
            text={
              existingConfig?.found
                ? existingConfig.hasProviders
                  ? t('setup.welcome.detected.configWithProviders')
                  : t('setup.welcome.detected.configFound')
                : t('setup.welcome.detected.configNotFound')
            }
          />

          {/* 端口状态 */}
          <DetectRow
            status={portInUse ? 'error' : 'success'}
            text={
              portInUse
                ? t('setup.welcome.detected.portInUse', {
                    port: (existingGateway as Record<string, unknown>).port,
                  })
                : t('setup.welcome.detected.portFree')
            }
          />

          {/* 内置引擎版本 */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Tag color="processing" style={{ fontSize: 13, padding: '4px 14px', borderRadius: 20 }}>
              {t('setup.welcome.detected.bundledEngine', {
                version: bundledOpenclaw?.version || 'unknown',
              })}
            </Tag>
          </div>
        </Flex>
      )}

      {/* 开始按钮 */}
      <div style={{ marginTop: 32 }}>
        <Button
          type="primary"
          size="large"
          onClick={onNext}
          disabled={detectState !== 'done'}
          loading={detectState === 'detecting'}
          style={{ minWidth: 160 }}
        >
          {t('setup.welcome.startSetup')}
        </Button>
      </div>
    </div>
  )
}

export default StepWelcome
