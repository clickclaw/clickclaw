import { useEffect, useRef, useState, useCallback } from 'react'
import { Button, Typography, Flex, Spin, theme } from 'antd'
import {
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  RocketOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { SetupData } from './SetupPage'

const { Title, Paragraph, Text } = Typography
const { useToken } = theme

interface Props {
  data: SetupData
  onDone: () => void
}

type LaunchState = 'launching' | 'success' | 'failed'

function StepLaunch({ data, onDone }: Props): React.ReactElement {
  const { t } = useTranslation()
  const { token } = useToken()
  const [state, setState] = useState<LaunchState>('launching')
  const [port, setPort] = useState(5800)
  const [errorMsg, setErrorMsg] = useState('')
  const launchedRef = useRef(false)

  const doLaunch = useCallback(async () => {
    setState('launching')
    setErrorMsg('')

    try {
      const result = await window.api.setup.complete({
        providerKey: data.providerKey,
        platformKey: data.platformKey,
        apiKey: data.apiKey,
        modelId: data.modelId,
        channels: Object.keys(data.channels).length > 0 ? data.channels : undefined,
      })

      const r = result as { success: boolean; port: number; error?: string }
      if (r.success) {
        setPort(r.port)
        setState('success')
      } else {
        setErrorMsg(r.error || '')
        setState('failed')
      }
    } catch (err) {
      setErrorMsg(String(err))
      setState('failed')
    }
  }, [data])

  useEffect(() => {
    // React 18 StrictMode 会执行两次 useEffect，用 ref 防止重复启动
    if (launchedRef.current) return
    launchedRef.current = true
    doLaunch()
  }, [doLaunch])

  // ========== 启动中 ==========

  if (state === 'launching') {
    return (
      <div style={{ textAlign: 'center', maxWidth: 440, width: '100%' }}>
        {/* 品牌色 Spin 套 Logo */}
        <Spin
          indicator={<LoadingOutlined style={{ fontSize: 64, color: '#FF4D2A' }} spin />}
          style={{ marginBottom: 28, display: 'block' }}
        />
        <Title level={4} style={{ marginBottom: 8 }}>
          {t('setup.launch.title')}
        </Title>
        <Text type="secondary">{t('setup.launch.starting')}</Text>
      </div>
    )
  }

  // ========== 启动成功 ==========

  if (state === 'success') {
    return (
      <div style={{ textAlign: 'center', maxWidth: 440, width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <CheckCircleFilled style={{ fontSize: 64, color: '#52c41a' }} />
        </div>
        <Title level={3} style={{ marginBottom: 8 }}>
          {t('setup.launch.success')}
        </Title>
        <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 32 }}>
          {t('setup.launch.successHint', { port })}
        </Paragraph>
        <Button
          type="primary"
          size="large"
          icon={<RocketOutlined />}
          onClick={onDone}
          style={{ minWidth: 160 }}
        >
          {t('setup.launch.enterDashboard')}
        </Button>
      </div>
    )
  }

  // ========== 启动失败 ==========

  return (
    <div style={{ textAlign: 'center', maxWidth: 440, width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <CloseCircleFilled style={{ fontSize: 64, color: token.colorError }} />
      </div>
      <Title level={3} style={{ marginBottom: 8, color: token.colorError }}>
        {t('setup.launch.failed')}
      </Title>
      {errorMsg && (
        <div
          style={{
            background: token.colorFillSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 28,
            textAlign: 'left',
          }}
        >
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: token.colorTextSecondary,
              wordBreak: 'break-all',
            }}
          >
            {errorMsg}
          </Text>
        </div>
      )}
      <Flex justify="center">
        <Button type="primary" size="large" onClick={doLaunch} style={{ minWidth: 120 }}>
          {t('common.retry')}
        </Button>
      </Flex>
    </div>
  )
}

export default StepLaunch
