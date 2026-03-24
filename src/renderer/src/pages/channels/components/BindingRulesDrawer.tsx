import { useMemo, useState } from 'react'
import {
  AutoComplete,
  Alert,
  App,
  Button,
  Collapse,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import type { BindingRouteRule, BindingRulesDrawerProps } from '../channels-page.types'

interface RuleFormValues {
  agentId: string
  channel: string
  accountId?: string
  peerKind?: string
  peerId?: string
  guildId?: string
  teamId?: string
  rolesText?: string
  priority?: number
}

function collectAccountIds(config?: {
  accounts?: Record<string, unknown>
  defaultAccount?: string
}): string[] {
  if (!config) return []
  const merged = new Set<string>(Object.keys(config.accounts || {}))
  if (typeof config.defaultAccount === 'string' && config.defaultAccount.trim()) {
    merged.add(config.defaultAccount.trim())
  }
  return Array.from(merged)
}

function parseRoles(text?: string): string[] | undefined {
  if (!text) return undefined
  const roles = text
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
  if (roles.length === 0) return undefined
  return Array.from(new Set(roles))
}

function formatMatchSummary(rule: BindingRouteRule): string {
  const match = rule.match || {}
  const parts: string[] = []
  if (match.peer?.kind && match.peer?.id) parts.push(`peer:${match.peer.kind}:${match.peer.id}`)
  if (match.guildId) parts.push(`guild:${match.guildId}`)
  if (match.teamId) parts.push(`team:${match.teamId}`)
  if (Array.isArray(match.roles) && match.roles.length > 0)
    parts.push(`roles:${match.roles.join(',')}`)
  return parts.length > 0 ? parts.join(' | ') : '-'
}

export function BindingRulesDrawer({
  open,
  rules,
  loading,
  agents,
  channels,
  presets,
  onClose,
  onRefresh,
}: BindingRulesDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [editingRule, setEditingRule] = useState<BindingRouteRule | null>(null)
  const [editingOpen, setEditingOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form] = Form.useForm<RuleFormValues>()
  const selectedChannel = Form.useWatch('channel', form) as string | undefined

  const presetNameMap = useMemo(
    () => new Map(presets.map((item) => [item.key, item.name])),
    [presets]
  )

  const channelOptions = useMemo(() => {
    const configured = Object.keys(channels)
    if (configured.length > 0) {
      return configured.map((key) => ({
        value: key,
        label: `${presetNameMap.get(key) || key} (${key})`,
      }))
    }
    return presets.map((item) => ({ value: item.key, label: `${item.name} (${item.key})` }))
  }, [channels, presetNameMap, presets])

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        value: agent.id,
        label: `${agent.identity?.name || agent.name || agent.id} (${agent.id})`,
      })),
    [agents]
  )

  const accountOptions = useMemo(() => {
    if (!selectedChannel) return []
    const config = channels[selectedChannel]
    if (!config) return []
    return collectAccountIds(config).map((id) => ({
      value: id,
      label:
        id === config.defaultAccount
          ? `${id} (${t('channels.bindingRules.form.defaultAccountTag')})`
          : id,
    }))
  }, [channels, selectedChannel, t])

  const openCreate = (): void => {
    setEditingRule(null)
    const defaultChannel = channelOptions[0]?.value || ''
    const defaultChannelConfig = defaultChannel ? channels[defaultChannel] : undefined
    form.setFieldsValue({
      agentId: agents[0]?.id || '',
      channel: defaultChannel,
      accountId: defaultChannelConfig?.defaultAccount || undefined,
      priority: 0,
    })
    setEditingOpen(true)
  }

  const openEdit = (rule: BindingRouteRule): void => {
    setEditingRule(rule)
    form.setFieldsValue({
      agentId: rule.agentId,
      channel: rule.match.channel,
      accountId: rule.match.accountId,
      peerKind: rule.match.peer?.kind,
      peerId: rule.match.peer?.id,
      guildId: rule.match.guildId,
      teamId: rule.match.teamId,
      rolesText: Array.isArray(rule.match.roles) ? rule.match.roles.join(', ') : '',
      priority: Number.isFinite(rule.priority) ? rule.priority : 0,
    })
    setEditingOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const roles = parseRoles(values.rolesText)
      const rulePayload: Omit<BindingRouteRule, 'id'> & { id?: string } = {
        type: 'route',
        agentId: values.agentId.trim(),
        priority: Number(values.priority || 0),
        match: {
          channel: values.channel.trim(),
          ...(values.accountId?.trim() ? { accountId: values.accountId.trim() } : {}),
          ...(values.guildId?.trim() ? { guildId: values.guildId.trim() } : {}),
          ...(values.teamId?.trim() ? { teamId: values.teamId.trim() } : {}),
          ...(roles ? { roles } : {}),
          ...(values.peerKind?.trim() && values.peerId?.trim()
            ? { peer: { kind: values.peerKind.trim(), id: values.peerId.trim() } }
            : {}),
        },
      }
      if (editingRule?.id) rulePayload.id = editingRule.id
      await window.api.binding.saveRule(rulePayload)
      message.success(
        editingRule ? t('channels.bindingRules.updated') : t('channels.bindingRules.created')
      )
      setEditingOpen(false)
      setEditingRule(null)
      await onRefresh()
    } catch (err) {
      if (err instanceof Error && err.message.includes('validate')) return
      message.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleChannelChange = (nextChannel: string): void => {
    const config = channels[nextChannel]
    const currentAccountId = form.getFieldValue('accountId') as string | undefined
    const accountIds = collectAccountIds(config)
    if (!currentAccountId?.trim()) {
      form.setFieldValue('accountId', config?.defaultAccount || undefined)
      return
    }
    if (accountIds.includes(currentAccountId.trim())) return
    form.setFieldValue('accountId', config?.defaultAccount || undefined)
  }

  const handleDelete = async (id: string): Promise<void> => {
    setDeletingId(id)
    try {
      await window.api.binding.deleteRule(id)
      message.success(t('channels.bindingRules.deleted'))
      await onRefresh()
    } catch (err) {
      message.error(String(err))
    } finally {
      setDeletingId(null)
    }
  }

  const handleMove = async (id: string, direction: 'up' | 'down'): Promise<void> => {
    const idx = rules.findIndex((item) => item.id === id)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= rules.length) return
    const ids = rules.map((item) => item.id)
    ;[ids[idx], ids[targetIdx]] = [ids[targetIdx], ids[idx]]
    setMovingId(id)
    try {
      await window.api.binding.reorder(ids)
      await onRefresh()
    } catch (err) {
      message.error(String(err))
    } finally {
      setMovingId(null)
    }
  }

  const columns: ColumnsType<BindingRouteRule> = [
    {
      title: t('channels.bindingRules.table.order'),
      key: 'order',
      width: 90,
      render: (_value, _record, index) => (
        <Typography.Text type="secondary">#{index + 1}</Typography.Text>
      ),
    },
    {
      title: t('channels.bindingRules.table.agent'),
      dataIndex: 'agentId',
      key: 'agentId',
      width: 180,
      render: (agentId) => <Tag color="orange">{agentId}</Tag>,
    },
    {
      title: t('channels.bindingRules.table.channel'),
      key: 'channel',
      width: 220,
      render: (_value, rule) => {
        const channel = rule.match.channel
        return (
          <Space size={6}>
            <span>{presetNameMap.get(channel) || channel}</span>
            <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {channel}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: t('channels.bindingRules.table.accountId'),
      key: 'accountId',
      width: 220,
      render: (_value, rule) => {
        const accountId = rule.match.accountId?.trim()
        if (!accountId) return <Typography.Text type="secondary">-</Typography.Text>
        return (
          <Tooltip title={accountId}>
            <Typography.Text
              style={{
                display: 'inline-block',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              {accountId}
            </Typography.Text>
          </Tooltip>
        )
      },
    },
    {
      title: t('channels.bindingRules.table.priority'),
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => priority ?? 0,
    },
    {
      title: t('channels.bindingRules.table.match'),
      key: 'match',
      width: 320,
      render: (_value, rule) => {
        const match = rule.match || {}
        const summaryParts: string[] = []
        if (match.peer?.kind && match.peer?.id) {
          const peerKindKey =
            `channels.bindingRules.form.peerKindOptions.${match.peer.kind}` as const
          summaryParts.push(
            t('channels.bindingRules.table.matchSummary.peer', {
              kind: t(peerKindKey),
              id: match.peer.id,
            })
          )
        }
        if (match.guildId) {
          summaryParts.push(
            t('channels.bindingRules.table.matchSummary.guild', { id: match.guildId })
          )
        }
        if (match.teamId) {
          summaryParts.push(
            t('channels.bindingRules.table.matchSummary.team', { id: match.teamId })
          )
        }
        if (Array.isArray(match.roles) && match.roles.length > 0) {
          summaryParts.push(
            t('channels.bindingRules.table.matchSummary.roles', {
              ids: match.roles.join(', '),
            })
          )
        }
        const summary =
          summaryParts.length > 0
            ? summaryParts.join(t('channels.bindingRules.table.matchSummary.separator'))
            : t('channels.bindingRules.table.matchSummary.default')
        const rawSummary = formatMatchSummary(rule)
        return (
          <Tooltip title={`${summary}\n${rawSummary}`}>
            <Typography.Text
              style={{
                display: 'inline-block',
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                fontSize: 12,
              }}
            >
              {summary}
            </Typography.Text>
          </Tooltip>
        )
      },
    },
    {
      title: t('channels.bindingRules.table.actions'),
      key: 'actions',
      width: 180,
      render: (_value, rule, index) => (
        <Space size={4}>
          <Tooltip title={t('channels.bindingRules.table.actionsMoveUp')}>
            <Button
              size="small"
              icon={<UpOutlined />}
              aria-label={t('channels.bindingRules.table.actionsMoveUp')}
              disabled={index === 0}
              loading={movingId === rule.id}
              onClick={() => void handleMove(rule.id, 'up')}
            />
          </Tooltip>
          <Tooltip title={t('channels.bindingRules.table.actionsMoveDown')}>
            <Button
              size="small"
              icon={<DownOutlined />}
              aria-label={t('channels.bindingRules.table.actionsMoveDown')}
              disabled={index === rules.length - 1}
              loading={movingId === rule.id}
              onClick={() => void handleMove(rule.id, 'down')}
            />
          </Tooltip>
          <Tooltip title={t('channels.bindingRules.table.actionsEdit')}>
            <Button
              size="small"
              icon={<EditOutlined />}
              aria-label={t('channels.bindingRules.table.actionsEdit')}
              onClick={() => openEdit(rule)}
            />
          </Tooltip>
          <Popconfirm
            title={t('channels.bindingRules.deleteConfirmTitle')}
            onConfirm={() => void handleDelete(rule.id)}
            okButtonProps={{ danger: true, loading: deletingId === rule.id }}
          >
            <Tooltip title={t('channels.bindingRules.table.actionsDelete')}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t('channels.bindingRules.table.actionsDelete')}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Drawer
        open={open}
        width={980}
        onClose={onClose}
        title={t('channels.bindingRules.title')}
        rootStyle={{ top: TITLE_BAR_HEIGHT, height: `calc(100vh - ${TITLE_BAR_HEIGHT}px)` }}
        styles={{
          body: {
            paddingTop: 12,
            height: `calc(100vh - ${TITLE_BAR_HEIGHT + 56}px)`,
            overflow: 'auto',
          },
        }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void onRefresh()} loading={loading}>
              {t('channels.bindingRules.refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreate}
              style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
            >
              {t('channels.bindingRules.add')}
            </Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('channels.bindingRules.intro.title')}
          description={t('channels.bindingRules.intro.description')}
        />
        <Table<BindingRouteRule>
          rowKey="id"
          size="small"
          tableLayout="fixed"
          loading={loading}
          columns={columns}
          dataSource={rules}
          pagination={false}
          scroll={{ x: 1310 }}
          locale={{ emptyText: t('channels.bindingRules.empty') }}
        />
      </Drawer>

      <Modal
        open={editingOpen}
        onCancel={() => {
          if (saving) return
          setEditingOpen(false)
        }}
        onOk={() => void handleSave()}
        confirmLoading={saving}
        title={
          editingRule
            ? t('channels.bindingRules.editTitle')
            : t('channels.bindingRules.createTitle')
        }
        style={{ top: TITLE_BAR_HEIGHT + 24 }}
        styles={{
          mask: {
            top: TITLE_BAR_HEIGHT,
            height: `calc(100vh - ${TITLE_BAR_HEIGHT}px)`,
          },
          body: {
            maxHeight: 'calc(100vh - 260px)',
            overflowY: 'auto',
            paddingRight: 6,
          },
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="agentId"
            label={t('channels.bindingRules.form.agent')}
            rules={[{ required: true, message: t('channels.bindingRules.form.agentRequired') }]}
            extra={t('channels.bindingRules.form.agentHint')}
          >
            <Select options={agentOptions} showSearch />
          </Form.Item>
          <Form.Item
            name="channel"
            label={t('channels.bindingRules.form.channel')}
            rules={[{ required: true, message: t('channels.bindingRules.form.channelRequired') }]}
            extra={t('channels.bindingRules.form.channelHint')}
          >
            <Select options={channelOptions} showSearch onChange={handleChannelChange} />
          </Form.Item>
          <Form.Item
            name="accountId"
            label={t('channels.bindingRules.form.accountId')}
            extra={t('channels.bindingRules.form.accountIdHint')}
          >
            <AutoComplete
              options={accountOptions}
              filterOption={(inputValue, option) =>
                String(option?.value || '')
                  .toLowerCase()
                  .includes(inputValue.toLowerCase())
              }
            >
              <Input placeholder={t('channels.bindingRules.form.accountIdPlaceholder')} />
            </AutoComplete>
          </Form.Item>
          <Form.Item
            name="priority"
            label={t('channels.bindingRules.form.priority')}
            extra={t('channels.bindingRules.form.priorityHint')}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Collapse
            ghost
            items={[
              {
                key: 'advanced',
                label: t('channels.bindingRules.form.advancedTitle'),
                children: (
                  <>
                    <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                      {t('channels.bindingRules.form.peerHint')}
                    </Typography.Text>
                    <Space style={{ width: '100%' }} size={8}>
                      <Form.Item
                        name="peerKind"
                        label={t('channels.bindingRules.form.peerKind')}
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <Select
                          allowClear
                          options={[
                            {
                              value: 'direct',
                              label: t('channels.bindingRules.form.peerKindOptions.direct'),
                            },
                            {
                              value: 'group',
                              label: t('channels.bindingRules.form.peerKindOptions.group'),
                            },
                            {
                              value: 'channel',
                              label: t('channels.bindingRules.form.peerKindOptions.channel'),
                            },
                            {
                              value: 'dm',
                              label: t('channels.bindingRules.form.peerKindOptions.dm'),
                            },
                          ]}
                        />
                      </Form.Item>
                      <Form.Item
                        name="peerId"
                        label={t('channels.bindingRules.form.peerId')}
                        style={{ flex: 2, minWidth: 0 }}
                      >
                        <Input placeholder={t('channels.bindingRules.form.peerIdPlaceholder')} />
                      </Form.Item>
                    </Space>
                    <Collapse
                      ghost
                      items={[
                        {
                          key: 'more-advanced',
                          label: t('channels.bindingRules.form.moreAdvancedTitle'),
                          children: (
                            <>
                              <Space style={{ width: '100%' }} size={8}>
                                <Form.Item
                                  name="guildId"
                                  label={t('channels.bindingRules.form.guildId')}
                                  style={{ flex: 1, minWidth: 0 }}
                                >
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  name="teamId"
                                  label={t('channels.bindingRules.form.teamId')}
                                  style={{ flex: 1, minWidth: 0 }}
                                >
                                  <Input />
                                </Form.Item>
                              </Space>
                              <Form.Item
                                name="rolesText"
                                label={t('channels.bindingRules.form.roles')}
                              >
                                <Input.TextArea
                                  rows={3}
                                  placeholder={t('channels.bindingRules.form.rolesPlaceholder')}
                                />
                              </Form.Item>
                            </>
                          ),
                        },
                      ]}
                    />
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  )
}
