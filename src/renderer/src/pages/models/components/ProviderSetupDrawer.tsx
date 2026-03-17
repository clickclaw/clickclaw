import { useEffect, useState } from 'react'
import { App, Button, Checkbox, Drawer, Input, Select } from 'antd'
import { CheckCircleFilled } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import type { ApiType, ProviderConfig, ProviderSetupDrawerProps } from '../model-page.types'
import { getBrandByKey, getRecommendedModelIds } from '../model-page.utils'
import { ProviderAvatar, ProviderAvatarByKey } from './ProviderAvatar'

const API_TYPE_OPTIONS = [
  { value: 'openai-completions', label: 'OpenAI Chat Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
  { value: 'google-generative-ai', label: 'Google Generative AI' },
]

export function ProviderSetupDrawer({
  open,
  brand,
  editingEntry,
  brands,
  onClose,
  onSave,
  saving,
}: ProviderSetupDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const isEdit = !!editingEntry
  const isCustom = brand === 'custom' || (isEdit && !getBrandByKey(editingEntry!.key, brands))
  const presetBrand = brand !== 'custom' && brand !== null ? brand : null

  const [apiKey, setApiKey] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customApi, setCustomApi] = useState<ApiType>('openai-completions')
  const [selectedPlatformKey, setSelectedPlatformKey] = useState<string>('')
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])
  const [verifyState, setVerifyState] = useState<'idle' | 'verifying' | 'success' | 'failed'>(
    'idle'
  )

  const effectivePlatform = presetBrand
    ? (presetBrand.platforms.find((p) => p.key === selectedPlatformKey) ?? presetBrand.platforms[0])
    : null

  useEffect(() => {
    if (!open) return
    setApiKey(editingEntry?.config.apiKey || '')
    setVerifyState('idle')
    if (isEdit) {
      setCustomKey(editingEntry!.key)
      setCustomBaseUrl(editingEntry!.config.baseUrl || '')
      setCustomApi(editingEntry!.config.api || 'openai-completions')
      const matchedPlatform = presetBrand?.platforms.find((p) => p.key === editingEntry!.key)
      setSelectedPlatformKey(matchedPlatform?.key ?? presetBrand?.platforms[0]?.key ?? '')
      setSelectedModelIds((editingEntry!.config.models || []).map((m) => m.id))
    } else {
      setCustomKey(presetBrand?.key || '')
      setCustomBaseUrl('')
      setCustomApi('openai-completions')
      const firstPlatform = presetBrand?.platforms[0]
      setSelectedPlatformKey(firstPlatform?.key ?? '')
      setSelectedModelIds(firstPlatform ? getRecommendedModelIds(firstPlatform.models) : [])
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = isCustom
    ? customKey.trim() !== '' && customBaseUrl.trim() !== ''
    : isEdit || !effectivePlatform || selectedModelIds.length > 0

  const handleVerify = async (): Promise<void> => {
    if (!apiKey.trim() || !effectivePlatform) return
    setVerifyState('verifying')
    try {
      const modelId = selectedModelIds[0] || effectivePlatform.models[0]?.id || ''
      const providerKeyForVerify = presetBrand?.key || effectivePlatform.key
      const result = (await window.api.provider.verify(
        providerKeyForVerify,
        effectivePlatform.key,
        apiKey.trim(),
        modelId
      )) as { success: boolean; message?: string }
      if (result.success) {
        setVerifyState('success')
        message.success(t('setup.provider.verifyPassed'))
      } else {
        setVerifyState('failed')
        message.error(result.message || t('setup.provider.verifyFailed'))
      }
    } catch {
      setVerifyState('failed')
      message.error(t('setup.provider.verifyFailed'))
    }
  }

  const handleSave = async () => {
    const providerKey = isEdit
      ? editingEntry!.key
      : isCustom
        ? customKey.trim()
        : effectivePlatform!.key
    const config: ProviderConfig = isEdit
      ? {
          ...editingEntry!.config,
          apiKey: apiKey.trim() || undefined,
          ...(isCustom ? { baseUrl: customBaseUrl.trim(), api: customApi } : {}),
        }
      : {
          api: isCustom ? customApi : effectivePlatform!.api,
          baseUrl: isCustom ? customBaseUrl.trim() : effectivePlatform!.baseUrl,
          apiKey: apiKey.trim() || undefined,
          models: isCustom
            ? []
            : effectivePlatform!.models.filter((m) => selectedModelIds.includes(m.id)),
        }
    await onSave(providerKey, config)
  }

  const titleNode = isEdit ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ProviderAvatarByKey providerKey={editingEntry!.key} brands={brands} size={28} />
      <span style={{ fontWeight: 700 }}>
        {t('models.editProvider2', { name: presetBrand?.name || editingEntry!.key })}
      </span>
    </div>
  ) : presetBrand ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ProviderAvatar
        providerKey={presetBrand.key}
        logoUrl={presetBrand.logoUrl}
        color={presetBrand.color}
        initials={presetBrand.initials}
        size={28}
      />
      <span style={{ fontWeight: 700 }}>
        {t('models.addProvider3', { name: presetBrand.name })}
      </span>
    </div>
  ) : (
    <span style={{ fontWeight: 700 }}>{t('models.customProviderTitle')}</span>
  )

  return (
    <Drawer
      title={titleNode}
      open={open}
      onClose={onClose}
      width={420}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      styles={{ body: { paddingTop: 24 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {effectivePlatform ? (
            <Button
              icon={<CheckCircleFilled />}
              loading={verifyState === 'verifying'}
              disabled={!apiKey.trim()}
              onClick={handleVerify}
              style={
                verifyState === 'success'
                  ? { color: '#52c41a', borderColor: '#b7eb8f' }
                  : verifyState === 'failed'
                    ? { color: '#ff4d4f', borderColor: '#ffccc7' }
                    : {}
              }
            >
              {verifyState === 'verifying'
                ? t('channels.configDrawer.verifying')
                : t('common.verify')}
            </Button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button
              type="primary"
              loading={saving}
              disabled={!canSave}
              onClick={handleSave}
              style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
            >
              {isEdit ? t('models.saveEdit') : t('models.addProvider')}
            </Button>
          </div>
        </div>
      }
    >
      {presetBrand && presetBrand.platforms.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#aaa',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {t('models.selectPlatform')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {presetBrand.platforms.map((platform) => {
              const isSelected = platform.key === selectedPlatformKey
              return (
                <div
                  key={platform.key}
                  onClick={() => {
                    setSelectedPlatformKey(platform.key)
                    if (!isEdit) {
                      setSelectedModelIds(getRecommendedModelIds(platform.models))
                    }
                    setVerifyState('idle')
                  }}
                  style={{
                    flex: '1 1 0',
                    minWidth: 100,
                    padding: '10px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #FF4D2A' : '2px solid #e8e8e8',
                    background: isSelected ? '#fff8f6' : '#fafafa',
                    transition: 'all 0.15s',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: isSelected ? '#FF4D2A' : '#333',
                    }}
                  >
                    {platform.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#aaa',
                      marginTop: 2,
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {platform.baseUrl.replace(/^https?:\/\//, '')}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ height: 1, background: '#f0f0f0', marginTop: 20 }} />
        </div>
      )}

      {isCustom && (
        <>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 6,
                color: '#333',
              }}
            >
              {t('models.providerKey')}
              <span style={{ fontWeight: 400, color: '#aaa', fontSize: 12, marginLeft: 6 }}>
                {t('models.providerKeyReadOnly')}
              </span>
            </label>
            <Input
              placeholder="my-proxy"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              disabled={isEdit}
              style={isEdit ? { fontFamily: 'monospace', background: '#fafafa' } : {}}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 6,
                color: '#333',
              }}
            >
              {t('models.baseUrl')}
            </label>
            <Input
              placeholder="https://api.example.com/v1"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 6,
                color: '#333',
              }}
            >
              {t('models.apiType')}
            </label>
            <Select
              style={{ width: '100%' }}
              value={customApi}
              onChange={(v) => setCustomApi(v)}
              options={API_TYPE_OPTIONS}
            />
          </div>
          <div style={{ height: 1, background: '#f0f0f0', marginBottom: 20 }} />
        </>
      )}

      {presetBrand && !isEdit && presetBrand.tagline && (
        <div
          style={{
            background: '#fafaf8',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            border: '1px solid #ebebeb',
            fontSize: 13,
            color: '#555',
            lineHeight: 1.6,
          }}
        >
          {presetBrand.tagline}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label
          style={{
            display: 'block',
            fontWeight: 600,
            fontSize: 13,
            marginBottom: 6,
            color: '#333',
          }}
        >
          {t('models.apiKey')}
        </label>
        <Input.Password
          size="large"
          placeholder={
            presetBrand ? `${t('models.apiKey')} — ${presetBrand.name}` : t('models.apiKey')
          }
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value)
            setVerifyState('idle')
          }}
        />
        {effectivePlatform && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa' }}>{t('models.noApiKeyHint')} </span>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 12, height: 'auto', color: '#FF4D2A' }}
              onClick={() => window.api.shell.openExternal(effectivePlatform.apiKeyUrl)}
            >
              {t('models.applyApiKey')}
            </Button>
          </div>
        )}
      </div>

      {effectivePlatform && !isEdit && effectivePlatform.models.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#aaa', fontWeight: 600, marginBottom: 8 }}>
            {t('models.selectModels')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Button
              size="small"
              onClick={() => setSelectedModelIds(effectivePlatform.models.map((m) => m.id))}
            >
              {t('models.selectAllModels')}
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedModelIds(getRecommendedModelIds(effectivePlatform.models))}
            >
              {t('models.selectRecommendedModels')}
            </Button>
            <Button size="small" onClick={() => setSelectedModelIds([])}>
              {t('models.clearModelSelection')}
            </Button>
          </div>
          {effectivePlatform.models.map((m) => {
            const checked = selectedModelIds.includes(m.id)
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  marginBottom: 3,
                  background: checked ? '#fff7f5' : '#fafafa',
                  borderRadius: 6,
                  border: checked ? '1px solid #ffd8cc' : '1px solid #f0f0f0',
                }}
              >
                <Checkbox
                  checked={checked}
                  onChange={(e) => {
                    setSelectedModelIds((prev) =>
                      e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                    )
                  }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#555', flex: 1 }}>
                  {m.id}
                </span>
                {m.input?.includes('image') && (
                  <span
                    style={{
                      fontSize: 10,
                      color: '#7c3aed',
                      background: '#f5f3ff',
                      padding: '1px 5px',
                      borderRadius: 3,
                    }}
                  >
                    {t('models.imageTag')}
                  </span>
                )}
              </div>
            )
          })}
          <div style={{ fontSize: 11, color: '#ccc', marginTop: 6 }}>
            {selectedModelIds.length > 0
              ? t('models.selectedModelCount', { count: selectedModelIds.length })
              : t('models.selectAtLeastOneModel')}
          </div>
        </div>
      )}
    </Drawer>
  )
}
