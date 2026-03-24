import { useEffect, useState } from 'react'
import { App, AutoComplete, Button, Checkbox, Input, Tooltip } from 'antd'
import type { DefaultOptionType } from 'antd/es/select'
import { CloseOutlined, EditOutlined, MessageOutlined, SaveOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { AgentConfig, AgentOverviewTabProps } from '../agents-page.types'
import { PROFILE_CONFIG } from '../agents-page.utils'

function OverviewRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '9px 12px',
        borderRadius: 6,
        gap: 12,
      }}
    >
      <span style={{ width: 90, fontSize: 12, color: '#8c8c8c', flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>
  )
}

export function AgentOverviewTab({
  agent,
  wsReady,
  callRpc,
  onSaveAgent,
}: AgentOverviewTabProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [workspace, setWorkspace] = useState<string>('')
  useEffect(() => {
    setWorkspace('')
    if (!wsReady) return
    callRpc('agents.files.list', { agentId: agent.id })
      .then((res) => {
        const r = res as { workspace?: string } | null
        if (r?.workspace) setWorkspace(r.workspace)
      })
      .catch(() => {
        /* 静默，workspace 不显示 */
      })
  }, [agent.id, wsReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const [draftEmoji, setDraftEmoji] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftTheme, setDraftTheme] = useState('')
  const [draftModel, setDraftModel] = useState('')
  const [draftDefault, setDraftDefault] = useState(false)
  const [modelOptions, setModelOptions] = useState<
    { label: React.ReactNode; options: { value: string; label: string }[] }[]
  >([])

  const startEdit = (): void => {
    setDraftEmoji(agent.identity?.emoji || '')
    setDraftName(agent.identity?.name || agent.name || '')
    setDraftTheme(agent.identity?.theme || '')
    setDraftModel(typeof agent.model === 'string' ? agent.model : '')
    setDraftDefault(agent.default || false)
    window.api.model
      .getPresetModels()
      .then((groups) => {
        const opts = groups
          .filter((g) => g.models.length > 0)
          .map((g) => ({
            label: (
              <span
                style={{ fontSize: 11, fontWeight: 700, color: g.color, letterSpacing: '0.04em' }}
              >
                {g.providerName.toUpperCase()}
              </span>
            ),
            options: g.models.map((m) => ({
              value: `${g.providerKey}/${m.id}`,
              label: `${g.providerKey}/${m.id}`,
            })),
          }))
        setModelOptions(opts)
      })
      .catch(() => setModelOptions([]))
    setIsEditing(true)
  }

  const cancelEdit = (): void => setIsEditing(false)

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated: AgentConfig = {
        ...agent,
        name: draftName || agent.id,
        default: draftDefault,
        identity: {
          ...agent.identity,
          name: draftName || agent.id,
          emoji: draftEmoji || '🤖',
          ...(draftTheme ? { theme: draftTheme } : { theme: undefined }),
        },
      }
      if (draftModel) updated.model = draftModel
      else if ('model' in updated) delete updated.model

      await onSaveAgent(updated)
      setIsEditing(false)
      message.success(t('agents.saveSuccess'))
    } catch (err) {
      message.error(
        t('agents.saveFailed', { error: err instanceof Error ? err.message : String(err) })
      )
    } finally {
      setSaving(false)
    }
  }

  const profile = agent.tools?.profile
  const profileCfg = profile ? PROFILE_CONFIG[profile] : null
  const displayName = agent.identity?.name || agent.name || agent.id
  const model = typeof agent.model === 'string' ? agent.model : null
  const theme = agent.identity?.theme
  const skillsAllowlist = Array.isArray(agent.skills) ? (agent.skills as string[]) : null
  const skillsLabel = skillsAllowlist
    ? t('agents.overview.skillsCount', { count: skillsAllowlist.length })
    : t('agents.overview.skillsAll')

  if (isEditing) {
    return (
      <div>
        <div
          style={{
            padding: '14px 16px',
            background: '#fff8f6',
            borderRadius: 10,
            border: '1.5px solid #FF4D2A30',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Input
              value={draftEmoji}
              onChange={(e) => setDraftEmoji(e.target.value)}
              maxLength={4}
              style={{ width: 60, textAlign: 'center', fontSize: 20, flexShrink: 0 }}
              placeholder="🤖"
            />
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={t('agents.form.displayNamePlaceholder')}
              style={{ flex: 1, fontWeight: 600 }}
            />
          </div>
          <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace', marginBottom: 12 }}>
            id: {agent.id}（{t('agents.form.nameHint')}）
          </div>
          <Input
            value={draftTheme}
            onChange={(e) => setDraftTheme(e.target.value)}
            placeholder={t('agents.form.themePlaceholder')}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            {t('agents.form.themeHint')}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#595959', marginBottom: 6, fontWeight: 500 }}>
            {t('agents.form.model')}
          </div>
          {modelOptions.length > 0 ? (
            <AutoComplete
              value={draftModel}
              onChange={setDraftModel}
              options={modelOptions}
              placeholder={t('agents.form.modelPlaceholder')}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
              filterOption={(input, option) =>
                String((option as DefaultOptionType | undefined)?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          ) : (
            <Input
              value={draftModel}
              onChange={(e) => setDraftModel(e.target.value)}
              placeholder={t('agents.form.modelPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          )}
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            {t('agents.form.modelHint')}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <Checkbox checked={draftDefault} onChange={(e) => setDraftDefault(e.target.checked)}>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{t('agents.form.setAsDefault')}</span>
          </Checkbox>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            borderTop: '1px solid #f0f0f0',
            paddingTop: 14,
          }}
        >
          <Button icon={<CloseOutlined />} onClick={cancelEdit} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 16px',
          background: '#fafaf8',
          borderRadius: 10,
          border: '1px solid #f0eeec',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            background: '#FF4D2A12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            flexShrink: 0,
          }}
        >
          {agent.identity?.emoji || '🤖'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: '#aaa', fontFamily: 'monospace' }}>{agent.id}</div>
          {theme && (
            <div style={{ fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 3 }}>
              {theme.length > 64 ? theme.slice(0, 64) + '…' : theme}
            </div>
          )}
        </div>
        <Button icon={<EditOutlined />} size="small" onClick={startEdit}>
          {t('agents.edit')}
        </Button>
        <Button
          type="primary"
          icon={<MessageOutlined />}
          size="small"
          onClick={() =>
            navigate(`/chat?agent_id=${encodeURIComponent(agent.id)}&from=agent_detail`)
          }
          style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
        >
          {t('agents.actions.openChat')}
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <OverviewRow label={t('agents.overview.modelLabel')}>
          {model ? (
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{model}</span>
          ) : (
            <span style={{ color: '#aaa', fontSize: 12 }}>{t('agents.overview.modelDefault')}</span>
          )}
        </OverviewRow>

        <OverviewRow label={t('agents.overview.toolsLabel')}>
          {profile && profileCfg ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: profileCfg.color,
                background: profileCfg.bg,
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {profile}
            </span>
          ) : (
            <span style={{ color: '#aaa', fontSize: 12 }}>{t('agents.overview.toolsDefault')}</span>
          )}
        </OverviewRow>

        <OverviewRow label={t('agents.overview.themeLabel')}>
          {theme ? (
            <span style={{ fontSize: 12, color: '#595959', fontStyle: 'italic' }}>{theme}</span>
          ) : (
            <span style={{ color: '#aaa', fontSize: 12 }}>{t('agents.overview.themeEmpty')}</span>
          )}
        </OverviewRow>

        <OverviewRow label={t('agents.overview.workspaceLabel')}>
          {workspace ? (
            <Tooltip title={workspace}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: '#595959',
                  wordBreak: 'break-all',
                  cursor: 'default',
                }}
              >
                {workspace}
              </span>
            </Tooltip>
          ) : (
            <span style={{ color: '#aaa', fontSize: 12 }}>
              {wsReady ? t('agents.overview.workspaceLoading') : t('agents.overview.workspaceNoWs')}
            </span>
          )}
        </OverviewRow>

        <OverviewRow label={t('agents.overview.skillsLabel')}>
          {skillsAllowlist !== null ? (
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#FF4D2A' }}>
              {skillsLabel}
            </span>
          ) : (
            <span style={{ color: '#52c41a', fontSize: 12 }}>{skillsLabel}</span>
          )}
        </OverviewRow>
      </div>
    </div>
  )
}
