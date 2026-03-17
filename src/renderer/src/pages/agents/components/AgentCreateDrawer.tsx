import { useEffect, useState } from 'react'
import { AutoComplete, Button, Checkbox, Drawer, Form, Input, Select, Space, Tooltip } from 'antd'
import type { DefaultOptionType } from 'antd/es/select'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import type { AgentCreateDrawerProps, AgentFormValues } from '../agents-page.types'
import { TOOLS_PROFILE_OPTIONS } from '../agents-page.utils'

export function AgentCreateDrawer({
  open,
  onClose,
  onCreate,
  saving,
}: AgentCreateDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const [form] = Form.useForm<AgentFormValues>()
  const [modelOptions, setModelOptions] = useState<
    { label: React.ReactNode; options: { value: string; label: string }[] }[]
  >([])

  useEffect(() => {
    if (open) {
      form.resetFields()
      window.api.model
        .getPresetModels()
        .then((groups) => {
          setModelOptions(
            groups
              .filter((g) => g.models.length > 0)
              .map((g) => ({
                label: (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: g.color,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {g.providerName.toUpperCase()}
                  </span>
                ),
                options: g.models.map((m) => ({
                  value: `${g.providerKey}/${m.id}`,
                  label: `${g.providerKey}/${m.id}`,
                })),
              }))
          )
        })
        .catch(() => setModelOptions([]))
    }
  }, [open, form])

  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      await onCreate(values)
    } catch {
      // validateFields 错误由 Form 自行展示
    }
  }

  return (
    <Drawer
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 4, height: 18, background: '#FF4D2A', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>
            {t('agents.form.title', { mode: t('agents.form.createMode') })}
          </span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={480}
      styles={{ body: { paddingTop: 12 } }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={saving}
            onClick={handleSubmit}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
          >
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          label={
            <Space size={4}>
              <span style={{ fontWeight: 500 }}>{t('agents.form.name')}</span>
              <Tooltip title={t('agents.form.nameHint')}>
                <InfoCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
              </Tooltip>
            </Space>
          }
          name="id"
          rules={[
            { required: true, message: t('agents.form.nameRequired') },
            { pattern: /^[a-zA-Z0-9-]+$/, message: '只能使用字母、数字和连字符' },
          ]}
        >
          <Input placeholder={t('agents.form.namePlaceholder')} />
        </Form.Item>

        <div style={{ display: 'flex', gap: 10 }}>
          <Form.Item
            label={t('agents.form.emoji')}
            name="emoji"
            style={{ width: 80, flexShrink: 0 }}
          >
            <Input placeholder="🤖" maxLength={4} style={{ textAlign: 'center', fontSize: 18 }} />
          </Form.Item>
          <Form.Item label={t('agents.form.displayName')} name="displayName" style={{ flex: 1 }}>
            <Input placeholder={t('agents.form.displayNamePlaceholder')} />
          </Form.Item>
        </div>

        <Form.Item
          label={
            <Space size={4}>
              <span style={{ fontWeight: 500 }}>{t('agents.form.theme')}</span>
              <Tooltip title={t('agents.form.themeHint')}>
                <InfoCircleOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
              </Tooltip>
            </Space>
          }
          name="theme"
        >
          <Input placeholder={t('agents.form.themePlaceholder')} />
        </Form.Item>

        <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0 16px' }} />

        <Form.Item
          label={t('agents.form.model')}
          name="model"
          extra={
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>{t('agents.form.modelHint')}</span>
          }
        >
          {modelOptions.length > 0 ? (
            <AutoComplete
              options={modelOptions}
              placeholder={t('agents.form.modelPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
              filterOption={(input, option) =>
                String((option as DefaultOptionType | undefined)?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          ) : (
            <Input
              placeholder={t('agents.form.modelPlaceholder')}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          )}
        </Form.Item>

        <Form.Item
          label={t('agents.form.toolsProfile')}
          name="toolsProfile"
          extra={
            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
              {t('agents.form.toolsProfileHint')}
            </span>
          }
        >
          <Select
            allowClear
            placeholder={t('agents.form.toolsProfileCoding')}
            options={TOOLS_PROFILE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          />
        </Form.Item>

        <Form.Item name="setAsDefault" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>
            <span style={{ fontWeight: 500 }}>{t('agents.form.setAsDefault')}</span>
          </Checkbox>
        </Form.Item>
      </Form>
    </Drawer>
  )
}
