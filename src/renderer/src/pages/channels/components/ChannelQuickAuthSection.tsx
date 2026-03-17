import { useRef, useState } from 'react'
import { App, Button, QRCode } from 'antd'
import { useTranslation } from 'react-i18next'

type FeishuDomain = 'feishu' | 'lark'

interface ChannelQuickAuthSectionProps {
  channelKey: string
  getFieldValue: (key: string) => unknown
  setFieldValues: (values: Record<string, string>) => void
  onCredentialsFilled?: () => void
}

export function ChannelQuickAuthSection({
  channelKey,
  getFieldValue,
  setFieldValues,
  onCredentialsFilled,
}: ChannelQuickAuthSectionProps): React.ReactElement | null {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const [wecomQuickBusy, setWecomQuickBusy] = useState(false)
  const [wecomAuthUrl, setWecomAuthUrl] = useState<string | null>(null)
  const [wecomScanSuccess, setWecomScanSuccess] = useState(false)
  const [feishuQuickBusy, setFeishuQuickBusy] = useState(false)
  const [feishuAuthUrl, setFeishuAuthUrl] = useState<string | null>(null)
  const [feishuScanSuccess, setFeishuScanSuccess] = useState(false)
  const requestVersionRef = useRef(0)

  const nextRequestVersion = (): number => {
    requestVersionRef.current += 1
    return requestVersionRef.current
  }

  const isRequestVersionActive = (version: number): boolean => requestVersionRef.current === version

  const fillValues = (values: Record<string, string>): void => {
    setFieldValues(values)
    onCredentialsFilled?.()
  }

  const handleWecomQuickCreate = async (): Promise<void> => {
    const requestVersion = nextRequestVersion()
    setWecomQuickBusy(true)
    setWecomScanSuccess(false)
    try {
      const started = await window.api.channel.wecomScanStart()
      if (!isRequestVersionActive(requestVersion)) return
      setWecomAuthUrl(started.authUrl)
      message.info(t('channels.configDrawer.wecomScanWaiting'))

      const result = await window.api.channel.wecomScanWait(started.scode)
      if (!isRequestVersionActive(requestVersion)) return

      fillValues({
        botId: result.botId,
        secret: result.secret,
      })
      setWecomScanSuccess(true)
      setWecomAuthUrl(null)
      message.success(t('channels.configDrawer.wecomScanSuccess'))
    } catch (err) {
      if (!isRequestVersionActive(requestVersion)) return
      const errorText = err instanceof Error ? err.message : String(err)
      if (errorText.includes('扫码成功但未获取到 Bot 信息')) {
        modal.confirm({
          title: t('channels.configDrawer.wecomRetryTitle'),
          content: t('channels.configDrawer.wecomRetryContent'),
          okText: t('channels.configDrawer.wecomRetryNow'),
          cancelText: t('common.cancel'),
          onOk: async () => {
            await handleWecomQuickCreate()
          },
        })
        return
      }
      message.error(
        t('channels.configDrawer.wecomScanFailed', {
          error: errorText,
        })
      )
    } finally {
      if (isRequestVersionActive(requestVersion)) {
        setWecomQuickBusy(false)
      }
    }
  }

  const handleFeishuQuickCreate = async (): Promise<void> => {
    const requestVersion = nextRequestVersion()
    setFeishuQuickBusy(true)
    setFeishuScanSuccess(false)
    try {
      const currentDomain = getFieldValue('domain')
      const requestedDomain: FeishuDomain = currentDomain === 'lark' ? 'lark' : 'feishu'
      const started = await window.api.channel.feishuScanStart(requestedDomain)
      if (!isRequestVersionActive(requestVersion)) return
      setFeishuAuthUrl(started.authUrl)
      message.info(t('channels.configDrawer.feishuScanWaiting'))

      const timeoutMs = Math.max(started.expireInSec, 60) * 1000
      const result = await window.api.channel.feishuScanWait(started.deviceCode, {
        domain: started.domain,
        intervalSec: started.intervalSec,
        timeoutMs,
      })
      if (!isRequestVersionActive(requestVersion)) return

      fillValues({
        appId: result.appId,
        appSecret: result.appSecret,
        domain: result.domain,
      })
      setFeishuScanSuccess(true)
      setFeishuAuthUrl(null)
      message.success(t('channels.configDrawer.feishuScanSuccess'))
    } catch (err) {
      if (!isRequestVersionActive(requestVersion)) return
      const errorText = err instanceof Error ? err.message : String(err)
      message.error(
        t('channels.configDrawer.feishuScanFailed', {
          error: errorText,
        })
      )
    } finally {
      if (isRequestVersionActive(requestVersion)) {
        setFeishuQuickBusy(false)
      }
    }
  }

  const scanHintStyle = {
    marginBottom: 8,
    fontSize: 12,
    color: '#595959',
    lineHeight: 1.5,
  } as const

  if (channelKey === 'wecom') {
    return (
      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <Button loading={wecomQuickBusy} onClick={handleWecomQuickCreate}>
          {wecomQuickBusy
            ? t('channels.configDrawer.wecomScanWorking')
            : t('channels.configDrawer.wecomScanCreate')}
        </Button>
        {wecomScanSuccess && (
          <div
            style={{
              marginTop: 8,
              width: 180,
              height: 180,
              borderRadius: 10,
              border: '1px solid #b7eb8f',
              background: 'rgba(82,196,26,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: '#389e0d',
              fontSize: 13,
              fontWeight: 600,
              padding: 12,
            }}
          >
            {t('channels.configDrawer.wecomScanSuccessMask')}
          </div>
        )}
        {wecomAuthUrl && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            <div style={scanHintStyle}>{t('channels.configDrawer.wecomScanAppHint')}</div>
            <div style={{ marginBottom: 8 }}>
              <QRCode value={wecomAuthUrl} size={180} bordered />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (channelKey === 'feishu') {
    return (
      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <Button loading={feishuQuickBusy} onClick={handleFeishuQuickCreate}>
          {feishuQuickBusy
            ? t('channels.configDrawer.feishuScanWorking')
            : t('channels.configDrawer.feishuScanCreate')}
        </Button>
        {feishuScanSuccess && (
          <div
            style={{
              marginTop: 8,
              width: 180,
              height: 180,
              borderRadius: 10,
              border: '1px solid #91caff',
              background: 'rgba(22,119,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: '#0958d9',
              fontSize: 13,
              fontWeight: 600,
              padding: 12,
            }}
          >
            {t('channels.configDrawer.feishuScanSuccessMask')}
          </div>
        )}
        {feishuAuthUrl && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            <div style={scanHintStyle}>{t('channels.configDrawer.feishuScanAppHint')}</div>
            <div style={{ marginBottom: 8 }}>
              <QRCode value={feishuAuthUrl} size={180} bordered />
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
