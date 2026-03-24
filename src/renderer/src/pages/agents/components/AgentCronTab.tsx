import { useEffect, useMemo, useState } from 'react'
import { Button, Empty, List, Space, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { AgentCronTabProps } from '../agents-page.types'

interface CronJobRow {
  id: string
  name?: string
  enabled?: boolean
  agentId?: string
  payload?: {
    agentId?: string
  }
  schedule?: {
    kind?: 'every' | 'cron' | 'at'
    everyMs?: number
    expr?: string
    at?: string
  }
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastRunStatus?: 'ok' | 'error' | 'skipped'
  }
  lastRunStatus?: 'ok' | 'error' | 'skipped'
  lastRunAt?: number
  nextRunAt?: number
  nextRunAtMs?: number
}

function formatSchedule(job: CronJobRow): string {
  const schedule = job.schedule
  if (!schedule) return '-'
  if (schedule.kind === 'every') {
    const ms = schedule.everyMs || 0
    if (!ms) return 'every ?'
    if (ms % 3_600_000 === 0) return `every ${ms / 3_600_000}h`
    if (ms % 60_000 === 0) return `every ${ms / 60_000}m`
    return `every ${Math.round(ms / 1000)}s`
  }
  if (schedule.kind === 'cron') return schedule.expr || 'cron'
  if (schedule.kind === 'at') return schedule.at || 'once'
  return '-'
}

function formatTime(ts?: number): string {
  if (!ts) return '-'
  return new Date(ts).toLocaleString()
}

export function AgentCronTab({ agentId, wsReady, callRpc }: AgentCronTabProps): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<CronJobRow[]>([])

  useEffect(() => {
    if (!wsReady) return
    let cancelled = false
    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const result = (await callRpc('cron.list', { limit: 100, offset: 0 })) as {
          jobs?: CronJobRow[]
        }
        if (cancelled) return
        const allJobs = result.jobs || []
        const related = allJobs.filter((job) => {
          const directAgentId = job.agentId
          const payloadAgentId = job.payload?.agentId
          return directAgentId === agentId || payloadAgentId === agentId
        })
        setJobs(related)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [agentId, callRpc, wsReady])

  const enabledCount = useMemo(() => jobs.filter((job) => job.enabled !== false).length, [jobs])
  const errorCount = useMemo(
    () =>
      jobs.filter((job) => (job.state?.lastRunStatus || job.lastRunStatus || '') === 'error')
        .length,
    [jobs]
  )

  if (!wsReady) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('agents.cron.wsRequired')} />
  }

  if (error) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('agents.cron.loadFailed', { error })}
      />
    )
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Space size={16} align="center">
        <Typography.Text type="secondary">
          {t('agents.cron.summary.total', { count: jobs.length })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('agents.cron.summary.enabled', { count: enabledCount })}
        </Typography.Text>
        <Typography.Text type="secondary">
          {t('agents.cron.summary.failed', { count: errorCount })}
        </Typography.Text>
        <Button size="small" onClick={() => navigate('/cron')}>
          {t('agents.cron.openManage')}
        </Button>
      </Space>

      <List
        loading={loading}
        locale={{ emptyText: t('agents.cron.empty') }}
        bordered
        dataSource={jobs}
        renderItem={(job) => {
          const lastStatus = job.state?.lastRunStatus || job.lastRunStatus
          const lastRunAt = job.state?.lastRunAtMs || job.lastRunAt
          const nextRunAt = job.state?.nextRunAtMs || job.nextRunAtMs || job.nextRunAt
          return (
            <List.Item>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Space size={8} align="center">
                  <Typography.Text strong>{job.name || job.id}</Typography.Text>
                  {job.enabled === false ? (
                    <Tag>{t('agents.cron.disabled')}</Tag>
                  ) : (
                    <Tag color="green">{t('agents.cron.enabled')}</Tag>
                  )}
                  {lastStatus === 'error' ? (
                    <Tag color="red">{t('agents.cron.statusError')}</Tag>
                  ) : lastStatus === 'ok' ? (
                    <Tag color="green">{t('agents.cron.statusOk')}</Tag>
                  ) : lastStatus === 'skipped' ? (
                    <Tag>{t('agents.cron.statusSkipped')}</Tag>
                  ) : null}
                </Space>
                <Typography.Text type="secondary">
                  {t('agents.cron.schedule')}: {formatSchedule(job)}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {t('agents.cron.lastRun')}: {formatTime(lastRunAt)} | {t('agents.cron.nextRun')}:{' '}
                  {formatTime(nextRunAt)}
                </Typography.Text>
              </Space>
            </List.Item>
          )
        }}
      />
    </Space>
  )
}
