/**
 * CronFormDrawer — 创建/编辑定时任务表单 Drawer
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Radio,
  Switch,
  Button,
  Space,
} from 'antd'
import { useTranslation } from 'react-i18next'
import type { CronJob, CronFormValues } from '../../../stores/cronStore'
import { scheduleToForm } from '../../../stores/cronStore'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import dayjs from 'dayjs'

interface CronFormDrawerProps {
  open: boolean
  editJob: CronJob | null
  onClose: () => void
  onSave: (values: CronFormValues) => Promise<void>
  saving: boolean
}

const { TextArea } = Input

export default function CronFormDrawer({
  open,
  editJob,
  onClose,
  onSave,
  saving,
}: CronFormDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const [form] = Form.useForm<CronFormValues>()
  const scheduleKind = Form.useWatch('scheduleKind', form)
  const cronPreset = Form.useWatch('cronPreset', form)

  // Agent 选项列表
  const [agentOptions, setAgentOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  // Drawer 打开时加载 agents
  const loadAgents = useCallback(async (): Promise<void> => {
    setLoadingAgents(true)
    try {
      const list = (await window.api.agent.list()) as Array<{
        id: string
        name?: string
        identity?: { name?: string; emoji?: string }
        default?: boolean
      }>
      const opts = list.map((a) => {
        const displayName = a.identity?.name || a.name || a.id
        const emoji = a.identity?.emoji
        return {
          value: a.id,
          label: emoji ? `${emoji} ${displayName}` : displayName,
        }
      })
      setAgentOptions(opts)
    } catch {
      setAgentOptions([])
    } finally {
      setLoadingAgents(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadAgents()
      if (editJob) {
        const schedPart = scheduleToForm(editJob.schedule)
        form.setFieldsValue({
          name: editJob.name,
          description: editJob.description,
          message: editJob.payload?.message,
          agentId: editJob.payload?.agentId,
          enabled: editJob.enabled,
          ...schedPart,
          runAt: schedPart.runAt,
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          scheduleKind: 'interval',
          intervalAmount: 30,
          intervalUnit: 'minutes',
          cronPreset: 'daily9am',
          enabled: true,
        })
      }
    }
  }, [open, editJob, form, loadAgents])

  const handleSubmit = async (): Promise<void> => {
    const values = await form.validateFields()
    // DatePicker 通过 getValueFromEvent 已转为数值，此处做保险处理
    if (values.scheduleKind === 'once' && values.runAt) {
      if (typeof values.runAt !== 'number') {
        const d = values.runAt as unknown
        values.runAt =
          typeof (d as { valueOf?: () => number }).valueOf === 'function'
            ? (d as { valueOf: () => number }).valueOf()
            : Number(d)
      }
    }
    await onSave(values)
  }

  const title = editJob ? t('cron.form.editTitle') : t('cron.form.createTitle')

  const PRESET_OPTIONS = [
    { value: 'everyMinute', label: t('cron.form.presets.everyMinute') },
    { value: 'every5Min', label: t('cron.form.presets.every5Min') },
    { value: 'every15Min', label: t('cron.form.presets.every15Min') },
    { value: 'everyHour', label: t('cron.form.presets.everyHour') },
    { value: 'daily9am', label: t('cron.form.presets.daily9am') },
    { value: 'daily18pm', label: t('cron.form.presets.daily18pm') },
    { value: 'weeklyMonday', label: t('cron.form.presets.weeklyMonday') },
    { value: 'monthly1st', label: t('cron.form.presets.monthly1st') },
    { value: 'custom', label: t('cron.form.presets.custom') },
  ]

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      width={480}
      footer={
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" onClick={handleSubmit} loading={saving}>
            {t('common.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {/* 基本信息 */}
        <Form.Item
          label={t('cron.form.name')}
          name="name"
          rules={[{ required: true, message: t('cron.form.nameRequired') }]}
        >
          <Input placeholder={t('cron.form.namePlaceholder')} />
        </Form.Item>

        <Form.Item label={t('cron.form.description')} name="description">
          <Input placeholder={t('cron.form.descriptionPlaceholder')} />
        </Form.Item>

        {/* 调度方式 */}
        <Form.Item label={t('cron.form.scheduleType')} name="scheduleKind">
          <Radio.Group>
            <Radio.Button value="interval">{t('cron.form.interval')}</Radio.Button>
            <Radio.Button value="cron">{t('cron.form.cron')}</Radio.Button>
            <Radio.Button value="once">{t('cron.form.once')}</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* 间隔执行 */}
        {scheduleKind === 'interval' && (
          <Form.Item label={t('cron.form.every')} style={{ marginBottom: 16 }}>
            <Space>
              <Form.Item name="intervalAmount" noStyle rules={[{ required: true }]}>
                <InputNumber min={1} max={9999} style={{ width: 100 }} />
              </Form.Item>
              <Form.Item name="intervalUnit" noStyle>
                <Select style={{ width: 100 }}>
                  <Select.Option value="minutes">{t('cron.form.unit.minutes')}</Select.Option>
                  <Select.Option value="hours">{t('cron.form.unit.hours')}</Select.Option>
                  <Select.Option value="days">{t('cron.form.unit.days')}</Select.Option>
                </Select>
              </Form.Item>
            </Space>
          </Form.Item>
        )}

        {/* 定时执行 */}
        {scheduleKind === 'cron' && (
          <>
            <Form.Item label={t('cron.form.cronPreset')} name="cronPreset">
              <Select options={PRESET_OPTIONS} />
            </Form.Item>
            {cronPreset === 'custom' && (
              <Form.Item
                label={t('cron.form.cronExpr')}
                name="cronExpr"
                rules={[{ required: true, message: t('cron.form.cronExprRequired') }]}
              >
                <Input placeholder="0 9 * * *" style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            )}
          </>
        )}

        {/* 单次执行 */}
        {scheduleKind === 'once' && (
          <Form.Item
            label={t('cron.form.runAt')}
            name="runAt"
            rules={[{ required: true }]}
            getValueFromEvent={(d: dayjs.Dayjs | null) => d?.valueOf()}
            getValueProps={(v: number | undefined) => ({ value: v ? dayjs(v) : null })}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        )}

        {/* 执行内容 */}
        <Form.Item
          label={t('cron.form.message')}
          name="message"
          rules={[{ required: true, message: t('cron.form.messageRequired') }]}
        >
          <TextArea rows={4} placeholder={t('cron.form.messagePlaceholder')} />
        </Form.Item>

        {/* Agent 选择（下拉，留空=使用默认） */}
        <Form.Item label={t('cron.form.agentId')} name="agentId">
          <Select
            allowClear
            loading={loadingAgents}
            placeholder={t('cron.form.agentIdPlaceholder')}
            options={agentOptions}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        {/* 启用开关 */}
        <Form.Item label={t('cron.form.enableNow')} name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  )
}
