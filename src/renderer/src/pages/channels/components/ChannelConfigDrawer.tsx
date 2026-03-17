import { useEffect, useRef, useState } from 'react'
import { App, Button, Divider, Drawer, Form, Input, QRCode, Select, Switch } from 'antd'
import { CheckCircleFilled, LinkOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import { useGatewayContext } from '../../../contexts/GatewayContext'
import type {
  ChannelConfigDrawerProps,
  ChannelFormValues,
  DmPolicy,
  GroupPolicy,
} from '../channels-page.types'
import { configToForm, formToConfig } from '../channels-page.utils'
import { ChannelMonogram } from './ChannelMonogram'

export function ChannelConfigDrawer({
  open,
  preset,
  existingConfig,
  onClose,
  onSave,
  saving,
}: ChannelConfigDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const { message, modal } = App.useApp()
  const { callRpc, status: wsStatus, gwState } = useGatewayContext()
  const [form] = Form.useForm<ChannelFormValues>()
  const [verifying, setVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [watchedDmPolicy, setWatchedDmPolicy] = useState<DmPolicy | undefined>()
  const [watchedGroupPolicy, setWatchedGroupPolicy] = useState<GroupPolicy | undefined>()
  const [whatsappBusy, setWhatsappBusy] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState<string | null>(null)
  const [whatsappQrDataUrl, setWhatsappQrDataUrl] = useState<string | null>(null)
  const [wecomQuickBusy, setWecomQuickBusy] = useState(false)
  const [wecomAuthUrl, setWecomAuthUrl] = useState<string | null>(null)
  const [wecomScanSuccess, setWecomScanSuccess] = useState(false)
  const [feishuQuickBusy, setFeishuQuickBusy] = useState(false)
  const [feishuAuthUrl, setFeishuAuthUrl] = useState<string | null>(null)
  const [feishuScanSuccess, setFeishuScanSuccess] = useState(false)
  const scanRequestVersionRef = useRef(0)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
    if (!open) {
      scanRequestVersionRef.current += 1
      setVerifying(false)
      setWhatsappBusy(false)
      setWecomQuickBusy(false)
      setFeishuQuickBusy(false)
      setWhatsappMessage(null)
      setWhatsappQrDataUrl(null)
      setWecomAuthUrl(null)
      setWecomScanSuccess(false)
      setFeishuAuthUrl(null)
      setFeishuScanSuccess(false)
    }
  }, [open])

  useEffect(() => {
    if (open && preset) {
      const values = configToForm(existingConfig ?? { enabled: true }, preset)
      form.setFieldsValue(values)
      setWatchedDmPolicy(values.dmPolicy)
      setWatchedGroupPolicy(values.groupPolicy)
      setVerifyStatus('idle')
      setWhatsappMessage(null)
      setWhatsappQrDataUrl(null)
      setWecomAuthUrl(null)
      setWecomScanSuccess(false)
      setFeishuAuthUrl(null)
      setFeishuScanSuccess(false)
    }
  }, [open, preset, existingConfig, form])

  if (!preset) return <></>

  const isEdit = !!existingConfig
  const nextScanVersion = (): number => {
    scanRequestVersionRef.current += 1
    return scanRequestVersionRef.current
  }
  const isScanVersionActive = (version: number): boolean =>
    scanRequestVersionRef.current === version && openRef.current

  const handleVerify = async (): Promise<void> => {
    const values = form.getFieldsValue()
    const fields: Record<string, string> = {}
    for (const field of preset.fields) {
      fields[field.key] = (typeof values[field.key] === 'string' ? values[field.key] : '') as string
    }
    setVerifying(true)
    try {
      const result = await window.api.channel.verify(preset.key, fields)
      if (result.success) {
        setVerifyStatus('success')
        message.success(result.message || t('channels.verifySuccess'))
      } else {
        setVerifyStatus('error')
        message.error(result.message || t('channels.verifyFailed'))
      }
    } catch (err) {
      setVerifyStatus('error')
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      setVerifying(false)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      const config = formToConfig(values, existingConfig, preset)
      await onSave(preset, config)
    } catch {
      // validateFields 失败时 antd 自动高亮错误字段
    }
  }

  const requireGatewayReady = (): void => {
    if (gwState !== 'running' || wsStatus !== 'ready') {
      throw new Error(t('channels.configDrawer.gatewayRequired'))
    }
  }

  const getWhatsappAccountId = (): string | undefined => {
    const accountId = existingConfig?.defaultAccount
    return typeof accountId === 'string' && accountId.trim() ? accountId.trim() : undefined
  }

  const handleWhatsAppStart = async (force: boolean): Promise<void> => {
    setWhatsappBusy(true)
    try {
      requireGatewayReady()
      const accountId = getWhatsappAccountId()
      const res = (await callRpc('web.login.start', {
        force,
        timeoutMs: 30000,
        ...(accountId ? { accountId } : {}),
      })) as { message?: string; qrDataUrl?: string }
      setWhatsappMessage(res.message ?? null)
      setWhatsappQrDataUrl(res.qrDataUrl ?? null)
    } catch (err) {
      setWhatsappMessage(err instanceof Error ? err.message : String(err))
      setWhatsappQrDataUrl(null)
    } finally {
      setWhatsappBusy(false)
    }
  }

  const handleWhatsAppWait = async (): Promise<void> => {
    setWhatsappBusy(true)
    try {
      requireGatewayReady()
      const accountId = getWhatsappAccountId()
      const res = (await callRpc('web.login.wait', {
        timeoutMs: 120000,
        ...(accountId ? { accountId } : {}),
      })) as { message?: string; connected?: boolean }
      setWhatsappMessage(res.message ?? null)
      if (res.connected) setWhatsappQrDataUrl(null)
    } catch (err) {
      setWhatsappMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setWhatsappBusy(false)
    }
  }

  const handleWhatsAppLogout = async (): Promise<void> => {
    setWhatsappBusy(true)
    try {
      requireGatewayReady()
      const accountId = getWhatsappAccountId()
      await callRpc('channels.logout', {
        channel: 'whatsapp',
        ...(accountId ? { accountId } : {}),
      })
      setWhatsappMessage(t('channels.configDrawer.whatsappLoggedOut'))
      setWhatsappQrDataUrl(null)
    } catch (err) {
      setWhatsappMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setWhatsappBusy(false)
    }
  }

  const handleWecomQuickCreate = async (): Promise<void> => {
    const scanVersion = nextScanVersion()
    setWecomQuickBusy(true)
    setWecomScanSuccess(false)
    try {
      const started = await window.api.channel.wecomScanStart()
      if (!isScanVersionActive(scanVersion)) return
      setWecomAuthUrl(started.authUrl)
      message.info(t('channels.configDrawer.wecomScanWaiting'))
      const result = await window.api.channel.wecomScanWait(started.scode)
      if (!isScanVersionActive(scanVersion)) return
      form.setFieldsValue({
        botId: result.botId,
        secret: result.secret,
      })
      setVerifyStatus('idle')
      setWecomScanSuccess(true)
      setWecomAuthUrl(null)
      message.success(t('channels.configDrawer.wecomScanSuccess'))
    } catch (err) {
      if (!isScanVersionActive(scanVersion)) return
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
      if (isScanVersionActive(scanVersion)) {
        setWecomQuickBusy(false)
      }
    }
  }

  const handleFeishuQuickCreate = async (): Promise<void> => {
    const scanVersion = nextScanVersion()
    setFeishuQuickBusy(true)
    setFeishuScanSuccess(false)
    try {
      const currentDomain = form.getFieldValue('domain')
      const requestedDomain: 'feishu' | 'lark' = currentDomain === 'lark' ? 'lark' : 'feishu'
      const started = await window.api.channel.feishuScanStart(requestedDomain)
      if (!isScanVersionActive(scanVersion)) return
      setFeishuAuthUrl(started.authUrl)
      message.info(t('channels.configDrawer.feishuScanWaiting'))

      const timeoutMs = Math.max(started.expireInSec, 60) * 1000
      const result = await window.api.channel.feishuScanWait(started.deviceCode, {
        domain: started.domain,
        intervalSec: started.intervalSec,
        timeoutMs,
      })
      if (!isScanVersionActive(scanVersion)) return

      form.setFieldsValue({
        appId: result.appId,
        appSecret: result.appSecret,
        domain: result.domain,
      })
      setVerifyStatus('idle')
      setFeishuScanSuccess(true)
      setFeishuAuthUrl(null)
      message.success(t('channels.configDrawer.feishuScanSuccess'))
    } catch (err) {
      if (!isScanVersionActive(scanVersion)) return
      const errorText = err instanceof Error ? err.message : String(err)
      message.error(
        t('channels.configDrawer.feishuScanFailed', {
          error: errorText,
        })
      )
    } finally {
      if (isScanVersionActive(scanVersion)) {
        setFeishuQuickBusy(false)
      }
    }
  }

  const hasDmAllowlist = watchedDmPolicy === 'allowlist'
  const hasGroupAllowlist = watchedGroupPolicy === 'allowlist'
  const scanHintStyle = {
    marginBottom: 8,
    fontSize: 12,
    color: '#595959',
    lineHeight: 1.5,
  } as const

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ChannelMonogram
            channelKey={preset.key}
            initials={preset.initials}
            color={preset.color}
            size={32}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
              {isEdit
                ? t('channels.configDrawer.editTitle', { name: preset.name })
                : t('channels.configDrawer.addTitle', { name: preset.name })}
            </div>
            {preset.tagline && (
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.3 }}>{preset.tagline}</div>
            )}
          </div>
        </div>
      }
      open={open}
      onClose={onClose}
      width={480}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      styles={{ body: { paddingTop: 12 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            icon={<CheckCircleFilled />}
            loading={verifying}
            onClick={handleVerify}
            style={
              verifyStatus === 'success'
                ? { color: '#52c41a', borderColor: '#b7eb8f' }
                : verifyStatus === 'error'
                  ? { color: '#ff4d4f', borderColor: '#ffccc7' }
                  : {}
            }
          >
            {verifying ? t('channels.configDrawer.verifying') : t('channels.configDrawer.verify')}
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              loading={saving}
              onClick={handleSubmit}
              style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
            >
              {t('common.save')}
            </Button>
          </div>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onValuesChange={(changed) => {
          if ('dmPolicy' in changed) setWatchedDmPolicy(changed.dmPolicy as DmPolicy)
          if ('groupPolicy' in changed) setWatchedGroupPolicy(changed.groupPolicy as GroupPolicy)
          const credKeys = preset.fields.map((f) => f.key)
          if (credKeys.some((k) => k in changed)) setVerifyStatus('idle')
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: '#aaa',
            marginBottom: 10,
          }}
        >
          {t('channels.configDrawer.credentials')}
        </div>

        {preset.fields.map((field) => (
          <Form.Item
            key={field.key}
            name={field.key}
            label={
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <span style={{ fontWeight: 500 }}>{field.label}</span>
                {field.apiKeyUrl && (
                  <Button
                    type="link"
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={() => window.api.shell.openExternal(field.apiKeyUrl!)}
                    style={{ padding: '0 0 0 8px', fontSize: 12, height: 'auto' }}
                  >
                    {t('channels.configDrawer.getApiKey')}
                  </Button>
                )}
              </div>
            }
            rules={field.required ? [{ required: true, message: `${field.label} 不能为空` }] : []}
            extra={
              field.helpText ? (
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>{field.helpText}</span>
              ) : undefined
            }
          >
            {field.type === 'password' ? (
              <Input.Password placeholder={field.placeholder} autoComplete="off" />
            ) : field.type === 'select' ? (
              <Select
                placeholder={field.placeholder}
                options={field.options?.map((o) => ({ value: o.value, label: o.label }))}
              />
            ) : (
              <Input placeholder={field.placeholder} />
            )}
          </Form.Item>
        ))}

        {preset.key === 'wecom' && (
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
        )}

        {preset.key === 'feishu' && (
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
        )}

        {preset.key === 'whatsapp' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Button loading={whatsappBusy} onClick={() => handleWhatsAppStart(false)}>
                {t('channels.configDrawer.whatsappShowQr')}
              </Button>
              <Button loading={whatsappBusy} onClick={() => handleWhatsAppStart(true)}>
                {t('channels.configDrawer.whatsappRelink')}
              </Button>
              <Button loading={whatsappBusy} onClick={handleWhatsAppWait}>
                {t('channels.configDrawer.whatsappWait')}
              </Button>
              <Button danger loading={whatsappBusy} onClick={handleWhatsAppLogout}>
                {t('channels.configDrawer.whatsappLogout')}
              </Button>
            </div>
            {whatsappMessage && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>{whatsappMessage}</div>
            )}
            {whatsappQrDataUrl && (
              <div style={{ marginTop: 8 }}>
                <img
                  src={whatsappQrDataUrl}
                  alt="whatsapp-qr"
                  style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid #f0f0f0' }}
                />
              </div>
            )}
          </div>
        )}

        {preset.key === 'feishu' && (
          <>
            <Divider style={{ margin: '8px 0 16px' }} />

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: '#aaa',
                marginBottom: 10,
              }}
            >
              {t('channels.configDrawer.feishuStreaming')}
            </div>

            <Form.Item
              name="streaming"
              label={t('channels.configDrawer.feishuStreamingEnabled')}
              valuePropName="checked"
              extra={
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                  {t('channels.configDrawer.feishuStreamingEnabledHint')}
                </span>
              }
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="blockStreaming"
              label={t('channels.configDrawer.feishuBlockStreaming')}
              valuePropName="checked"
              extra={
                <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                  {t('channels.configDrawer.feishuBlockStreamingHint')}
                </span>
              }
            >
              <Switch />
            </Form.Item>
          </>
        )}

        <Divider style={{ margin: '8px 0 16px' }} />

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: '#aaa',
            marginBottom: 10,
          }}
        >
          {t('channels.configDrawer.policy')}
        </div>

        {preset.dmPolicies.length > 0 && (
          <Form.Item name="dmPolicy" label={t('channels.dmPolicy')}>
            <Select
              options={preset.dmPolicies.map((p) => ({
                value: p,
                label: t(`channels.dmPolicy_${p}` as Parameters<typeof t>[0]),
              }))}
            />
          </Form.Item>
        )}

        {hasDmAllowlist && (
          <Form.Item name="allowFrom" label={t('channels.allowFrom')}>
            <Input.TextArea
              rows={3}
              placeholder={t('channels.allowFromPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
        )}

        {preset.supportsGroup && preset.groupPolicies.length > 0 && (
          <>
            <Form.Item name="groupPolicy" label={t('channels.groupPolicy')}>
              <Select
                options={preset.groupPolicies.map((p) => ({
                  value: p,
                  label: t(`channels.groupPolicy_${p}` as Parameters<typeof t>[0]),
                }))}
              />
            </Form.Item>

            {hasGroupAllowlist && (
              <Form.Item name="groupAllowFrom" label={t('channels.groupAllowFrom')}>
                <Input.TextArea
                  rows={3}
                  placeholder={t('channels.groupAllowFromPlaceholder')}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Drawer>
  )
}
