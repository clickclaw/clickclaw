import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  CheckCircleFilled,
  KeyOutlined,
  LinkOutlined,
  PictureOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { getProviderLogo } from '../../assets/brand-logos'
import type { SetupData } from './SetupPage'

const { Title, Text } = Typography

interface Props {
  data: SetupData
  updateData: (partial: Partial<SetupData>) => void
}

type VerifyState = 'idle' | 'verifying' | 'success' | 'failed'
type ProviderMode = 'preset' | 'custom'

const API_TYPE_OPTIONS = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
]

function getSectionCopy(
  key: ProviderPresetSection['key'],
  t: (key: string) => string
): { title: string; description: string } {
  switch (key) {
    case 'recommended':
      return {
        title: t('setup.provider.sectionRecommended'),
        description: t('setup.provider.sectionRecommendedDesc'),
      }
    case 'international':
      return {
        title: t('setup.provider.sectionInternational'),
        description: t('setup.provider.sectionInternationalDesc'),
      }
    default:
      return {
        title: t('setup.provider.sectionChina'),
        description: t('setup.provider.sectionChinaDesc'),
      }
  }
}

function ProviderLogo({
  preset,
  size = 40,
}: {
  preset: Pick<ProviderPresetForUI, 'key' | 'logoUrl' | 'color' | 'initials'>
  size?: number
}): React.ReactElement {
  const logoUrl = preset.logoUrl || getProviderLogo(preset.key)

  if (logoUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          background: '#fff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src={logoUrl}
          alt={preset.initials}
          style={{ width: size - 10, height: size - 10, objectFit: 'contain' }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        flexShrink: 0,
        background: preset.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: Math.round(size * 0.34),
        letterSpacing: '-0.03em',
        userSelect: 'none',
      }}
    >
      {preset.initials}
    </div>
  )
}

function StepProvider({ data, updateData }: Props): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [sections, setSections] = useState<ProviderPresetSection[]>([])
  const [apiKey, setApiKey] = useState(data.apiKey)
  const [verifyState, setVerifyState] = useState<VerifyState>(data.apiKey ? 'success' : 'idle')
  const [verifyMessage, setVerifyMessage] = useState('')
  const [remoteSyncState, setRemoteSyncState] = useState<'idle' | 'syncing' | 'synced' | 'failed'>(
    'idle'
  )
  const [mode, setMode] = useState<ProviderMode>(
    data.platformKey === '__custom__' ? 'custom' : 'preset'
  )

  const [customProviderId, setCustomProviderId] = useState(
    data.platformKey === '__custom__' ? data.providerKey : ''
  )
  const [customBaseUrl, setCustomBaseUrl] = useState(
    typeof data.channels.__customProvider__?.baseUrl === 'string'
      ? String(data.channels.__customProvider__.baseUrl)
      : ''
  )
  const [customApiType, setCustomApiType] = useState<string>(
    typeof data.channels.__customProvider__?.apiType === 'string'
      ? String(data.channels.__customProvider__.apiType)
      : 'openai-completions'
  )
  const [customModelId, setCustomModelId] = useState(
    data.platformKey === '__custom__' ? data.modelId : ''
  )
  const [customApiKey, setCustomApiKey] = useState(
    data.platformKey === '__custom__' ? data.apiKey : ''
  )
  const [customSupportsImage, setCustomSupportsImage] = useState(
    Array.isArray(data.channels.__customProvider__?.input) &&
      data.channels.__customProvider__.input.includes('image')
  )

  useEffect(() => {
    let alive = true

    const loadPresets = async (): Promise<void> => {
      const presetSections = await window.api.provider.getPresets()
      if (!alive) return
      setSections(presetSections as ProviderPresetSection[])
    }

    const syncRemotePresets = async (): Promise<void> => {
      try {
        await loadPresets()
        if (!alive) return

        setRemoteSyncState('syncing')
        const result = (await window.api.remotePresets.refresh()) as {
          success: boolean
          error?: string
        }
        if (!alive) return

        if (result.success) {
          await loadPresets()
          if (!alive) return
          setRemoteSyncState('synced')
        } else {
          setRemoteSyncState('failed')
        }
      } catch {
        if (!alive) return
        setRemoteSyncState('failed')
      }
    }

    syncRemotePresets().catch(() => {
      if (alive) setRemoteSyncState('failed')
    })

    return () => {
      alive = false
    }
  }, [])

  const allPresets = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const selectedPreset = allPresets.find((preset) => preset.key === data.providerKey)
  const selectedPlatform = selectedPreset?.platforms.find(
    (platform) => platform.key === data.platformKey
  )
  const isCustomMode = mode === 'custom'

  const selectProvider = (preset: ProviderPresetForUI) => {
    setMode('preset')
    updateData({
      providerKey: preset.key,
      platformKey: preset.platforms[0]?.key || '',
      apiKey: '',
      modelId: '',
    })
    setApiKey('')
    setVerifyState('idle')
    setVerifyMessage('')
  }

  const enterCustomMode = () => {
    setMode('custom')
    updateData({ providerKey: '', platformKey: '__custom__', apiKey: '', modelId: '' })
    setVerifyState('idle')
    setVerifyMessage('')
  }

  const selectPlatform = (platformKey: string) => {
    updateData({ platformKey, apiKey: '', modelId: '' })
    setApiKey('')
    setVerifyState('idle')
    setVerifyMessage('')
  }

  const handleVerify = async () => {
    if (!apiKey.trim() || !data.providerKey || !data.platformKey || !data.modelId) return

    setVerifyState('verifying')
    setVerifyMessage('')
    try {
      const result = await window.api.provider.verify(
        data.providerKey,
        data.platformKey,
        apiKey.trim(),
        data.modelId
      )
      if (result.success) {
        setVerifyState('success')
        updateData({ apiKey: apiKey.trim() })
        message.success(t('setup.provider.verifyPassed'))
        return
      }
      setVerifyState('failed')
      setVerifyMessage(result.message || t('setup.provider.verifyFailed'))
    } catch {
      setVerifyState('failed')
      setVerifyMessage(t('setup.provider.verifyFailed'))
    }
  }

  const openApiKeyUrl = () => {
    if (selectedPlatform?.apiKeyUrl) {
      window.api.shell.openExternal(selectedPlatform.apiKeyUrl)
    }
  }

  useEffect(() => {
    if (!isCustomMode) return
    updateData({
      providerKey: customProviderId.trim(),
      platformKey: '__custom__',
      apiKey: customApiKey.trim(),
      modelId: customModelId.trim(),
      channels: {
        ...data.channels,
        __customProvider__: {
          baseUrl: customBaseUrl.trim(),
          apiType: customApiType,
          input: customSupportsImage ? ['text', 'image'] : ['text'],
        } as Record<string, unknown>,
      },
    })
  }, [
    customApiKey,
    customApiType,
    customBaseUrl,
    customModelId,
    customProviderId,
    customSupportsImage,
    data.channels,
    isCustomMode,
    updateData,
  ])

  const matchedModel = selectedPlatform?.models.find((model) => model.id === data.modelId)

  const renderProviderCard = (
    preset: ProviderPresetForUI,
    sectionKey: ProviderPresetSection['key']
  ) => {
    const isSelected = !isCustomMode && data.providerKey === preset.key

    return (
      <Card
        key={preset.key}
        hoverable
        size="small"
        onClick={() => selectProvider(preset)}
        style={{
          cursor: 'pointer',
          borderColor: isSelected ? '#FF4D2A' : undefined,
          borderWidth: isSelected ? 2 : 1,
          boxShadow: isSelected ? '0 8px 24px rgba(255, 77, 42, 0.12)' : undefined,
        }}
      >
        <Flex justify="space-between" align="start" gap={12}>
          <Flex gap={12} align="start" style={{ minWidth: 0 }}>
            <ProviderLogo preset={preset} />
            <div style={{ minWidth: 0 }}>
              <Flex align="center" gap={8} wrap="wrap">
                <Text strong>{preset.name}</Text>
                {sectionKey === 'recommended' && (
                  <Tag
                    color="orange"
                    style={{
                      marginInlineEnd: 0,
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {t('setup.provider.recommendedBadge')}
                  </Tag>
                )}
              </Flex>
              {preset.tagline && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {preset.tagline}
                </Text>
              )}
            </div>
          </Flex>
          {isSelected ? (
            <CheckCircleFilled style={{ color: '#FF4D2A', fontSize: 18, flexShrink: 0 }} />
          ) : (
            <RightOutlined style={{ color: '#bfbfbf', fontSize: 12, flexShrink: 0 }} />
          )}
        </Flex>
      </Card>
    )
  }

  const renderPresetConfig = () => {
    if (!selectedPreset || !selectedPlatform) {
      return (
        <Card>
          <Text type="secondary">{t('setup.provider.subtitle')}</Text>
        </Card>
      )
    }

    return (
      <Card>
        <Flex vertical gap={18}>
          <Flex gap={12} align="center">
            <ProviderLogo preset={selectedPreset} size={44} />
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 16 }}>
                {selectedPreset.name}
              </Text>
              {selectedPreset.tagline && (
                <Text type="secondary" style={{ display: 'block', marginTop: 2 }}>
                  {selectedPreset.tagline}
                </Text>
              )}
            </div>
          </Flex>

          {selectedPreset.platforms.length > 1 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('setup.provider.selectPlatform')}
              </Text>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 10,
                }}
              >
                {selectedPreset.platforms.map((platform) => {
                  const isActive = data.platformKey === platform.key
                  return (
                    <button
                      key={platform.key}
                      type="button"
                      onClick={() => selectPlatform(platform.key)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: isActive ? '1px solid #FF4D2A' : '1px solid #e8e8e8',
                        background: isActive ? '#fff7f5' : '#fff',
                        boxShadow: isActive ? '0 0 0 2px rgba(255, 77, 42, 0.08)' : 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isActive ? '#CC3D21' : '#262626',
                          lineHeight: 1.35,
                          minHeight: 36,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={platform.name}
                      >
                        {platform.name}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          color: '#8c8c8c',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={platform.baseUrl}
                      >
                        {platform.baseUrl.replace(/^https?:\/\//, '')}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('setup.provider.selectModel')}
            </Text>
            <AutoComplete
              style={{ width: '100%' }}
              placeholder={t('setup.provider.modelPlaceholder')}
              value={data.modelId}
              onChange={(value) => {
                updateData({ modelId: value })
                setVerifyState('idle')
              }}
              options={selectedPlatform.models.map((model) => ({
                value: model.id,
                label: (
                  <Flex justify="space-between" gap={10} align="start">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Tooltip title={model.name}>
                        <div
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {model.name}
                        </div>
                      </Tooltip>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          display: 'block',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {model.id}
                      </Text>
                    </div>
                    <Flex align="center" gap={4} style={{ flexShrink: 0, paddingTop: 2 }}>
                      {model.input.includes('image') && (
                        <Tooltip title={t('setup.provider.customSupportsImage')}>
                          <PictureOutlined style={{ color: '#8c8c8c', fontSize: 11 }} />
                        </Tooltip>
                      )}
                    </Flex>
                  </Flex>
                ),
              }))}
              filterOption={(input, option) =>
                (option?.value as string | undefined)
                  ?.toLowerCase()
                  .includes(input.toLowerCase()) ?? false
              }
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
              {t('setup.provider.modelHint')}
            </Text>
            {matchedModel && (
              <div
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: '#fafafa',
                  border: '1px solid #f0f0f0',
                }}
              >
                <Tooltip title={matchedModel.name}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {matchedModel.name}
                  </div>
                </Tooltip>
                <Text
                  type="secondary"
                  style={{
                    display: 'block',
                    marginTop: 4,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {matchedModel.id}
                </Text>
              </div>
            )}
          </div>

          <div>
            <Flex
              justify="space-between"
              align="center"
              wrap="wrap"
              gap={8}
              style={{ marginBottom: 8 }}
            >
              <Text strong>{t('setup.provider.inputApiKey')}</Text>
              <Space size={12} wrap>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('setup.provider.envKeyHint', { envKey: selectedPlatform.envKey })}
                </Text>
                {selectedPlatform.apiKeyUrl && (
                  <Button
                    type="link"
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={openApiKeyUrl}
                    style={{ padding: 0 }}
                  >
                    {t('setup.provider.getApiKey')}
                  </Button>
                )}
              </Space>
            </Flex>

            <Space.Compact style={{ width: '100%' }}>
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder={t('setup.provider.placeholder', { name: selectedPreset.name })}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setVerifyState('idle')
                }}
                onPressEnter={handleVerify}
                status={verifyState === 'failed' ? 'error' : undefined}
              />
              <Button
                type="primary"
                onClick={handleVerify}
                loading={verifyState === 'verifying'}
                disabled={!apiKey.trim() || !data.modelId}
              >
                {t('common.verify')}
              </Button>
            </Space.Compact>
          </div>

          {verifyState === 'success' && (
            <Alert
              type="success"
              showIcon
              message={t('setup.provider.verifySuccess')}
              description={t('setup.provider.verifyReady')}
            />
          )}

          {verifyState === 'failed' && (
            <Alert
              type="error"
              showIcon
              message={t('setup.provider.verifyFailed')}
              description={verifyMessage}
            />
          )}
        </Flex>
      </Card>
    )
  }

  const renderCustomForm = () => (
    <Card>
      <Flex vertical gap={16}>
        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('setup.provider.customModeTitle')}
          </Text>
          <Text type="secondary">{t('setup.provider.customModeDesc')}</Text>
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('setup.provider.customProviderId')}
          </Text>
          <Input
            placeholder={t('setup.provider.customProviderIdPlaceholder')}
            value={customProviderId}
            onChange={(e) => setCustomProviderId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
          />
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('setup.provider.customBaseUrl')}
          </Text>
          <Input
            placeholder={t('setup.provider.customBaseUrlPlaceholder')}
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
          />
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('setup.provider.customApiType')}
          </Text>
          <Select
            style={{ width: '100%' }}
            value={customApiType}
            onChange={setCustomApiType}
            options={API_TYPE_OPTIONS}
          />
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('setup.provider.customModelId')}
          </Text>
          <Input
            placeholder={t('setup.provider.customModelIdPlaceholder')}
            value={customModelId}
            onChange={(e) => setCustomModelId(e.target.value)}
          />
        </div>

        <div>
          <Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('setup.provider.customApiKey')}
          </Text>
          <Input.Password
            prefix={<KeyOutlined />}
            placeholder={t('setup.provider.customApiKeyPlaceholder')}
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
          />
        </div>

        <Flex align="center" gap={8}>
          <Switch size="small" checked={customSupportsImage} onChange={setCustomSupportsImage} />
          <Text>{t('setup.provider.customSupportsImage')}</Text>
        </Flex>
      </Flex>
    </Card>
  )

  return (
    <div style={{ maxWidth: 1120, width: '100%' }}>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 8 }}>
        {t('setup.provider.title')}
      </Title>
      <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
        {t('setup.provider.subtitle')}
      </Text>
      {remoteSyncState !== 'idle' && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Tag color={remoteSyncState === 'failed' ? 'default' : 'processing'} style={{ margin: 0 }}>
            {remoteSyncState === 'syncing'
              ? t('setup.provider.syncingPresets')
              : remoteSyncState === 'synced'
                ? t('setup.provider.syncedPresets')
                : t('setup.provider.syncPresetsFailed')}
          </Tag>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <Card bodyStyle={{ padding: 16 }}>
          <Flex vertical gap={18}>
            {sections.map((section) => {
              const copy = getSectionCopy(section.key, t)
              return (
                <div key={section.key}>
                  <div style={{ marginBottom: 10 }}>
                    <Text strong>{copy.title}</Text>
                    <Text type="secondary" style={{ display: 'block', marginTop: 2, fontSize: 12 }}>
                      {copy.description}
                    </Text>
                  </div>
                  <Flex vertical gap={12}>
                    {section.items.map((preset) => renderProviderCard(preset, section.key))}
                  </Flex>
                </div>
              )
            })}

            <Card
              hoverable
              onClick={enterCustomMode}
              style={{
                cursor: 'pointer',
                borderColor: isCustomMode ? '#FF4D2A' : undefined,
                borderWidth: isCustomMode ? 2 : 1,
              }}
            >
              <Flex justify="space-between" align="center" gap={12}>
                <div>
                  <Text strong>{t('setup.provider.customEntryTitle')}</Text>
                  <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                    {t('setup.provider.customEntryDesc')}
                  </Text>
                </div>
                <RightOutlined style={{ color: isCustomMode ? '#FF4D2A' : '#bfbfbf' }} />
              </Flex>
            </Card>
          </Flex>
        </Card>

        <div style={{ position: 'sticky', top: 0 }}>
          {isCustomMode ? renderCustomForm() : renderPresetConfig()}
        </div>
      </div>
    </div>
  )
}

export default StepProvider
