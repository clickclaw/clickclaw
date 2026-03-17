import { useState } from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { ModelDef, ModelTestState, ProviderCardProps } from '../model-page.types'
import { getBrandByKey, getPrimaryModelId } from '../model-page.utils'
import { ModelRow } from './ModelRow'
import { ProviderAvatarByKey } from './ProviderAvatar'

export function ProviderCard({
  entry,
  brands,
  defaultModel,
  onEdit,
  onDelete,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onSetPrimary,
  onFetchRemote,
}: ProviderCardProps): React.ReactElement {
  const { t } = useTranslation()
  const [testStates, setTestStates] = useState<Record<string, ModelTestState>>({})
  const [expanded, setExpanded] = useState(true)
  const brand = getBrandByKey(entry.key, brands)
  const primaryId = getPrimaryModelId(defaultModel, entry.key)
  const models = entry.config.models || []

  const handleTest = async (model: ModelDef) => {
    if (!entry.config.baseUrl || !entry.config.api) return
    setTestStates((p) => ({ ...p, [model.id]: { status: 'testing' } }))
    const start = Date.now()
    try {
      const res = (await window.api.model.test({
        baseUrl: entry.config.baseUrl,
        api: entry.config.api,
        apiKey: entry.config.apiKey || '',
        modelId: model.id,
      })) as { success: boolean; latencyMs?: number; message?: string; error?: string }
      const latencyMs = res.latencyMs ?? Date.now() - start
      setTestStates((p) => ({
        ...p,
        [model.id]: res.success
          ? { status: 'ok', latencyMs }
          : { status: 'fail', latencyMs, error: res.message || res.error },
      }))
    } catch (err) {
      setTestStates((p) => ({ ...p, [model.id]: { status: 'fail', error: String(err) } }))
    }
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #ebebeb',
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 16px',
          cursor: 'pointer',
          borderBottom: expanded && models.length > 0 ? '1px solid #f3f3f1' : 'none',
          userSelect: 'none',
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <ProviderAvatarByKey providerKey={entry.key} brands={brands} size={36} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>
              {brand?.name || entry.key}
            </span>
            <code
              style={{
                fontSize: 11,
                color: '#bbb',
                background: '#f8f8f8',
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              {entry.key}
            </code>
            {entry.config.api && (
              <span
                style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  padding: '1px 5px',
                  borderRadius: 4,
                }}
              >
                {entry.config.api}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
            {t('models.modelCount', { count: models.length })}
            {primaryId && (
              <>
                {' '}
                ·{' '}
                <span style={{ color: '#FF4D2A', fontWeight: 500 }}>
                  {t('models.primarySuffix', { id: primaryId })}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('models.editProvider')}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(entry)}
              style={{ color: '#9ca3af' }}
            />
          </Tooltip>
          <Popconfirm
            title={t('models.deleteProviderTitle', { key: entry.key })}
            description={t('models.deleteProviderDesc')}
            onConfirm={() => onDelete(entry.key)}
            okType="danger"
            placement="topLeft"
          >
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              style={{ color: '#fca5a5' }}
            />
          </Popconfirm>
        </div>

        <div
          style={{
            fontSize: 13,
            color: '#ccc',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'none',
            userSelect: 'none',
          }}
        >
          ›
        </div>
      </div>

      {expanded && (
        <>
          {models.length === 0 ? (
            <div style={{ padding: '14px 16px', color: '#bbb', fontSize: 13 }}>
              {t('models.noModels')}
            </div>
          ) : (
            <div>
              {models.map((m, i) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  index={i}
                  isPrimary={primaryId === m.id}
                  testState={testStates[m.id] || { status: 'idle' }}
                  onSetPrimary={() => onSetPrimary(entry.key, m.id)}
                  onTest={() => handleTest(m)}
                  onEdit={() => onEditModel(entry.key, m)}
                  onDelete={() => onDeleteModel(entry.key, m.id)}
                />
              ))}
            </div>
          )}

          <div
            style={{
              padding: '10px 14px',
              display: 'flex',
              gap: 8,
              borderTop: '1px solid #f3f3f1',
            }}
          >
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => onAddModel(entry.key)}
              style={{ fontSize: 12, color: '#555', border: '1px solid #e5e7eb' }}
            >
              {t('models.addModel')}
            </Button>
            {entry.config.baseUrl && (
              <Button
                size="small"
                icon={<UnorderedListOutlined />}
                onClick={() => onFetchRemote(entry.key)}
                style={{ fontSize: 12, color: '#555', border: '1px solid #e5e7eb' }}
              >
                {t('models.fetchFromApi')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
