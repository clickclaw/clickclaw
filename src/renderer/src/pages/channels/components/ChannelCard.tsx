import { useState } from 'react'
import { Button, Popconfirm, Select, Switch, Tag, Tooltip } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { ChannelCardProps } from '../channels-page.types'
import { resolveAccounts } from '../channels-page.utils'
import { ChannelMonogram } from './ChannelMonogram'

export function ChannelCard({
  channelKey,
  config,
  preset,
  isCustom,
  agents,
  bindings,
  onEdit,
  onDelete,
  onToggle,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onSetDefaultAccount,
  onSetBinding,
}: ChannelCardProps): React.ReactElement {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const enabled = config.enabled !== false

  const { accounts, defaultAccountId } = resolveAccounts(config, preset)
  const accountIds = Object.keys(accounts)
  const hasAccounts = accountIds.length > 0
  const credsFilled = hasAccounts

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '14px 18px',
        background: hovered ? '#fafafa' : '#fff',
        borderRadius: 10,
        border: `1px solid ${hovered ? '#e8e8e8' : '#f0f0f0'}`,
        borderLeft: `3px solid ${enabled ? preset.color : '#d9d9d9'}`,
        marginBottom: 6,
        transition: 'background 0.15s, border-color 0.15s',
        cursor: 'default',
        opacity: enabled ? 1 : 0.7,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ChannelMonogram
          channelKey={preset.key}
          initials={preset.initials}
          color={enabled ? preset.color : '#aaa'}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{preset.name}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'monospace',
                color: '#aaa',
                background: '#f5f5f5',
                padding: '1px 5px',
                borderRadius: 3,
              }}
            >
              {channelKey}
            </span>
            {isCustom && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#8c8c8c',
                  background: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                  padding: '1px 5px',
                  borderRadius: 3,
                }}
              >
                {t('channels.custom')}
              </span>
            )}
            {!credsFilled && (
              <Tag color="warning" style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px' }}>
                未配置凭证
              </Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#aaa' }}>
            {config.dmPolicy && (
              <span>{t(`channels.dmPolicy_${config.dmPolicy}` as Parameters<typeof t>[0])}</span>
            )}
            {preset.supportsGroup && config.groupPolicy && (
              <span style={{ marginLeft: 8 }}>
                · {t(`channels.groupPolicy_${config.groupPolicy}` as Parameters<typeof t>[0])}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <Switch
            size="small"
            checked={enabled}
            onChange={onToggle}
            style={enabled ? { background: preset.color } : {}}
          />
          <div
            style={{
              display: 'flex',
              gap: 2,
              opacity: hovered ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >
            <Tooltip title={t('channels.edit')}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={onEdit}
                style={{ color: '#595959' }}
              />
            </Tooltip>
            <Popconfirm
              title={t('channels.deleteConfirmTitle')}
              description={t('channels.deleteConfirmContent', { name: preset.name })}
              onConfirm={onDelete}
              okType="danger"
              placement="topRight"
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                style={{ color: '#ff4d4f' }}
              />
            </Popconfirm>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, paddingLeft: 50 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#aaa',
            }}
          >
            {t('channels.accounts.title')}
          </span>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={onAddAccount}
            style={{ fontSize: 12, padding: 0, height: 'auto', color: '#FF4D2A' }}
          >
            {t('channels.accounts.add')}
          </Button>
        </div>

        {!hasAccounts ? (
          <div
            style={{
              fontSize: 12,
              color: '#bbb',
              padding: '8px 12px',
              background: '#fafaf8',
              borderRadius: 6,
              border: '1px dashed #e8e8e8',
              textAlign: 'center',
            }}
          >
            {t('channels.accounts.noAccountsHint')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {accountIds.map((accountId) => {
              const isDefault = accountId === defaultAccountId
              const currentBinding = bindings.find(
                (b) => b.match?.channel === channelKey && b.match?.accountId === accountId
              )
              const currentAgentId = currentBinding?.agentId || ''

              return (
                <div
                  key={accountId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    background: isDefault ? `${preset.color}08` : '#fafaf8',
                    borderRadius: 6,
                    border: `1px solid ${isDefault ? `${preset.color}25` : '#f0f0f0'}`,
                    fontSize: 13,
                  }}
                >
                  <UserOutlined style={{ color: '#aaa', fontSize: 12 }} />
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 500,
                      fontSize: 12,
                      color: '#333',
                      flex: 1,
                    }}
                  >
                    {accountId}
                  </span>
                  {isDefault && (
                    <Tag
                      color="blue"
                      style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', margin: 0 }}
                    >
                      {t('channels.accounts.defaultBadge')}
                    </Tag>
                  )}
                  {agents.length > 0 && (
                    <Tooltip title={t('channels.accounts.routeToAgent')}>
                      <Select
                        size="small"
                        style={{ width: 120, fontSize: 12 }}
                        value={currentAgentId || ''}
                        onChange={(val) => onSetBinding(accountId, val || null)}
                        options={[
                          { value: '', label: t('channels.accounts.defaultAgent') },
                          ...agents.map((a) => ({
                            value: a.id,
                            label: a.identity?.name || a.name || a.id,
                          })),
                        ]}
                      />
                    </Tooltip>
                  )}
                  <div style={{ display: 'flex', gap: 0 }}>
                    {!isDefault && (
                      <Tooltip title={t('channels.accounts.setDefault')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<StarOutlined style={{ fontSize: 12 }} />}
                          onClick={() => onSetDefaultAccount(accountId)}
                          style={{ color: '#faad14', width: 24, height: 24 }}
                        />
                      </Tooltip>
                    )}
                    {isDefault && (
                      <StarFilled style={{ fontSize: 12, color: '#faad14', margin: '0 6px' }} />
                    )}
                    <Tooltip title={t('channels.accounts.edit')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined style={{ fontSize: 12 }} />}
                        onClick={() => onEditAccount(accountId)}
                        style={{ color: '#595959', width: 24, height: 24 }}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={t('channels.accounts.deleteConfirmTitle')}
                      description={t('channels.accounts.deleteConfirmContent', { id: accountId })}
                      onConfirm={() => onDeleteAccount(accountId)}
                      okType="danger"
                      placement="topRight"
                    >
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                        style={{ color: '#ff4d4f', width: 24, height: 24 }}
                      />
                    </Popconfirm>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
