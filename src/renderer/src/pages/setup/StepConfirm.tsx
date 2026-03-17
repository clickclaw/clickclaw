import { useEffect, useState } from 'react'
import { Card, Typography, Flex, Tag, Divider, theme } from 'antd'
import { CheckCircleFilled, WarningFilled } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { SetupData } from './SetupPage'

const { Title, Paragraph, Text } = Typography
const { useToken } = theme

// ========== 类型 ==========

interface ChannelPresetMin {
  key: string
  name: string
  color: string
  initials: string
  fields: Array<{ key: string; required: boolean }>
}

// ========== 工具 ==========

const CHANNEL_META_KEYS = new Set([
  'enabled',
  'dmPolicy',
  'allowFrom',
  'groupPolicy',
  'groupAllowFrom',
])

/** 无预设时的最小 fallback */
function makeFallback(key: string): ChannelPresetMin {
  const letters = key.replace(/[^a-zA-Z]/g, '')
  return {
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    color: '#8c8c8c',
    initials: (letters.slice(0, 2) || key.slice(0, 2)).toUpperCase(),
    fields: [],
  }
}

// ========== Monogram ==========

function Monogram({ initials, color }: { initials: string; color: string }): React.ReactElement {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        background: color + '18',
        border: `1.5px solid ${color}35`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color,
        fontWeight: 800,
        fontSize: 9,
        letterSpacing: '-0.03em',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {initials}
    </div>
  )
}

// ========== 配置行 ==========

function ConfigRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  const { token } = useToken()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '2px 0' }}>
      <Text type="secondary" style={{ fontSize: 13, width: 108, flexShrink: 0, paddingTop: 2 }}>
        {label}
      </Text>
      <div style={{ flex: 1, minWidth: 0, color: token.colorText }}>{children}</div>
    </div>
  )
}

// ========== Props ==========

interface Props {
  data: SetupData
}

// ========== 主组件 ==========

function StepConfirm({ data }: Props): React.ReactElement {
  const { t } = useTranslation()
  const { token } = useToken()
  const [presetMap, setPresetMap] = useState<Record<string, ChannelPresetMin>>({})

  // 加载渠道预设（仅用于展示名称/颜色/凭证校验）
  useEffect(() => {
    window.api.channel
      .getPresets()
      .then((result) => {
        const map: Record<string, ChannelPresetMin> = {}
        const all = [
          ...(result as { domestic: ChannelPresetMin[]; international: ChannelPresetMin[] })
            .domestic,
          ...(result as { domestic: ChannelPresetMin[]; international: ChannelPresetMin[] })
            .international,
        ]
        for (const p of all) map[p.key] = p
        setPresetMap(map)
      })
      .catch(() => {
        /* 加载失败不阻塞确认页 */
      })
  }, [])

  const detection = data.detection as Record<string, unknown> | null
  const bundledOpenclaw = detection?.bundledOpenclaw as Record<string, unknown> | undefined
  const channelKeys = Object.keys(data.channels || {})

  /** 判断指定渠道凭证是否已填完整 */
  const isCredsFilled = (key: string): boolean => {
    const config = data.channels[key] || {}
    const preset = presetMap[key]
    if (preset) {
      return preset.fields
        .filter((f) => f.required)
        .every((f) => {
          const v = config[f.key]
          return typeof v === 'string' && v.trim() !== ''
        })
    }
    return Object.keys(config).some((k) => !CHANNEL_META_KEYS.has(k) && config[k])
  }

  return (
    <div style={{ maxWidth: 560, width: '100%' }}>
      <Title level={4} style={{ textAlign: 'center', marginBottom: 6 }}>
        {t('setup.confirm.title')}
      </Title>
      <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 20 }}>
        {t('setup.confirm.subtitle')}
      </Paragraph>

      {/* 就绪状态提示条 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <CheckCircleFilled style={{ color: '#52c41a', fontSize: 15 }} />
        <Text style={{ color: '#135200', fontWeight: 500, fontSize: 13 }}>
          {t('setup.confirm.readyLabel')}
        </Text>
      </div>

      {/* 配置汇总卡片 */}
      <Card
        style={{ borderColor: token.colorBorderSecondary }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        {/* AI 模型 */}
        <ConfigRow label={t('setup.confirm.providerLabel')}>
          <Flex gap={6} align="center" wrap="wrap">
            <Tag color="blue" style={{ margin: 0 }}>
              {data.platformKey || data.providerKey}
            </Tag>
            {data.modelId && (
              <Text type="secondary" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                {data.modelId}
              </Text>
            )}
          </Flex>
        </ConfigRow>

        <Divider style={{ margin: '12px 0' }} />

        {/* 渠道 */}
        <ConfigRow label={t('setup.confirm.channelLabel')}>
          {channelKeys.length > 0 ? (
            <Flex vertical gap={6}>
              {channelKeys.map((key) => {
                const preset = presetMap[key] ?? makeFallback(key)
                const filled = isCredsFilled(key)
                return (
                  <Flex key={key} align="center" gap={8}>
                    <Monogram initials={preset.initials} color={preset.color} />
                    <Text style={{ fontSize: 13, fontWeight: 500 }}>{preset.name}</Text>
                    {filled ? (
                      <Flex align="center" gap={3} style={{ color: '#52c41a', fontSize: 12 }}>
                        <CheckCircleFilled style={{ fontSize: 11 }} />
                        <span>{t('setup.confirm.credsFilled')}</span>
                      </Flex>
                    ) : (
                      <Flex align="center" gap={3} style={{ color: '#faad14', fontSize: 12 }}>
                        <WarningFilled style={{ fontSize: 11 }} />
                        <span>{t('setup.confirm.credsMissing')}</span>
                      </Flex>
                    )}
                  </Flex>
                )
              })}
            </Flex>
          ) : (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('setup.confirm.noChannel')}
            </Text>
          )}
        </ConfigRow>

        <Divider style={{ margin: '12px 0' }} />

        {/* 运行引擎 */}
        <ConfigRow label={t('setup.confirm.runtimeLabel')}>
          <Tag color="cyan" style={{ margin: 0 }}>
            {t('setup.confirm.bundledEngine', {
              version: bundledOpenclaw?.version || 'unknown',
            })}
          </Tag>
        </ConfigRow>
      </Card>

    </div>
  )
}

export default StepConfirm
