import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Empty,
  Input,
  Space,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { ReloadOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { AgentSkillsTabProps, SkillEntry } from '../agents-page.types'
import { SKILL_GROUPS } from '../agents-page.utils'

function groupSkillEntries(
  skills: SkillEntry[]
): Array<{ id: string; labelKey: string; skills: SkillEntry[] }> {
  const groups = new Map(
    SKILL_GROUPS.map((g) => [g.id, { id: g.id, labelKey: g.label, skills: [] as SkillEntry[] }])
  )
  const other = { id: 'other', labelKey: 'agents.skills.groupOther', skills: [] as SkillEntry[] }
  for (const skill of skills) {
    const match = skill.bundled
      ? SKILL_GROUPS.find((g) => g.id === 'built-in')
      : SKILL_GROUPS.find((g) => g.sources.includes(skill.source ?? ''))
    if (match) {
      groups.get(match.id)!.skills.push(skill)
    } else {
      other.skills.push(skill)
    }
  }
  const ordered = SKILL_GROUPS.map((g) => groups.get(g.id)!).filter((g) => g.skills.length > 0)
  if (other.skills.length > 0) ordered.push(other)
  return ordered
}

export function AgentSkillsTab({
  agent,
  wsReady,
  callRpc,
  onSaveAgent,
}: AgentSkillsTabProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [report, setReport] = useState<SkillEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)

  const currentAllowlist = Array.isArray(agent.skills) ? (agent.skills as string[]) : undefined
  const [draftAllowlist, setDraftAllowlist] = useState<string[] | undefined>(currentAllowlist)

  const isDirty = JSON.stringify(draftAllowlist) !== JSON.stringify(currentAllowlist)

  useEffect(() => {
    setDraftAllowlist(Array.isArray(agent.skills) ? (agent.skills as string[]) : undefined)
    setReport(null)
    setError(null)
    setFilter('')
  }, [agent.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSkills = useCallback(async (): Promise<void> => {
    if (!wsReady) return
    setLoading(true)
    setError(null)
    try {
      const payload = (await callRpc('skills.status', { agentId: agent.id })) as {
        skills: SkillEntry[]
      }
      setReport(payload.skills ?? [])
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [wsReady, callRpc, agent.id])

  useEffect(() => {
    if (wsReady) loadSkills()
  }, [wsReady, agent.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const usingAllowlist = draftAllowlist !== undefined
  const allowSet = new Set(draftAllowlist ?? [])

  const handleToggle = (skillName: string, enabled: boolean): void => {
    const allSkills = (report ?? []).map((s) => s.name)
    const base = draftAllowlist ?? allSkills
    const next = new Set(base)
    if (enabled) {
      next.add(skillName)
    } else {
      next.delete(skillName)
    }
    setDraftAllowlist([...next])
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const updated = { ...agent }
      if (draftAllowlist === undefined) {
        delete updated.skills
      } else {
        updated.skills = draftAllowlist
      }
      await onSaveAgent(updated)
      message.success(t('agents.skills.saveSuccess'))
    } catch (err) {
      message.error(t('agents.skills.saveFailed', { error: String(err) }))
    } finally {
      setSaving(false)
    }
  }

  const filterLower = filter.trim().toLowerCase()
  const rawSkills = report ?? []
  const filtered = filterLower
    ? rawSkills.filter((s) =>
        [s.name, s.description ?? '', s.source].join(' ').toLowerCase().includes(filterLower)
      )
    : rawSkills
  const groups = groupSkillEntries(filtered)

  const enabledCount = usingAllowlist
    ? rawSkills.filter((s) => allowSet.has(s.name)).length
    : rawSkills.length

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <Typography.Text strong style={{ fontSize: 13 }}>
            {t('agents.skills.title')}
          </Typography.Text>
          {rawSkills.length > 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              {enabledCount}/{rawSkills.length}
            </Typography.Text>
          )}
        </div>
        <Space size={6}>
          <Button
            size="small"
            disabled={!wsReady || saving}
            onClick={() => setDraftAllowlist(undefined)}
          >
            {t('agents.skills.useAll')}
          </Button>
          <Button size="small" disabled={!wsReady || saving} onClick={() => setDraftAllowlist([])}>
            {t('agents.skills.disableAll')}
          </Button>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            disabled={!wsReady}
            onClick={loadSkills}
          />
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!isDirty}
            onClick={handleSave}
          >
            {t('agents.skills.save')}
          </Button>
        </Space>
      </div>

      {usingAllowlist ? (
        <Alert
          type="info"
          message={t('agents.skills.usingAllowlist')}
          style={{ marginBottom: 12 }}
          showIcon
        />
      ) : (
        <Alert
          type="success"
          message={t('agents.skills.usingAll')}
          style={{ marginBottom: 12 }}
          showIcon
        />
      )}

      {!wsReady && (
        <Alert
          type="warning"
          message={t('agents.skills.wsRequired')}
          style={{ marginBottom: 12 }}
          showIcon
        />
      )}

      {error && (
        <Alert
          type="error"
          message={error}
          style={{ marginBottom: 12 }}
          showIcon
          action={
            <Button size="small" onClick={loadSkills}>
              {t('agents.skills.retry')}
            </Button>
          }
        />
      )}

      {wsReady && (
        <Input
          placeholder={t('agents.skills.filterPlaceholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          prefix={<span style={{ color: '#bbb', fontSize: 12 }}>🔍</span>}
          allowClear
          size="small"
          style={{ marginBottom: 12 }}
        />
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Spin size="small" />
          <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            {t('agents.skills.loading')}
          </Typography.Text>
        </div>
      )}

      {!loading && wsReady && rawSkills.length === 0 && !error && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('agents.skills.noSkills')}
          style={{ margin: '24px 0' }}
        />
      )}

      {!loading &&
        groups.map((group) => (
          <div key={group.id} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                padding: '4px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <ThunderboltOutlined style={{ color: '#FF4D2A', fontSize: 11 }} />
              <Typography.Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#595959',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {t(group.labelKey)}
              </Typography.Text>
              <Tag
                style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', marginLeft: 'auto' }}
              >
                {group.skills.length}
              </Tag>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {group.skills.map((skill) => {
                const isEnabled = usingAllowlist ? allowSet.has(skill.name) : true
                const canToggle = !skill.always && wsReady
                const hasMissing =
                  (skill.missing?.bins?.length ?? 0) > 0 ||
                  (skill.missing?.env?.length ?? 0) > 0 ||
                  (skill.missing?.config?.length ?? 0) > 0

                return (
                  <div
                    key={skill.name}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: isEnabled ? 'transparent' : '#fafafa',
                      opacity: isEnabled ? 1 : 0.6,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        flexShrink: 0,
                        textAlign: 'center',
                        fontSize: 18,
                        lineHeight: '22px',
                        marginTop: 1,
                      }}
                    >
                      {skill.emoji || (
                        <ThunderboltOutlined style={{ color: '#bbb', fontSize: 14 }} />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
                      >
                        <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                          {skill.name}
                        </Typography.Text>
                        {skill.always && (
                          <Tag
                            color="cyan"
                            style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}
                          >
                            {t('agents.skills.alwaysOn')}
                          </Tag>
                        )}
                        {!skill.eligible && (
                          <Tooltip
                            title={
                              hasMissing
                                ? [
                                    ...(skill.missing?.bins?.length
                                      ? [`缺少命令: ${skill.missing.bins.join(', ')}`]
                                      : []),
                                    ...(skill.missing?.env?.length
                                      ? [`缺少环境变量: ${skill.missing.env.join(', ')}`]
                                      : []),
                                    ...(skill.missing?.config?.length
                                      ? [`缺少配置: ${skill.missing.config.join(', ')}`]
                                      : []),
                                  ].join(' | ')
                                : t('agents.skills.notReady')
                            }
                          >
                            <Tag
                              color="warning"
                              style={{
                                fontSize: 10,
                                padding: '0 4px',
                                lineHeight: '16px',
                                cursor: 'help',
                              }}
                            >
                              {t('agents.skills.notReady')}
                            </Tag>
                          </Tooltip>
                        )}
                      </div>
                      {skill.description && (
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 11, display: 'block', marginTop: 1 }}
                        >
                          {skill.description}
                        </Typography.Text>
                      )}
                    </div>

                    <Switch
                      size="small"
                      checked={isEnabled}
                      disabled={!canToggle}
                      onChange={(checked) => handleToggle(skill.name, checked)}
                      style={{ flexShrink: 0, marginTop: 3 }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
    </div>
  )
}
