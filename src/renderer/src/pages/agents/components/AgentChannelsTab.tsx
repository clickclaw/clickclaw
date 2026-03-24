import { useEffect, useMemo, useState } from 'react'
import { App, Button, Empty, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { AgentChannelsTabProps } from '../agents-page.types'

interface ChannelRow {
  key: string
  channel: string
  channelLabel: string
  accountId: string
  enabled: boolean
  boundAgentId?: string
}

interface ChannelConfig {
  enabled?: boolean
  accounts?: Record<string, Record<string, unknown>>
  defaultAccount?: string
}

interface BindingConfig {
  agentId?: string
  match?: {
    channel?: string
    accountId?: string
  }
}

interface ChannelPreset {
  key: string
  name?: string
}

function matchBinding(
  bindings: BindingConfig[],
  channel: string,
  accountId: string
): BindingConfig | undefined {
  const exact = bindings.find(
    (item) => item.match?.channel === channel && (item.match?.accountId || '') === accountId
  )
  if (exact) return exact
  return bindings.find(
    (item) =>
      item.match?.channel === channel && (!item.match?.accountId || item.match?.accountId === '')
  )
}

export function AgentChannelsTab({ agentId }: AgentChannelsTabProps): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ChannelRow[]>([])
  const [bindingLoadingKey, setBindingLoadingKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const [channelMapRaw, bindingsRaw, presetsRaw] = await Promise.all([
          window.api.channel.list(),
          window.api.binding.list(),
          window.api.channel.getPresets().catch(() => [] as ChannelPreset[]),
        ])
        if (cancelled) return

        const channelMap = (channelMapRaw || {}) as Record<string, ChannelConfig>
        const bindings = (bindingsRaw || []) as BindingConfig[]
        const presets = Array.isArray(presetsRaw) ? (presetsRaw as ChannelPreset[]) : []
        const presetLabelMap = new Map<string, string>(
          presets.map((preset) => [preset.key, preset.name || preset.key])
        )

        const nextRows: ChannelRow[] = []
        for (const [channelKey, config] of Object.entries(channelMap)) {
          const accounts = Object.keys(config.accounts || {})
          const accountIds =
            accounts.length > 0
              ? accounts
              : [typeof config.defaultAccount === 'string' ? config.defaultAccount : '-']
          for (const accountId of accountIds) {
            const binding = matchBinding(bindings, channelKey, accountId === '-' ? '' : accountId)
            nextRows.push({
              key: `${channelKey}:${accountId}`,
              channel: channelKey,
              channelLabel: presetLabelMap.get(channelKey) || channelKey,
              accountId,
              enabled: config.enabled !== false,
              boundAgentId: binding?.agentId,
            })
          }
        }
        setRows(nextRows)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const boundCount = useMemo(
    () => rows.filter((row) => row.boundAgentId && row.boundAgentId === agentId).length,
    [agentId, rows]
  )
  const enabledCount = useMemo(() => rows.filter((row) => row.enabled).length, [rows])

  const columns: ColumnsType<ChannelRow> = [
    {
      title: t('agents.channels.table.channel'),
      dataIndex: 'channelLabel',
      key: 'channelLabel',
      render: (_value, row) => (
        <Space size={8}>
          <span>{row.channelLabel}</span>
          <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {row.channel}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('agents.channels.table.account'),
      dataIndex: 'accountId',
      key: 'accountId',
      render: (value) =>
        value === '-' ? (
          <Typography.Text type="secondary">{t('agents.channels.noAccount')}</Typography.Text>
        ) : (
          <Typography.Text style={{ fontFamily: 'monospace' }}>{value}</Typography.Text>
        ),
    },
    {
      title: t('agents.channels.table.status'),
      dataIndex: 'enabled',
      key: 'enabled',
      width: 110,
      render: (enabled) =>
        enabled ? (
          <Tag color="green">{t('agents.channels.enabled')}</Tag>
        ) : (
          <Tag>{t('agents.channels.disabled')}</Tag>
        ),
    },
    {
      title: t('agents.channels.table.binding'),
      dataIndex: 'boundAgentId',
      key: 'boundAgentId',
      render: (value) => {
        if (!value)
          return <Typography.Text type="secondary">{t('agents.channels.unbound')}</Typography.Text>
        if (value === agentId) return <Tag color="orange">{t('agents.channels.boundCurrent')}</Tag>
        return <Tag>{value}</Tag>
      },
    },
    {
      title: t('agents.channels.table.action'),
      key: 'action',
      width: 140,
      render: (_value, row) => {
        const accountId = row.accountId === '-' ? '' : row.accountId
        const rowKey = `${row.channel}:${accountId}`
        const loadingThisRow = bindingLoadingKey === rowKey
        const isCurrentBound = row.boundAgentId === agentId
        if (isCurrentBound) {
          return (
            <Button
              size="small"
              loading={loadingThisRow}
              onClick={async () => {
                setBindingLoadingKey(rowKey)
                try {
                  await window.api.binding.delete(row.channel, accountId)
                  setRows((prev) =>
                    prev.map((item) =>
                      item.key === row.key ? { ...item, boundAgentId: undefined } : item
                    )
                  )
                  message.success(t('agents.channels.unbindSuccess'))
                } catch (err) {
                  message.error(
                    t('agents.channels.bindFailed', {
                      error: err instanceof Error ? err.message : String(err),
                    })
                  )
                } finally {
                  setBindingLoadingKey(null)
                }
              }}
            >
              {t('agents.channels.quickUnbind')}
            </Button>
          )
        }
        return (
          <Button
            size="small"
            type="primary"
            loading={loadingThisRow}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
            onClick={async () => {
              setBindingLoadingKey(rowKey)
              try {
                await window.api.binding.save(agentId, row.channel, accountId)
                setRows((prev) =>
                  prev.map((item) =>
                    item.key === row.key ? { ...item, boundAgentId: agentId } : item
                  )
                )
                message.success(t('agents.channels.bindSuccess'))
              } catch (err) {
                message.error(
                  t('agents.channels.bindFailed', {
                    error: err instanceof Error ? err.message : String(err),
                  })
                )
              } finally {
                setBindingLoadingKey(null)
              }
            }}
          >
            {t('agents.channels.quickBind')}
          </Button>
        )
      },
    },
  ]

  if (error) {
    return (
      <Empty
        description={t('agents.channels.loadFailed', { error })}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    )
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={16} align="center">
        <Typography.Text type="secondary">
          {t('agents.channels.summary.total', { count: rows.length })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('agents.channels.summary.enabled', { count: enabledCount })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('agents.channels.summary.bound', { count: boundCount })}
        </Typography.Text>
        <Button size="small" onClick={() => navigate('/channels')}>
          {t('agents.channels.openManage')}
        </Button>
      </Space>

      <Table<ChannelRow>
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: t('agents.channels.empty') }}
      />
    </Space>
  )
}
