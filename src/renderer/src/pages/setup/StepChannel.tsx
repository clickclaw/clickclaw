/**
 * Setup Step 3 — 渠道配置
 *
 * 从 channel:get-presets IPC 动态加载预设（国内/国际分区）。
 * Setup 向导只配置凭证，策略字段可在 ChannelsPage 中二次编辑。
 */

import { useEffect, useState } from 'react'
import { Button, Input, Select, Tag, Typography, Flex, Spin, theme } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { ChannelMonogram } from '../channels/components/ChannelMonogram'
import { ChannelQuickAuthSection } from '../channels/components/ChannelQuickAuthSection'
import {
  areRequiredChannelFieldsFilled,
  getChannelCredentialStatus,
} from '../channels/channels-page.utils'
import type { ChannelPresetForUI } from '../channels/channels-page.types'
import type { SetupData } from './SetupPage'

const { Title, Text, Paragraph } = Typography

interface Props {
  data: SetupData
  updateData: (partial: Partial<SetupData>) => void
}

function ChannelGroup({
  label,
  presets,
  channels,
  expandedKey,
  onToggle,
  onFieldChange,
  updateChannelValues,
}: {
  label: string
  presets: ChannelPresetForUI[]
  channels: Record<string, Record<string, unknown>>
  expandedKey: string | null
  onToggle: (key: string) => void
  onFieldChange: (channelKey: string, fieldKey: string, value: string) => void
  updateChannelValues: (channelKey: string, values: Record<string, string>) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: token.colorTextQuaternary,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <Flex vertical gap={8}>
        {presets.map((preset) => {
          const isExpanded = expandedKey === preset.key
          const channelData = channels[preset.key] || {}
          const credentialStatus = getChannelCredentialStatus(channelData, preset)
          const configured = credentialStatus === 'complete'
          const incomplete = credentialStatus === 'partial'

          return (
            <div
              key={preset.key}
              style={{
                borderRadius: 10,
                border: `1.5px solid ${configured ? preset.color + '60' : isExpanded ? token.colorBorder : token.colorBorderSecondary}`,
                background: configured ? preset.color + '06' : token.colorBgContainer,
                overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}
            >
              <div
                onClick={() => onToggle(preset.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                }}
              >
                <ChannelMonogram
                  channelKey={preset.key}
                  initials={preset.initials}
                  color={preset.color}
                  size={38}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: token.colorText,
                      lineHeight: 1.2,
                    }}
                  >
                    {preset.name}
                  </div>
                  {preset.tagline && (
                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
                      {preset.tagline}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {configured && (
                    <Tag color="success" icon={<CheckCircleFilled />} style={{ margin: 0 }}>
                      {t('setup.channel.configured')}
                    </Tag>
                  )}
                  {incomplete && (
                    <Tag color="warning" icon={<ExclamationCircleFilled />} style={{ margin: 0 }}>
                      {t('setup.channel.pending')}
                    </Tag>
                  )}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isExpanded ? token.colorFillSecondary : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: token.colorTextTertiary,
                      fontSize: 14,
                      transition: 'transform 0.18s',
                      transform: isExpanded ? 'rotate(45deg)' : 'none',
                    }}
                  >
                    <PlusOutlined />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div
                  style={{
                    borderTop: `1px solid ${token.colorBorderSecondary}`,
                    padding: '14px 14px 16px',
                  }}
                >
                  <Flex vertical gap={10}>
                    {preset.fields.map((field) => (
                      <div key={field.key}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 5,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: 500 }}>{field.label}</Text>
                          {field.apiKeyUrl && (
                            <Button
                              type="link"
                              size="small"
                              icon={<LinkOutlined />}
                              onClick={(e) => {
                                e.stopPropagation()
                                window.api.shell.openExternal(field.apiKeyUrl!)
                              }}
                              style={{
                                padding: 0,
                                fontSize: 12,
                                height: 'auto',
                                color: token.colorTextTertiary,
                              }}
                            >
                              {t('setup.channel.getKey')}
                            </Button>
                          )}
                        </div>

                        {field.type === 'password' ? (
                          <Input.Password
                            placeholder={field.placeholder}
                            value={(channelData[field.key] as string) || ''}
                            onChange={(e) => onFieldChange(preset.key, field.key, e.target.value)}
                            autoComplete="off"
                          />
                        ) : field.type === 'select' ? (
                          <Select
                            placeholder={field.placeholder}
                            value={(channelData[field.key] as string) || undefined}
                            onChange={(value) => onFieldChange(preset.key, field.key, value)}
                            options={field.options?.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                          />
                        ) : (
                          <Input
                            placeholder={field.placeholder}
                            value={(channelData[field.key] as string) || ''}
                            onChange={(e) => onFieldChange(preset.key, field.key, e.target.value)}
                          />
                        )}

                        {field.helpText && (
                          <Text
                            type="secondary"
                            style={{ fontSize: 11, display: 'block', marginTop: 3 }}
                          >
                            {field.helpText}
                          </Text>
                        )}
                      </div>
                    ))}
                  </Flex>

                  <ChannelQuickAuthSection
                    channelKey={preset.key}
                    getFieldValue={(key) => channelData[key]}
                    setFieldValues={(values) => updateChannelValues(preset.key, values)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </Flex>
    </div>
  )
}

function StepChannel({ data, updateData }: Props): React.ReactElement {
  const { t } = useTranslation()
  const [presets, setPresets] = useState<{
    domestic: ChannelPresetForUI[]
    international: ChannelPresetForUI[]
  }>({ domestic: [], international: [] })
  const [loadingPresets, setLoadingPresets] = useState(true)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    window.api.channel
      .getPresets()
      .then((result) => {
        setPresets(result as typeof presets)
      })
      .catch(() => {
        // 加载失败时保持空列表，不阻塞向导流程
      })
      .finally(() => {
        setLoadingPresets(false)
      })
  }, [])

  const channels = data.channels || {}
  const allPresets = [...presets.domestic, ...presets.international]
  const configuredCount = allPresets.filter((preset) =>
    areRequiredChannelFieldsFilled(channels[preset.key] || {}, preset)
  ).length

  const handleToggle = (key: string): void => {
    if (expandedKey === key) {
      setExpandedKey(null)
    } else {
      setExpandedKey(key)
      if (!channels[key]) {
        updateData({ channels: { ...channels, [key]: { enabled: true } } })
      }
    }
  }

  const handleFieldChange = (channelKey: string, fieldKey: string, value: string): void => {
    const existing = channels[channelKey] || { enabled: true }
    updateData({
      channels: {
        ...channels,
        [channelKey]: { ...existing, [fieldKey]: value },
      },
    })
  }

  const updateChannelValues = (channelKey: string, values: Record<string, string>): void => {
    const existing = channels[channelKey] || { enabled: true }
    updateData({
      channels: {
        ...channels,
        [channelKey]: { ...existing, ...values },
      },
    })
  }

  const hasPresets = allPresets.length > 0

  return (
    <div style={{ maxWidth: 640, width: '100%' }}>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 6 }}>
        {t('setup.channel.title')}
      </Title>
      <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 24, fontSize: 13 }}>
        {t('setup.channel.subtitle')}
      </Paragraph>

      {configuredCount > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Tag color="success">{t('setup.channel.readyCount', { count: configuredCount })}</Tag>
        </div>
      )}

      {loadingPresets ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin />
        </div>
      ) : hasPresets ? (
        <>
          {presets.domestic.length > 0 && (
            <ChannelGroup
              label={t('channels.domestic')}
              presets={presets.domestic}
              channels={channels}
              expandedKey={expandedKey}
              onToggle={handleToggle}
              onFieldChange={handleFieldChange}
              updateChannelValues={updateChannelValues}
            />
          )}
          {presets.international.length > 0 && (
            <ChannelGroup
              label={t('channels.international')}
              presets={presets.international}
              channels={channels}
              expandedKey={expandedKey}
              onToggle={handleToggle}
              onFieldChange={handleFieldChange}
              updateChannelValues={updateChannelValues}
            />
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Text type="secondary">{t('channels.noChannels')}</Text>
        </div>
      )}

      <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 8, fontSize: 12 }}>
        {t('setup.channel.skipHint')}
      </Paragraph>

    </div>
  )
}

export default StepChannel
