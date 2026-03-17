import { useEffect } from 'react'
import { Button, Checkbox, Drawer, Form, Input } from 'antd'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import type { ModelDrawerProps } from '../model-page.types'
import { ProviderAvatarByKey } from './ProviderAvatar'

export function ModelDrawer({
  open,
  providerKey,
  brands,
  editingModel,
  onClose,
  onSave,
  saving,
}: ModelDrawerProps): React.ReactElement {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const isEdit = !!editingModel

  useEffect(() => {
    if (!open) return
    if (editingModel) {
      form.setFieldsValue({
        id: editingModel.id,
        name: editingModel.name || '',
        supportsImage: editingModel.input?.includes('image') || false,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ supportsImage: false })
    }
  }, [open, editingModel, form])

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      await onSave(providerKey, {
        id: editingModel?.id || v.id,
        name: v.name || v.id,
        input: v.supportsImage ? ['text', 'image'] : ['text'],
      })
    } catch {
      // 验证失败
    }
  }

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProviderAvatarByKey providerKey={providerKey} brands={brands} size={24} />
          <span style={{ fontWeight: 700 }}>
            {isEdit
              ? t('models.modelForm.title', { mode: t('models.modelForm.editMode') })
              : t('models.modelForm.title', { mode: t('models.modelForm.createMode') })}
          </span>
          <code
            style={{
              fontSize: 11,
              color: '#aaa',
              background: '#f5f5f5',
              padding: '1px 6px',
              borderRadius: 4,
            }}
          >
            {providerKey}
          </code>
        </div>
      }
      open={open}
      onClose={onClose}
      width={380}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
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
      <Form form={form} layout="vertical" requiredMark={false} style={{ paddingTop: 8 }}>
        <Form.Item
          label={t('models.modelId')}
          name="id"
          rules={[{ required: true, message: t('models.modelIdRequired') }]}
        >
          <Input
            placeholder={t('models.modelIdPlaceholder')}
            disabled={isEdit}
            style={
              isEdit
                ? { fontFamily: 'monospace', background: '#fafafa' }
                : { fontFamily: 'monospace' }
            }
          />
        </Form.Item>
        <Form.Item label={t('models.modelNameOptional')} name="name">
          <Input placeholder={t('models.modelNamePlaceholder')} />
        </Form.Item>
        <Form.Item name="supportsImage" valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>{t('models.supportsImageMulti')}</Checkbox>
        </Form.Item>
      </Form>
    </Drawer>
  )
}
