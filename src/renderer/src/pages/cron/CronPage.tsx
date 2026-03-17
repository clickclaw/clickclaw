/**
 * CronPage — 定时任务管理主页面
 *
 * 布局：统计栏 + 搜索 + 任务卡片网格
 */

import { useEffect, useState, useCallback } from 'react'
import { Row, Col, Button, Input, Statistic, Card, Empty, App, Alert, Spin, Space } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useGatewayContext } from '../../contexts/GatewayContext'
import { useCronStore } from '../../stores/cronStore'
import type { CronJob, CronFormValues } from '../../stores/cronStore'
import CronJobCard from './components/CronJobCard'
import CronFormDrawer from './components/CronFormDrawer'
import CronRunsDrawer from './components/CronRunsDrawer'
import PageHeader from '../../components/PageHeader'
import { TITLE_BAR_HEIGHT } from '../../components/TitleBar'

export default function CronPage(): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { callRpc, status, gwState } = useGatewayContext()

  const { jobs, loading, fetchAll, createJob, updateJob, toggleJob, triggerJob, deleteJob } =
    useCronStore()

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editJob, setEditJob] = useState<CronJob | null>(null)
  const [saving, setSaving] = useState(false)
  const [runsOpen, setRunsOpen] = useState(false)
  const [runsJob, setRunsJob] = useState<CronJob | null>(null)

  const gatewayRunning = gwState === 'running' && status === 'ready'

  const load = useCallback(async () => {
    if (!gatewayRunning) return
    await fetchAll(callRpc)
  }, [gatewayRunning, fetchAll, callRpc])

  useEffect(() => {
    load()
  }, [load])

  // 过滤
  const filtered = jobs.filter(
    (j) =>
      !search ||
      j.name.toLowerCase().includes(search.toLowerCase()) ||
      j.payload?.message?.toLowerCase().includes(search.toLowerCase())
  )

  // 统计
  const activeCount = jobs.filter((j) => j.enabled).length
  const failedCount = jobs.filter((j) => j.lastRun?.status === 'error').length

  const handleSave = async (values: CronFormValues): Promise<void> => {
    setSaving(true)
    try {
      if (editJob) {
        await updateJob(callRpc, editJob.id, values)
        message.success(t('cron.toast.updated'))
      } else {
        await createJob(callRpc, values)
        message.success(t('cron.toast.created'))
      }
      setFormOpen(false)
      setEditJob(null)
    } catch (e) {
      message.error(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean): Promise<void> => {
    try {
      await toggleJob(callRpc, id, enabled)
      message.success(enabled ? t('cron.toast.enabled') : t('cron.toast.paused'))
    } catch (e) {
      message.error(String(e))
    }
  }

  const handleRun = async (id: string): Promise<void> => {
    try {
      await triggerJob(callRpc, id)
      message.success(t('cron.toast.triggered'))
    } catch (e) {
      message.error(t('cron.toast.triggerFailed', { error: String(e) }))
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteJob(callRpc, id)
      message.success(t('cron.toast.deleted'))
    } catch (e) {
      message.error(String(e))
    }
  }

  const openEdit = (job: CronJob): void => {
    setEditJob(job)
    setFormOpen(true)
  }

  const openHistory = (job: CronJob): void => {
    setRunsJob(job)
    setRunsOpen(true)
  }

  const PAGE_H = `calc(100vh - ${TITLE_BAR_HEIGHT}px)`

  return (
    <div style={{ height: PAGE_H, overflow: 'auto', padding: '24px 28px' }}>
      <PageHeader
        title={t('cron.title')}
        subtitle={t('cron.subtitle')}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
              disabled={!gatewayRunning}
            >
              {t('cron.refresh')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditJob(null)
                setFormOpen(true)
              }}
              disabled={!gatewayRunning}
            >
              {t('cron.newJob')}
            </Button>
          </Space>
        }
      />

      {/* 网关警告 */}
      {!gatewayRunning && (
        <Alert
          type="warning"
          showIcon
          message={t('cron.gatewayWarning')}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 统计栏 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title={t('cron.stats.total')} value={jobs.length} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title={t('cron.stats.active')}
              value={activeCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title={t('cron.stats.failed')}
              value={failedCount}
              valueStyle={failedCount > 0 ? { color: '#ff4d4f' } : undefined}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索 */}
      <Input.Search
        placeholder={t('cron.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, maxWidth: 400 }}
        allowClear
      />

      {/* 列表 */}
      <Spin spinning={loading}>
        {filtered.length === 0 && !loading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                {t('cron.empty.title')}
                <br />
                <Button
                  type="link"
                  onClick={() => {
                    setEditJob(null)
                    setFormOpen(true)
                  }}
                  disabled={!gatewayRunning}
                >
                  {t('cron.empty.create')}
                </Button>
              </span>
            }
          />
        ) : (
          <Row gutter={[16, 16]}>
            {filtered.map((job) => (
              <Col key={job.id} xs={24} md={12} xl={8}>
                <CronJobCard
                  job={job}
                  onToggle={handleToggle}
                  onEdit={openEdit}
                  onHistory={openHistory}
                  onRun={handleRun}
                  onDelete={handleDelete}
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* 新建/编辑 Drawer */}
      <CronFormDrawer
        open={formOpen}
        editJob={editJob}
        onClose={() => {
          setFormOpen(false)
          setEditJob(null)
        }}
        onSave={handleSave}
        saving={saving}
      />

      {/* 运行历史 Drawer */}
      <CronRunsDrawer
        open={runsOpen}
        job={runsJob}
        callRpc={callRpc}
        onClose={() => {
          setRunsOpen(false)
          setRunsJob(null)
        }}
      />
    </div>
  )
}
