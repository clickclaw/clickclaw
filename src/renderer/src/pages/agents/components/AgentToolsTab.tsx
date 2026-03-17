import { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Spin, Switch, Tooltip, Typography } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type {
  AgentConfig,
  AgentToolsTabProps,
  ToolCatalogEntry,
  ToolCatalogGroup,
  ToolEffectiveState,
  ToolsCatalogResult,
} from '../agents-page.types'
import {
  GROUP_ICONS,
  PROFILE_CONFIG,
  PROFILE_ORDER,
  resolveToolState,
  toggleGroupState,
  toggleToolState,
  TOOLS_PROFILE_OPTIONS,
} from '../agents-page.utils'

function ToolRow({
  tool,
  groupId,
  profile,
  allow,
  deny,
  onToggle,
}: {
  tool: ToolCatalogEntry
  groupId: string
  profile: string
  allow: string[]
  deny: string[]
  onToggle: (toolId: string) => void
}): React.ReactElement {
  const { t } = useTranslation()

  const state: ToolEffectiveState = resolveToolState(
    tool.id,
    groupId,
    tool.defaultProfiles,
    profile,
    allow,
    deny
  )
  const isOn = state === 'profile-on' || state === 'custom-allow'

  const stateIcon =
    state === 'profile-on' ? (
      <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
    ) : state === 'custom-allow' ? (
      <PlusCircleOutlined style={{ color: '#FF4D2A', fontSize: 14 }} />
    ) : state === 'custom-deny' ? (
      <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 14 }} />
    ) : (
      <MinusCircleOutlined style={{ color: '#d9d9d9', fontSize: 14 }} />
    )

  const stateLabel =
    state === 'profile-on'
      ? t('agents.tools.stateProfileOn')
      : state === 'custom-allow'
        ? t('agents.tools.stateCustomAllow')
        : state === 'custom-deny'
          ? t('agents.tools.stateDeny')
          : t('agents.tools.stateProfileOff')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 6,
        background: isOn ? '#fafafa' : 'transparent',
        opacity: state === 'custom-deny' ? 0.6 : 1,
        transition: 'all 0.12s',
      }}
    >
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        <Tooltip title={stateLabel}>{stateIcon}</Tooltip>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'monospace',
              color: isOn ? '#1a1a1a' : '#8c8c8c',
            }}
          >
            {tool.id}
          </span>
          <span style={{ fontSize: 12, color: '#595959' }}>{tool.label}</span>
          {tool.source === 'plugin' && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#722ed1',
                background: '#f9f0ff',
                padding: '1px 4px',
                borderRadius: 3,
              }}
            >
              plugin
            </span>
          )}
        </div>
        {tool.description && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 1, lineHeight: 1.4 }}>
            {tool.description}
          </div>
        )}
      </div>

      <Switch
        size="small"
        checked={isOn}
        onChange={() => onToggle(tool.id)}
        style={isOn ? { background: state === 'custom-allow' ? '#FF4D2A' : undefined } : {}}
      />
    </div>
  )
}

function ToolGroupSection({
  group,
  profile,
  allow,
  deny,
  onToggleTool,
  onToggleGroup,
}: {
  group: ToolCatalogGroup
  profile: string
  allow: string[]
  deny: string[]
  onToggleTool: (toolId: string, groupId: string) => void
  onToggleGroup: (groupId: string, tools: ToolCatalogEntry[]) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  const allOn = group.tools.every((tool) => {
    const s = resolveToolState(tool.id, group.id, tool.defaultProfiles, profile, allow, deny)
    return s === 'profile-on' || s === 'custom-allow'
  })
  const anyOn = group.tools.some((tool) => {
    const s = resolveToolState(tool.id, group.id, tool.defaultProfiles, profile, allow, deny)
    return s === 'profile-on' || s === 'custom-allow'
  })
  const groupState = allOn ? 'on' : anyOn ? 'mixed' : 'off'

  const groupStateLabel =
    groupState === 'on'
      ? t('agents.tools.groupOn')
      : groupState === 'mixed'
        ? t('agents.tools.groupMixed')
        : t('agents.tools.groupOff')

  const icon = GROUP_ICONS[group.id] ?? '🔧'

  return (
    <div style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 8,
          background: '#fafaf8',
          border: '1px solid #f0eeec',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
          {group.label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: groupState === 'on' ? '#52c41a' : groupState === 'mixed' ? '#FF4D2A' : '#aaa',
            marginRight: 8,
          }}
        >
          {groupStateLabel} · {t('agents.tools.toolCount', { count: group.tools.length })}
        </span>
        <div
          onClick={(e) => {
            e.stopPropagation()
            onToggleGroup(group.id, group.tools)
          }}
        >
          <Switch
            size="small"
            checked={groupState !== 'off'}
            style={
              groupState === 'on' ? {} : groupState === 'mixed' ? { background: '#faad14' } : {}
            }
          />
        </div>
        <span
          style={{
            fontSize: 11,
            color: '#aaa',
            marginLeft: 4,
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            display: 'inline-block',
          }}
        >
          ▾
        </span>
      </div>

      {!collapsed && (
        <div
          style={{
            marginTop: 2,
            marginLeft: 8,
            paddingLeft: 8,
            borderLeft: '2px solid #f0f0f0',
          }}
        >
          {group.tools.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              groupId={group.id}
              profile={profile}
              allow={allow}
              deny={deny}
              onToggle={(toolId) => onToggleTool(toolId, group.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function AgentToolsTab({
  agent,
  wsReady,
  callRpc,
  onSaveAgent,
}: AgentToolsTabProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [draftProfile, setDraftProfile] = useState<string>(agent.tools?.profile || 'coding')
  const [draftAllow, setDraftAllow] = useState<string[]>(agent.tools?.allow || [])
  const [draftDeny, setDraftDeny] = useState<string[]>(agent.tools?.deny || [])
  const [draftElevated, setDraftElevated] = useState<boolean>(
    agent.tools?.elevated?.enabled || false
  )

  const [catalog, setCatalog] = useState<ToolsCatalogResult | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraftProfile(agent.tools?.profile || 'coding')
    setDraftAllow(agent.tools?.allow || [])
    setDraftDeny(agent.tools?.deny || [])
    setDraftElevated(agent.tools?.elevated?.enabled || false)
    setCatalog(null)
    setCatalogError(null)
  }, [agent.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCatalog = useCallback(async (): Promise<void> => {
    if (!wsReady) return
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const res = (await callRpc('tools.catalog', {
        agentId: agent.id,
        includePlugins: true,
      })) as ToolsCatalogResult | null
      if (res) setCatalog(res)
    } catch (err) {
      setCatalogError(String(err))
    } finally {
      setCatalogLoading(false)
    }
  }, [agent.id, wsReady, callRpc])

  useEffect(() => {
    if (wsReady && !catalog && !catalogLoading) loadCatalog()
  }, [wsReady, catalog, catalogLoading, loadCatalog])

  const originalProfile = agent.tools?.profile || 'coding'
  const originalAllow = agent.tools?.allow || []
  const originalDeny = agent.tools?.deny || []
  const originalElevated = agent.tools?.elevated?.enabled || false

  const isDirty =
    draftProfile !== originalProfile ||
    JSON.stringify([...draftAllow].sort()) !== JSON.stringify([...originalAllow].sort()) ||
    JSON.stringify([...draftDeny].sort()) !== JSON.stringify([...originalDeny].sort()) ||
    draftElevated !== originalElevated

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated: AgentConfig = {
        ...agent,
        tools: {
          ...agent.tools,
          profile: draftProfile as NonNullable<AgentConfig['tools']>['profile'],
          allow: draftAllow.length > 0 ? draftAllow : undefined,
          deny: draftDeny.length > 0 ? draftDeny : undefined,
          elevated: draftElevated ? { enabled: true } : undefined,
        },
      }
      await onSaveAgent(updated)
      message.success(t('agents.tools.saveSuccess'))
    } catch (err) {
      message.error(t('agents.tools.saveFailed', { error: String(err) }))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = (): void => {
    setDraftProfile(originalProfile)
    setDraftAllow([...originalAllow])
    setDraftDeny([...originalDeny])
    setDraftElevated(originalElevated)
  }

  const handleToggleTool = (toolId: string, groupId: string): void => {
    const tool = catalog?.groups.flatMap((g) => g.tools).find((t) => t.id === toolId)
    if (!tool) return
    const state = resolveToolState(
      toolId,
      groupId,
      tool.defaultProfiles,
      draftProfile,
      draftAllow,
      draftDeny
    )
    const { allow, deny } = toggleToolState(toolId, groupId, state, draftAllow, draftDeny)
    setDraftAllow(allow)
    setDraftDeny(deny)
  }

  const handleToggleGroup = (groupId: string, tools: ToolCatalogEntry[]): void => {
    const { allow, deny } = toggleGroupState(groupId, tools, draftProfile, draftAllow, draftDeny)
    setDraftAllow(allow)
    setDraftDeny(deny)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ marginBottom: 20 }}>
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
          {t('agents.tools.sectionProfile')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PROFILE_ORDER.map((profileId) => {
            const cfg = PROFILE_CONFIG[profileId]
            const isActive = draftProfile === profileId
            const opt = TOOLS_PROFILE_OPTIONS.find((o) => o.value === profileId)
            const [profileName, profileDesc] = (opt ? t(opt.labelKey) : profileId).split('—')
            return (
              <div
                key={profileId}
                onClick={() => setDraftProfile(profileId)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1.5px solid ${isActive ? cfg.border : '#f0f0f0'}`,
                  background: isActive ? cfg.bg : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <div
                  style={{ fontSize: 12, fontWeight: 700, color: isActive ? cfg.color : '#595959' }}
                >
                  {profileName?.trim()}
                </div>
                {profileDesc && (
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, lineHeight: 1.4 }}>
                    {profileDesc.trim()}
                  </div>
                )}
                {isActive && (
                  <div style={{ marginTop: 4 }}>
                    <CheckCircleFilled style={{ fontSize: 11, color: cfg.color }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: '#aaa',
            }}
          >
            {t('agents.tools.sectionCatalog')}
          </div>
          {!wsReady && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              🔌 {t('agents.tools.wsRequired')}
            </Typography.Text>
          )}
          {wsReady && catalogError && (
            <Button
              size="small"
              type="link"
              icon={<ReloadOutlined />}
              onClick={loadCatalog}
              style={{ padding: 0, height: 'auto' }}
            >
              {t('agents.files.retry')}
            </Button>
          )}
        </div>

        {catalogLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <Spin size="small" />
            <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
              {t('agents.tools.loading')}
            </div>
          </div>
        ) : !wsReady ? (
          <div
            style={{
              padding: '16px',
              borderRadius: 8,
              background: '#fafaf8',
              border: '1px dashed #e8e8e8',
              textAlign: 'center',
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('agents.tools.wsHint')}
            </Typography.Text>
            {(draftAllow.length > 0 || draftDeny.length > 0) && (
              <div style={{ marginTop: 12, textAlign: 'left' }}>
                {draftAllow.length > 0 && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#aaa', marginRight: 8 }}>allow:</span>
                    {draftAllow.map((id) => (
                      <span
                        key={id}
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          background: '#f6ffed',
                          color: '#389e0d',
                          padding: '1px 6px',
                          borderRadius: 3,
                          marginRight: 4,
                        }}
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
                {draftDeny.length > 0 && (
                  <div>
                    <span style={{ fontSize: 11, color: '#aaa', marginRight: 8 }}>deny:</span>
                    {draftDeny.map((id) => (
                      <span
                        key={id}
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          background: '#fff2f0',
                          color: '#ff4d4f',
                          padding: '1px 6px',
                          borderRadius: 3,
                          marginRight: 4,
                        }}
                      >
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : catalogError ? (
          <Alert
            type="error"
            message={t('agents.tools.saveFailed', { error: catalogError })}
            style={{ marginBottom: 12 }}
          />
        ) : catalog ? (
          <div>
            {catalog.groups.map((group) => (
              <ToolGroupSection
                key={group.id}
                group={group}
                profile={draftProfile}
                allow={draftAllow}
                deny={draftDeny}
                onToggleTool={handleToggleTool}
                onToggleGroup={handleToggleGroup}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 8,
          border: `1px solid ${draftElevated ? '#ffbb96' : '#f0f0f0'}`,
          background: draftElevated ? '#fff7f0' : '#fafafa',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: draftElevated ? '#d4380d' : '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {draftElevated && <WarningOutlined style={{ color: '#fa8c16' }} />}
              {t('agents.tools.elevated')}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 2 }}>
              {t('agents.tools.elevatedHint')}
            </div>
          </div>
          <Switch
            checked={draftElevated}
            onChange={setDraftElevated}
            style={draftElevated ? { background: '#ff7a45' } : {}}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
          paddingTop: 16,
          marginTop: 16,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        {!isDirty && (
          <Typography.Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
            {t('agents.tools.noChanges')}
          </Typography.Text>
        )}
        <Button size="small" onClick={handleReset} disabled={!isDirty} icon={<ReloadOutlined />}>
          {t('agents.files.discardBtn')}
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          loading={saving}
          disabled={!isDirty}
          onClick={handleSave}
          style={isDirty ? { background: '#FF4D2A', borderColor: '#FF4D2A' } : {}}
        >
          {t('agents.files.saveBtn')}
        </Button>
      </div>
    </div>
  )
}
