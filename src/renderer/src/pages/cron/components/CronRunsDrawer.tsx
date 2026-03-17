/**
 * CronRunsDrawer — 任务运行历史 Drawer
 */

import { useEffect, useState } from 'react'
import { Drawer, Table, Tag, Typography, Spin } from 'antd'
import { CheckCircleFilled, CloseCircleFilled, MinusCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { CronJob, CronRun } from '../../../stores/cronStore'
import { useCronStore } from '../../../stores/cronStore'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'

const { Text } = Typography

interface CronRunsDrawerProps {
  open: boolean
  job: CronJob | null
  callRpc: (method: string, params: unknown) => Promise<unknown>
  onClose: () => void
}

const PAGE_SIZE = 20

function StatusCell({
  status,
  t,
}: {
  status: CronRun['status']
  t: (k: string) => string
}): React.ReactElement {
  if (status === 'ok')
    return (
      <Tag icon={<CheckCircleFilled />} color="success">
        {t('cron.runs.statusOk')}
      </Tag>
    )
  if (status === 'error')
    return (
      <Tag icon={<CloseCircleFilled />} color="error">
        {t('cron.runs.statusError')}
      </Tag>
    )
  return (
    <Tag icon={<MinusCircleOutlined />} color="warning">
      {t('cron.runs.statusSkipped')}
    </Tag>
  )
}

export default function CronRunsDrawer({
  open,
  job,
  callRpc,
  onClose,
}: CronRunsDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const fetchRuns = useCronStore((s) => s.fetchRuns)

  const [runs, setRuns] = useState<CronRun[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !job) return
    setPage(1)
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job?.id])

  const load = async (p: number): Promise<void> => {
    if (!job) return
    setLoading(true)
    try {
      const result = await fetchRuns(callRpc, job.id, {
        limit: PAGE_SIZE,
        offset: (p - 1) * PAGE_SIZE,
      })
      setRuns(result.runs)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: t('cron.runs.time'),
      dataIndex: 'runAtMs',
      key: 'runAtMs',
      render: (v: number) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      title: t('cron.runs.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: CronRun['status']) => <StatusCell status={v} t={t} />,
    },
    {
      title: t('cron.runs.duration'),
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (v?: number) => (v != null ? `${(v / 1000).toFixed(1)}s` : '—'),
    },
    {
      title: t('cron.runs.summary'),
      dataIndex: 'summary',
      key: 'summary',
      render: (v?: string) =>
        v ? (
          <Text type="secondary" ellipsis style={{ maxWidth: 260, fontSize: 12 }}>
            {v}
          </Text>
        ) : (
          '—'
        ),
    },
  ]

  return (
    <Drawer
      title={job ? `${t('cron.runs.title')} — ${job.name}` : t('cron.runs.title')}
      open={open}
      onClose={onClose}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      width={640}
    >
      <Spin spinning={loading}>
        <Table
          dataSource={runs}
          columns={columns}
          rowKey={(r) => String(r.ts)}
          size="small"
          pagination={{
            current: page,
            total,
            pageSize: PAGE_SIZE,
            onChange: (p) => {
              setPage(p)
              load(p)
            },
          }}
        />
      </Spin>
    </Drawer>
  )
}
