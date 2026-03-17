/**
 * cronStore — 定时任务 Zustand Store
 *
 * callRpc 以参数形式传入，Store 不直接依赖 React Context。
 */

import { create } from 'zustand'

// ========== 类型定义 ==========

export type ScheduleKind = 'interval' | 'cron' | 'once'

export interface CronJob {
  id: string
  agentId?: string
  sessionKey?: string
  name: string
  description?: string
  enabled: boolean
  createdAtMs?: number
  updatedAtMs?: number
  schedule: {
    kind: 'every' | 'cron' | 'at'
    everyMs?: number
    expr?: string
    at?: string
    tz?: string
  }
  sessionTarget?: 'main' | 'isolated'
  wakeMode?: string
  payload: {
    kind: 'agentTurn' | 'systemEvent'
    message?: string // agentTurn
    text?: string // systemEvent
    agentId?: string
  }
  // 运行状态嵌套在 state 字段（实际 API 格式）
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastRunStatus?: 'ok' | 'error' | 'skipped'
    lastStatus?: string
    lastDurationMs?: number
    lastDeliveryStatus?: string
    consecutiveErrors?: number
  }
  // 兼容旧版扁平字段
  lastRun?: {
    status: 'ok' | 'error' | 'skipped'
    startedAt: number
    durationMs?: number
    error?: string
  }
  lastRunAt?: number
  lastRunStatus?: 'ok' | 'error' | 'skipped'
  nextRunAt?: number
  nextRunAtMs?: number
  createdAt?: number
}

export interface CronRun {
  ts: number // 记录时间戳，用作唯一 key
  jobId: string
  action?: string // 'finished' | 'started' 等
  status: 'ok' | 'error' | 'skipped'
  summary?: string // AI 运行摘要
  runAtMs: number // 实际运行开始时间（ms）
  durationMs?: number
  nextRunAtMs?: number // 本次运行完成后的下次计划时间
  deliveryStatus?: string
}

/** 表单值（面向用户的简化结构） */
export interface CronFormValues {
  name: string
  description?: string
  scheduleKind: ScheduleKind
  // interval
  intervalAmount?: number
  intervalUnit?: 'minutes' | 'hours' | 'days'
  // cron
  cronPreset?: string
  cronExpr?: string
  // once
  runAt?: number // timestamp ms
  message: string
  agentId?: string
  enabled: boolean
}

type CallRpc = (method: string, params: unknown) => Promise<unknown>

// ========== 表单 → API 转换 ==========

export function formToSchedule(values: CronFormValues): CronJob['schedule'] {
  if (values.scheduleKind === 'interval') {
    const amount = values.intervalAmount ?? 30
    const unit = values.intervalUnit ?? 'minutes'
    const multiplier = unit === 'minutes' ? 60_000 : unit === 'hours' ? 3_600_000 : 86_400_000
    return { kind: 'every', everyMs: amount * multiplier }
  }
  if (values.scheduleKind === 'cron') {
    const expr =
      values.cronPreset === 'custom' || !values.cronPreset
        ? (values.cronExpr ?? '0 9 * * *')
        : (CRON_PRESETS[values.cronPreset] ?? values.cronExpr ?? '0 9 * * *')
    return { kind: 'cron', expr }
  }
  // once
  return { kind: 'at', at: new Date(values.runAt ?? Date.now()).toISOString() }
}

export const CRON_PRESETS: Record<string, string> = {
  everyMinute: '* * * * *',
  every5Min: '*/5 * * * *',
  every15Min: '*/15 * * * *',
  everyHour: '0 * * * *',
  daily9am: '0 9 * * *',
  daily18pm: '0 18 * * *',
  weeklyMonday: '0 9 * * 1',
  monthly1st: '0 9 1 * *',
}

// ========== Schedule → 表单回填 ==========

export function scheduleToForm(schedule: CronJob['schedule']): Partial<CronFormValues> {
  if (schedule.kind === 'every') {
    const ms = schedule.everyMs ?? 1_800_000
    if (ms % 86_400_000 === 0)
      return {
        scheduleKind: 'interval',
        intervalAmount: ms / 86_400_000,
        intervalUnit: 'days',
      }
    if (ms % 3_600_000 === 0)
      return {
        scheduleKind: 'interval',
        intervalAmount: ms / 3_600_000,
        intervalUnit: 'hours',
      }
    return {
      scheduleKind: 'interval',
      intervalAmount: ms / 60_000,
      intervalUnit: 'minutes',
    }
  }
  if (schedule.kind === 'cron') {
    const expr = schedule.expr ?? ''
    const preset = Object.entries(CRON_PRESETS).find(([, v]) => v === expr)?.[0]
    return {
      scheduleKind: 'cron',
      cronPreset: preset ?? 'custom',
      cronExpr: expr,
    }
  }
  // at
  return {
    scheduleKind: 'once',
    runAt: schedule.at ? new Date(schedule.at).getTime() : Date.now(),
  }
}

// ========== Store ==========

interface CronStore {
  jobs: CronJob[]
  loading: boolean
  error: string | null

  fetchAll: (callRpc: CallRpc) => Promise<void>
  createJob: (callRpc: CallRpc, form: CronFormValues) => Promise<void>
  updateJob: (callRpc: CallRpc, id: string, form: CronFormValues) => Promise<void>
  toggleJob: (callRpc: CallRpc, id: string, enabled: boolean) => Promise<void>
  triggerJob: (callRpc: CallRpc, id: string) => Promise<string>
  deleteJob: (callRpc: CallRpc, id: string) => Promise<void>
  fetchRuns: (
    callRpc: CallRpc,
    jobId: string,
    opts?: { limit?: number; offset?: number }
  ) => Promise<{ runs: CronRun[]; total: number }>
}

export const useCronStore = create<CronStore>((set) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchAll: async (callRpc) => {
    set({ loading: true, error: null })
    try {
      const result = (await callRpc('cron.list', { limit: 100, offset: 0 })) as {
        jobs: CronJob[]
      }
      set({ jobs: result.jobs ?? [], loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  createJob: async (callRpc, form) => {
    const schedule = formToSchedule(form)
    await callRpc('cron.add', {
      name: form.name,
      description: form.description,
      schedule,
      payload: {
        kind: 'agentTurn',
        message: form.message,
        ...(form.agentId ? { agentId: form.agentId } : {}),
      },
      enabled: form.enabled,
    })
    // 刷新列表
    const result = (await callRpc('cron.list', { limit: 100, offset: 0 })) as {
      jobs: CronJob[]
    }
    set({ jobs: result.jobs ?? [] })
  },

  updateJob: async (callRpc, id, form) => {
    const schedule = formToSchedule(form)
    await callRpc('cron.update', {
      id,
      patch: {
        name: form.name,
        description: form.description,
        schedule,
        payload: {
          kind: 'agentTurn',
          message: form.message,
          ...(form.agentId ? { agentId: form.agentId } : {}),
        },
        enabled: form.enabled,
      },
    })
    const result = (await callRpc('cron.list', { limit: 100, offset: 0 })) as {
      jobs: CronJob[]
    }
    set({ jobs: result.jobs ?? [] })
  },

  toggleJob: async (callRpc, id, enabled) => {
    await callRpc('cron.update', { id, patch: { enabled } })
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? { ...j, enabled } : j)),
    }))
  },

  triggerJob: async (callRpc, id) => {
    const result = (await callRpc('cron.run', { id, mode: 'force' })) as { runId?: string }
    return result.runId ?? ''
  },

  deleteJob: async (callRpc, id) => {
    await callRpc('cron.remove', { id })
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) }))
  },

  fetchRuns: async (callRpc, jobId, opts = {}) => {
    const result = (await callRpc('cron.runs', {
      scope: 'job',
      id: jobId,
      limit: opts.limit ?? 20,
      offset: opts.offset ?? 0,
    })) as { entries: CronRun[]; total: number }
    // API 返回 entries（不是 runs），total 在顶层
    return { runs: result.entries ?? [], total: result.total ?? 0 }
  },
}))
