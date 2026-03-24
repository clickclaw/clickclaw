/**
 * Dashboard — ClickClaw 控制台
 *
 * 设计语言：控制中心（Control Center）
 * - Gateway 状态卡：视觉核心，大号状态指示 + 操作按钮
 * - 三格配置卡：模型 / Agent / 渠道，引导用户点击跳转
 * - 近期日志预览：精简展示最后几行，完整内容在 /logs 页面
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button, Card, Spin, theme } from 'antd'
import {
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  FileTextOutlined,
  GlobalOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGatewayContext } from '../../contexts/GatewayContext'

// ========== 类型 ==========

interface DashStats {
  providerCount: number
  defaultModel: string | null
  agentCount: number
  defaultAgent: string | null
  channelCount: number
  channelNames: string[]
  cronTotal: number
  cronEnabled: number
  cronFailed: number
  cronLatestName: string | null
  cronLatestStatus: 'ok' | 'error' | 'skipped' | null
  cronLatestAt: number | null
  cronNextAt: number | null
}

interface DashCronJob {
  id: string
  name: string
  enabled: boolean
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastRunStatus?: 'ok' | 'error' | 'skipped'
  }
  lastRun?: {
    status: 'ok' | 'error' | 'skipped'
    startedAt: number
  }
  lastRunAt?: number
  lastRunStatus?: 'ok' | 'error' | 'skipped'
  nextRunAt?: number
  nextRunAtMs?: number
}

interface DashCronTimelineItem {
  id: string
  name: string
  enabled: boolean
  lastStatus: 'ok' | 'error' | 'skipped' | null
  lastAt: number | null
  nextAt: number | null
}

// ========== 日志工具 ==========

function stripLogMeta(line: string): string {
  return line
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?\s*/, '')
    .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
    .replace(/^{"level":"[^"]*","time":[^,]+,/, '{')
    .trim()
}

function parseLogTime(line: string): string {
  const m = line.match(/(\d{2}:\d{2}:\d{2})/)
  return m ? m[1] : ''
}

function logLevel(line: string): 'error' | 'warn' | 'info' | 'debug' {
  const l = line.toLowerCase()
  if (l.includes('"level":"error"') || / error[: ]/.test(l)) return 'error'
  if (l.includes('"level":"warn"') || / warn[: ]/.test(l)) return 'warn'
  if (l.includes('"level":"debug"') || / debug[: ]/.test(l)) return 'debug'
  return 'info'
}

function pickLastRunAt(job: DashCronJob): number | null {
  return job.state?.lastRunAtMs ?? job.lastRunAt ?? job.lastRun?.startedAt ?? null
}

function pickNextRunAt(job: DashCronJob): number | null {
  return job.state?.nextRunAtMs ?? job.nextRunAtMs ?? job.nextRunAt ?? null
}

function pickLastRunStatus(job: DashCronJob): 'ok' | 'error' | 'skipped' | null {
  return job.state?.lastRunStatus ?? job.lastRunStatus ?? job.lastRun?.status ?? null
}

// 语义日志色（深色背景版，与 LogsPage 保持一致）
const LOG_COLORS: Record<string, string> = {
  error: '#ff4d4f',
  warn: '#fa8c16',
  info: 'rgba(255,255,255,0.75)',
  debug: 'rgba(255,255,255,0.35)',
}

// ========== uptime 计时器 ==========

function useUptime(isRunning: boolean): string {
  const startedAtRef = useRef<number | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (isRunning && startedAtRef.current === null) {
      startedAtRef.current = Date.now()
    } else if (!isRunning) {
      startedAtRef.current = null
    }
  }, [isRunning])

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  if (!isRunning || startedAtRef.current === null) return ''
  const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
  const h = Math.floor(elapsed / 3600)
    .toString()
    .padStart(2, '0')
  const m = Math.floor((elapsed % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

// ========== 主组件 ==========

function DashboardPage(): React.ReactElement {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { gwState, gwPort, status, callRpc } = useGatewayContext()

  const isRunning = gwState === 'running'
  const isStarting = gwState === 'starting'
  const isStopping = gwState === 'stopping'
  const uptime = useUptime(isRunning)

  // ── 统计数据 ──
  const [stats, setStats] = useState<DashStats>({
    providerCount: 0,
    defaultModel: null,
    agentCount: 0,
    defaultAgent: null,
    channelCount: 0,
    channelNames: [],
    cronTotal: 0,
    cronEnabled: 0,
    cronFailed: 0,
    cronLatestName: null,
    cronLatestStatus: null,
    cronLatestAt: null,
    cronNextAt: null,
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [cronJobs, setCronJobs] = useState<DashCronJob[]>([])
  const [logExpanded, setLogExpanded] = useState(false)
  const [guideMode, setGuideMode] = useState<'auto' | 'always' | 'hidden'>('auto')
  const [hasGatewayStartedOnce, setHasGatewayStartedOnce] = useState(false)
  const [guideExpanded, setGuideExpanded] = useState(false)

  const formatWhen = useCallback(
    (timestampMs: number | null): string => {
      if (!timestampMs) return t('dashboard.modules.cron.none')
      const delta = Date.now() - timestampMs
      const abs = Math.abs(delta)
      if (abs < 60_000) return t('dashboard.modules.cron.justNow')
      if (abs < 3_600_000) {
        const n = Math.floor(abs / 60_000)
        return delta >= 0
          ? t('dashboard.modules.cron.minutesAgo', { n })
          : t('dashboard.modules.cron.inMinutes', { n })
      }
      if (abs < 86_400_000) {
        const n = Math.floor(abs / 3_600_000)
        return delta >= 0
          ? t('dashboard.modules.cron.hoursAgo', { n })
          : t('dashboard.modules.cron.inHours', { n })
      }
      const n = Math.floor(abs / 86_400_000)
      return delta >= 0
        ? t('dashboard.modules.cron.daysAgo', { n })
        : t('dashboard.modules.cron.inDays', { n })
    },
    [t]
  )

  useEffect(() => {
    window.api.appState
      .get()
      .then((s) => {
        const state = s as {
          dashboardGuideMode?: 'auto' | 'always' | 'hidden'
          hasGatewayStartedOnce?: boolean
        }
        setGuideMode(state.dashboardGuideMode ?? 'auto')
        setHasGatewayStartedOnce(state.hasGatewayStartedOnce === true)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isRunning || hasGatewayStartedOnce) return
    setHasGatewayStartedOnce(true)
    window.api.appState.set({ hasGatewayStartedOnce: true }).catch(() => {})
  }, [isRunning, hasGatewayStartedOnce])

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const [providers, defaultModel, agents, channels] = await Promise.all([
        window.api.model.listProviders().catch(() => ({})),
        window.api.model.getDefault().catch(() => null),
        window.api.agent.list().catch(() => []),
        window.api.channel.list().catch(() => ({})),
      ])

      let cronJobs: DashCronJob[] = []
      if (gwState === 'running' && status === 'ready') {
        try {
          const result = (await callRpc('cron.list', { limit: 20, offset: 0 })) as {
            jobs?: DashCronJob[]
          }
          cronJobs = Array.isArray(result?.jobs) ? result.jobs : []
        } catch {
          // Gateway 未就绪或未启用 cron 时静默降级
        }
      }
      setCronJobs(cronJobs)

      const providerCount = Object.keys(providers as Record<string, unknown>).length
      const defaultModelStr =
        defaultModel == null
          ? null
          : typeof defaultModel === 'string'
            ? defaultModel
            : (defaultModel as { primary: string }).primary

      const agentList = Array.isArray(agents)
        ? (agents as Array<{
            id?: string
            default?: boolean
            name?: string
            identity?: { name?: string }
          }>)
        : []
      const customAgents = agentList.filter((a) => a.id !== 'main')
      const defaultAgentEntry = agentList.find((a) => a.default)
      const defaultAgentName = defaultAgentEntry
        ? defaultAgentEntry.identity?.name || defaultAgentEntry.name || defaultAgentEntry.id || null
        : null

      const channelMap = channels as Record<string, { enabled?: boolean }>
      const enabledChannels = Object.entries(channelMap).filter(([, v]) => v?.enabled !== false)

      const cronEnabled = cronJobs.filter((j) => j.enabled).length
      const cronFailed = cronJobs.filter((j) => pickLastRunStatus(j) === 'error').length

      let cronLatestJob: DashCronJob | null = null
      let latestAt = 0
      for (const job of cronJobs) {
        const runAt = pickLastRunAt(job)
        if (runAt && runAt > latestAt) {
          latestAt = runAt
          cronLatestJob = job
        }
      }

      let cronNextAt: number | null = null
      for (const job of cronJobs) {
        if (!job.enabled) continue
        const next = pickNextRunAt(job)
        if (!next) continue
        if (cronNextAt === null || next < cronNextAt) cronNextAt = next
      }

      setStats({
        providerCount,
        defaultModel: defaultModelStr,
        agentCount: customAgents.length,
        defaultAgent: defaultAgentName,
        channelCount: enabledChannels.length,
        channelNames: enabledChannels
          .map(([k]) => t(`dashboard.channelNames.${k}`, { defaultValue: k }))
          .slice(0, 3),
        cronTotal: cronJobs.length,
        cronEnabled,
        cronFailed,
        cronLatestName: cronLatestJob?.name ?? null,
        cronLatestStatus: cronLatestJob ? pickLastRunStatus(cronLatestJob) : null,
        cronLatestAt: cronLatestJob ? pickLastRunAt(cronLatestJob) : null,
        cronNextAt,
      })
    } catch {
      // 静默降级
    } finally {
      setStatsLoading(false)
    }
  }, [callRpc, gwState, status, t])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Dashboard 没有配置变更推送事件，使用轻量轮询 + 回焦刷新保持数据新鲜度
  useEffect(() => {
    const refresh = (): void => {
      void loadStats()
    }
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') refresh()
    }

    const intervalId = window.setInterval(refresh, 5000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [loadStats])

  // ── 近期日志（只保留最近 30 条作为预览）──
  const [logs, setLogs] = useState<string[]>([])
  const logBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.gateway.getLogBuffer().then((buf) => {
      if (buf.length > 0) setLogs(buf.slice(-30))
    })
    const offLog = window.api.gateway.onLog((line) => {
      setLogs((prev) => {
        const next = [...prev, line]
        return next.length > 30 ? next.slice(-30) : next
      })
    })
    return () => {
      offLog()
    }
  }, [])

  // 自动滚到底部
  useEffect(() => {
    const box = logBoxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [logs])

  // ── Gateway 状态颜色 ──
  const statusColor = isRunning
    ? '#52c41a'
    : isStarting || isStopping
      ? '#faad14'
      : token.colorTextQuaternary

  const statusBorderColor = isRunning
    ? 'rgba(82,196,26,0.25)'
    : isStarting || isStopping
      ? 'rgba(250,173,20,0.25)'
      : token.colorBorderSecondary

  const statusBg = isRunning
    ? 'rgba(82,196,26,0.04)'
    : isStarting || isStopping
      ? 'rgba(250,173,20,0.04)'
      : token.colorFillTertiary

  const stateLabel = t(
    `dashboard.${gwState as 'running' | 'starting' | 'stopping' | 'stopped'}`,
    t('dashboard.stopped')
  )
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null

  const checklist = [
    {
      key: 'gateway',
      done: hasGatewayStartedOnce,
      optional: false,
      title: t('dashboard.beginner.steps.gateway.title'),
      desc: t('dashboard.beginner.steps.gateway.desc'),
      cta: t('dashboard.beginner.steps.gateway.cta'),
      onClick: () => window.api.gateway.start(),
    },
    {
      key: 'model',
      done: stats.defaultModel != null,
      optional: false,
      title: t('dashboard.beginner.steps.model.title'),
      desc: t('dashboard.beginner.steps.model.desc'),
      cta: t('dashboard.beginner.steps.model.cta'),
      onClick: () => navigate('/models'),
    },
    {
      key: 'channel',
      done: stats.channelCount > 0,
      optional: true,
      title: t('dashboard.beginner.steps.channel.title'),
      desc: t('dashboard.beginner.steps.channel.desc'),
      cta: t('dashboard.beginner.steps.channel.cta'),
      onClick: () => navigate('/channels'),
    },
  ]

  const firstPendingKey =
    checklist.find((item) => !item.done && !item.optional)?.key ??
    checklist.find((item) => !item.done)?.key
  const guideAutoVisible = !stats.defaultModel || !hasGatewayStartedOnce
  const showBeginnerGuide =
    guideMode === 'always' || (guideMode === 'auto' && (guideAutoVisible || guideExpanded))
  const showBeginnerSummary = guideMode === 'auto' && !guideAutoVisible && !guideExpanded
  const requiredDoneCount = checklist.filter((item) => item.done && !item.optional).length
  const requiredTotalCount = checklist.filter((item) => !item.optional).length

  const nextAction = !isRunning
    ? {
        title: t('dashboard.next.gateway.title'),
        desc: t('dashboard.next.gateway.desc'),
        cta: t('dashboard.next.gateway.cta'),
        onClick: () => window.api.gateway.start(),
      }
    : !stats.defaultModel
      ? {
          title: t('dashboard.next.model.title'),
          desc: t('dashboard.next.model.desc'),
          cta: t('dashboard.next.model.cta'),
          onClick: () => navigate('/models'),
        }
      : stats.agentCount === 0
        ? {
            title: t('dashboard.next.agent.title'),
            desc: t('dashboard.next.agent.desc'),
            cta: t('dashboard.next.agent.cta'),
            onClick: () => navigate('/agents'),
          }
        : {
            title: t('dashboard.next.chat.title'),
            desc: t('dashboard.next.chat.desc'),
            cta: t('dashboard.next.chat.cta'),
            onClick: () => navigate('/chat'),
          }

  const recentRuns: DashCronTimelineItem[] = cronJobs
    .map((job) => ({
      id: job.id,
      name: job.name || job.id,
      enabled: job.enabled,
      lastStatus: pickLastRunStatus(job),
      lastAt: pickLastRunAt(job),
      nextAt: pickNextRunAt(job),
    }))
    .filter((job) => job.lastAt != null || job.nextAt != null || job.enabled)
    .sort((a, b) => {
      const aLast = a.lastAt ?? 0
      const bLast = b.lastAt ?? 0
      if (aLast !== bLast) return bLast - aLast
      const aNext = a.nextAt ?? Number.MAX_SAFE_INTEGER
      const bNext = b.nextAt ?? Number.MAX_SAFE_INTEGER
      return aNext - bNext
    })
    .slice(0, 5)

  const scenarioTasks = [
    {
      key: 'chat',
      title: t('dashboard.modules.chat.title'),
      desc: t('dashboard.modules.chat.desc'),
      done: isRunning && stats.defaultModel != null,
      detail:
        isRunning && stats.defaultModel != null
          ? t('dashboard.modules.chat.summaryReady')
          : t('dashboard.modules.chat.summaryPending'),
      cta: t('dashboard.quickActions.chat'),
      onClick: () => navigate('/chat'),
    },
    {
      key: 'agent',
      title: t('dashboard.modules.agents.title'),
      desc: t('dashboard.modules.agents.desc'),
      done: stats.agentCount > 0,
      detail:
        stats.defaultAgent ??
        (stats.agentCount > 0
          ? t('dashboard.modules.agents.summaryCount', { count: stats.agentCount })
          : t('dashboard.modules.agents.summaryPending')),
      cta: t('dashboard.quickActions.agents'),
      onClick: () => navigate('/agents'),
    },
    {
      key: 'channel',
      title: t('dashboard.modules.channels.title'),
      desc: t('dashboard.modules.channels.desc'),
      done: stats.channelCount > 0,
      detail:
        stats.channelNames.length > 0
          ? stats.channelNames.join(' · ')
          : t('dashboard.modules.channels.summaryPending'),
      cta: t('dashboard.modules.channels.title'),
      onClick: () => navigate('/channels'),
    },
    {
      key: 'cron',
      title: t('dashboard.modules.cron.title'),
      desc: t('dashboard.modules.cron.desc'),
      done: stats.cronTotal > 0 && stats.cronFailed === 0,
      detail:
        stats.cronTotal > 0
          ? t('dashboard.modules.cron.summary', {
              enabled: stats.cronEnabled,
              total: stats.cronTotal,
            })
          : t('dashboard.modules.cron.noRecord'),
      cta: t('dashboard.quickActions.cron'),
      onClick: () => navigate('/cron'),
    },
  ]

  const todoQueue = [
    !isRunning
      ? {
          key: 'start-gateway',
          title: t('dashboard.queue.gateway.title'),
          desc: t('dashboard.queue.gateway.desc'),
          cta: t('dashboard.queue.gateway.cta'),
          onClick: () => window.api.gateway.start(),
        }
      : null,
    stats.defaultModel == null
      ? {
          key: 'setup-model',
          title: t('dashboard.queue.model.title'),
          desc: t('dashboard.queue.model.desc'),
          cta: t('dashboard.queue.model.cta'),
          onClick: () => navigate('/models'),
        }
      : null,
    stats.agentCount === 0
      ? {
          key: 'create-agent',
          title: t('dashboard.queue.agent.title'),
          desc: t('dashboard.queue.agent.desc'),
          cta: t('dashboard.queue.agent.cta'),
          onClick: () => navigate('/agents'),
        }
      : null,
    stats.cronFailed > 0
      ? {
          key: 'check-cron-failed',
          title: t('dashboard.queue.cronFailure.title'),
          desc: t('dashboard.queue.cronFailure.desc', { count: stats.cronFailed }),
          cta: t('dashboard.queue.cronFailure.cta'),
          onClick: () => navigate('/cron'),
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string
    title: string
    desc: string
    cta: string
    onClick: () => void
  }>

  return (
    <div
      style={{
        padding: '24px 28px',
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* ── 0. 新手任务清单 ── */}
      {showBeginnerGuide && (
        <Card
          style={{ borderColor: token.colorBorderSecondary }}
          styles={{ body: { padding: 18 } }}
        >
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: token.colorText }}>
                {t('dashboard.beginner.title')}
              </div>
              <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextTertiary }}>
                {t('dashboard.beginner.subtitle')}
              </div>
            </div>
            {guideMode !== 'always' && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => {
                  setGuideMode('hidden')
                  setGuideExpanded(false)
                  window.api.appState.set({ dashboardGuideMode: 'hidden' }).catch(() => {})
                }}
              >
                {t('dashboard.beginner.hide')}
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checklist.map((item, idx) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  borderRadius: 8,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: item.done ? 'rgba(82,196,26,0.15)' : token.colorFillSecondary,
                    color: item.done ? '#389e0d' : token.colorTextTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                    {item.title}
                  </div>
                  <div style={{ marginTop: 1, fontSize: 12, color: token.colorTextTertiary }}>
                    {item.desc}
                  </div>
                </div>

                {item.done ? (
                  <span style={{ fontSize: 12, color: '#389e0d', flexShrink: 0 }}>
                    {t('dashboard.beginner.done')}
                  </span>
                ) : (
                  <Button
                    type={item.key === firstPendingKey ? 'primary' : 'default'}
                    size="small"
                    style={
                      item.key === firstPendingKey
                        ? { background: '#FF4D2A', borderColor: '#FF4D2A' }
                        : undefined
                    }
                    onClick={item.onClick}
                  >
                    {item.cta}
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button size="small" onClick={() => navigate('/chat')}>
              {t('dashboard.quickActions.chat')}
            </Button>
            <Button size="small" onClick={() => navigate('/agents')}>
              {t('dashboard.quickActions.agents')}
            </Button>
            <Button size="small" onClick={() => navigate('/cron')}>
              {t('dashboard.quickActions.cron')}
            </Button>
            <Button size="small" onClick={() => navigate('/logs')}>
              {t('dashboard.quickActions.logs')}
            </Button>
          </div>
        </Card>
      )}

      {showBeginnerSummary && (
        <Card
          style={{ borderColor: token.colorBorderSecondary }}
          styles={{ body: { padding: 14 } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 13, color: token.colorTextSecondary }}>
              {t('dashboard.beginner.summaryDone')}
            </span>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => setGuideExpanded(true)}
            >
              {t('dashboard.beginner.reopen')}
            </Button>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto' }}
              onClick={() => {
                setGuideMode('hidden')
                setGuideExpanded(false)
                window.api.appState.set({ dashboardGuideMode: 'hidden' }).catch(() => {})
              }}
            >
              {t('dashboard.beginner.hide')}
            </Button>
          </div>
        </Card>
      )}

      {/* ── 1. Gateway 状态卡 ── */}
      <Card
        style={{
          borderColor: statusBorderColor,
          background: statusBg,
          transition: 'background 0.4s ease, border-color 0.4s ease',
          flexShrink: 0,
        }}
        styles={{ body: { padding: '18px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* 脉冲状态点 */}
          <div style={{ position: 'relative', width: 12, height: 12, flexShrink: 0 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: statusColor,
                transition: 'background 0.4s ease',
                position: 'relative',
                zIndex: 1,
              }}
            />
            {(isRunning || isStarting) && (
              <div
                style={{
                  position: 'absolute',
                  inset: -4,
                  borderRadius: '50%',
                  background: statusColor,
                  opacity: 0.2,
                  animation: 'ccPulse 2s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* 状态信息 */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: token.colorText }}>
                {t('dashboard.gatewayLabel')}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: statusColor,
                  transition: 'color 0.3s',
                }}
              >
                {stateLabel}
              </span>
              {isRunning && gwPort > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color: token.colorTextTertiary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  :{gwPort}
                </span>
              )}
              {isRunning && uptime && (
                <span
                  style={{
                    fontSize: 12,
                    color: token.colorTextQuaternary,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ↑ {uptime}
                </span>
              )}
            </div>
            {!isRunning && (
              <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>
                {t('dashboard.gatewayDesc')}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {gwState === 'stopped' && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => window.api.gateway.start()}
                style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
              >
                {t('dashboard.gatewayCard.start')}
              </Button>
            )}
            {isRunning && (
              <>
                <Button icon={<ReloadOutlined />} onClick={() => window.api.gateway.restart()}>
                  {t('dashboard.gatewayCard.restart')}
                </Button>
                <Button
                  danger
                  icon={<PoweroffOutlined />}
                  onClick={() => window.api.gateway.stop()}
                >
                  {t('dashboard.gatewayCard.stop')}
                </Button>
                <Button
                  icon={<GlobalOutlined />}
                  onClick={async () => {
                    const tok = await window.api.gateway.getToken()
                    const url = `http://127.0.0.1:${gwPort}/?token=${tok}`
                    window.api.shell.openExternal(url)
                  }}
                >
                  {t('dashboard.gatewayCard.openWebUI')}
                </Button>
              </>
            )}
            {(isStarting || isStopping) && (
              <Button loading disabled>
                {isStarting
                  ? t('dashboard.gatewayCard.startingBtn')
                  : t('dashboard.gatewayCard.stoppingBtn')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ── 2. 下一步 + 场景模块 ── */}
      <Card
        style={{ borderColor: token.colorBorderSecondary, flexShrink: 0 }}
        styles={{ body: { padding: 16 } }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: token.colorText }}>
              {t('dashboard.next.title')}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextTertiary }}>
              {t('dashboard.next.progress', {
                done: requiredDoneCount,
                total: requiredTotalCount,
              })}
            </div>
          </div>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A', flexShrink: 0 }}
            onClick={nextAction.onClick}
          >
            {nextAction.cta}
          </Button>
        </div>

        <div
          style={{
            marginTop: 10,
            borderRadius: 8,
            border: `1px dashed ${token.colorBorderSecondary}`,
            background: token.colorFillTertiary,
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
            {nextAction.title}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextTertiary }}>
            {nextAction.desc}
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, flexShrink: 0 }}>
        <Card
          style={{ borderColor: token.colorBorderSecondary }}
          styles={{ body: { padding: 14 } }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
            {t('dashboard.scenarios.title')}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextTertiary }}>
            {t('dashboard.scenarios.subtitle')}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scenarioTasks.map((item) => (
              <div
                key={item.key}
                style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  background: token.colorBgContainer,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.done ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                  ) : (
                    <ClockCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                      {item.title}
                    </div>
                    <div style={{ marginTop: 1, fontSize: 12, color: token.colorTextTertiary }}>
                      {item.desc}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 11, color: token.colorTextQuaternary }}>
                      {statsLoading ? <Spin size="small" style={{ opacity: 0.35 }} /> : item.detail}
                    </div>
                  </div>
                  <Button size="small" onClick={item.onClick}>
                    {item.cta}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          style={{ borderColor: token.colorBorderSecondary }}
          styles={{ body: { padding: 14 } }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
            {t('dashboard.queue.title')}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextTertiary }}>
            {t('dashboard.queue.subtitle')}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todoQueue.length === 0 ? (
              <div
                style={{
                  border: `1px dashed ${token.colorBorderSecondary}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 12,
                  color: token.colorTextSecondary,
                }}
              >
                {t('dashboard.queue.empty')}
              </div>
            ) : (
              todoQueue.map((item) => (
                <div
                  key={item.key}
                  style={{
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ExclamationCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                        {item.title}
                      </div>
                      <div style={{ marginTop: 1, fontSize: 12, color: token.colorTextTertiary }}>
                        {item.desc}
                      </div>
                    </div>
                    <Button size="small" type="primary" onClick={item.onClick}>
                      {item.cta}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card style={{ borderColor: token.colorBorderSecondary }} styles={{ body: { padding: 14 } }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
              {t('dashboard.runs.title')}
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: token.colorTextTertiary }}>
              {t('dashboard.runs.subtitle')}
            </div>
          </div>
          <Button size="small" onClick={() => navigate('/cron')}>
            {t('dashboard.runs.viewAll')}
          </Button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {statsLoading ? (
            <Spin size="small" />
          ) : recentRuns.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${token.colorBorderSecondary}`,
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12,
                color: token.colorTextSecondary,
              }}
            >
              {t('dashboard.runs.empty')}
            </div>
          ) : (
            recentRuns.map((item) => {
              const toneColor =
                item.lastStatus === 'error'
                  ? '#cf1322'
                  : item.lastStatus === 'ok'
                    ? '#389e0d'
                    : token.colorTextSecondary
              const statusLabel =
                item.lastStatus === 'ok'
                  ? t('dashboard.modules.cron.statusOk')
                  : item.lastStatus === 'error'
                    ? t('dashboard.modules.cron.statusError')
                    : item.lastStatus === 'skipped'
                      ? t('dashboard.modules.cron.statusSkipped')
                      : t('dashboard.runs.noLast')
              return (
                <div
                  key={item.id}
                  style={{
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.lastStatus === 'error' ? (
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                    ) : item.lastStatus === 'ok' ? (
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    ) : (
                      <ClockCircleOutlined style={{ color: '#faad14', fontSize: 12 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                        {item.name}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: token.colorTextQuaternary }}>
                        {t('dashboard.runs.lastAt', {
                          status: statusLabel,
                          when: formatWhen(item.lastAt),
                        })}
                        {' · '}
                        {t('dashboard.runs.nextAt', {
                          when:
                            item.nextAt != null
                              ? formatWhen(item.nextAt)
                              : t('dashboard.runs.noNext'),
                        })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: toneColor, fontWeight: 600 }}>
                      {item.enabled ? t('dashboard.runs.enabled') : t('dashboard.runs.disabled')}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* ── 3. 近期日志预览 ── */}
      <div style={{ flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: token.colorTextTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {t('dashboard.log.title')}
            </span>
            {isRunning && (
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: '#52c41a',
                  animation: 'ccPulse 1.5s ease-in-out infinite',
                }}
              />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 12, color: token.colorTextTertiary }}
              onClick={() => setLogExpanded((v) => !v)}
            >
              {logExpanded ? t('dashboard.log.collapse') : t('dashboard.log.expand')}
            </Button>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: 'auto', fontSize: 12, color: token.colorTextTertiary }}
              onClick={() => navigate('/logs')}
            >
              {t('dashboard.log.viewAll')} <ArrowRightOutlined style={{ fontSize: 10 }} />
            </Button>
          </div>
        </div>

        {logExpanded ? (
          <div
            ref={logBoxRef}
            style={{
              flex: 1,
              minHeight: 120,
              overflowY: 'auto',
              background: '#141414',
              borderRadius: 6,
              padding: '8px 12px',
              fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
              fontSize: 12,
              lineHeight: '20px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {logs.length === 0 ? (
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                {isRunning ? t('dashboard.log.empty') : t('dashboard.log.startGateway')}
              </span>
            ) : (
              logs.map((line, i) => {
                const level = logLevel(line)
                const time = parseLogTime(line)
                const text = stripLogMeta(line) || line
                return (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    {time && (
                      <span
                        style={{
                          color: 'rgba(255,255,255,0.2)',
                          flexShrink: 0,
                          userSelect: 'none',
                        }}
                      >
                        {time}
                      </span>
                    )}
                    <span style={{ color: LOG_COLORS[level], wordBreak: 'break-all' }}>{text}</span>
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div
            style={{
              minHeight: 40,
              borderRadius: 6,
              padding: '10px 12px',
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorFillTertiary,
              fontSize: 12,
              color: token.colorTextSecondary,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {latestLog
              ? stripLogMeta(latestLog)
              : isRunning
                ? t('dashboard.log.empty')
                : t('dashboard.log.startGateway')}
          </div>
        )}
      </div>

      <style>{`
        @keyframes ccPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}

export default DashboardPage
