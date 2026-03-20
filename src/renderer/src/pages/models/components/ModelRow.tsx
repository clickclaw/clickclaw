import { useState } from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  StarFilled,
  StarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { ModelRowProps } from '../model-page.types'
import { latencyColor } from '../model-page.utils'

export function ModelRow({
  model,
  index,
  isPrimary,
  testState,
  onSetPrimary,
  onTest,
  onEdit,
  onDelete,
}: ModelRowProps): React.ReactElement {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  const supportsImage = model.input?.includes('image')

  const statusNode = () => {
    if (testState.status === 'testing') {
      return <span style={{ fontSize: 11, color: '#aaa' }}>{t('models.testing')}</span>
    }
    if (testState.status === 'ok' && testState.latencyMs !== undefined) {
      return (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: latencyColor(testState.latencyMs),
          }}
        >
          {testState.latencyMs}ms
        </span>
      )
    }
    if (testState.status === 'fail') {
      return (
        <Tooltip title={testState.error}>
          <span style={{ fontSize: 11, color: '#dc2626', cursor: 'default' }}>
            {t('models.testFailed')}
          </span>
        </Tooltip>
      )
    }
    return <span style={{ fontSize: 11, color: '#e5e7eb' }}>—</span>
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px 8px 14px',
        background: hovered ? '#f9f8f6' : index % 2 === 0 ? '#fff' : '#fdfcfb',
        transition: 'background 0.1s',
        borderBottom: '1px solid #f3f3f1',
      }}
    >
      <div style={{ width: 44, textAlign: 'right', flexShrink: 0 }}>{statusNode()}</div>
      <div style={{ width: 16, flexShrink: 0 }}>
        {isPrimary ? (
          <Tooltip title={t('models.currentPrimary')}>
            <span>
              <StarFilled style={{ color: '#FF4D2A', fontSize: 12 }} />
            </span>
          </Tooltip>
        ) : (
          <Tooltip title={t('models.setPrimary')}>
            <StarOutlined
              style={{
                color: hovered ? '#ddd' : 'transparent',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'color 0.1s',
              }}
              onClick={onSetPrimary}
            />
          </Tooltip>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <code
          style={{
            fontSize: 13,
            fontWeight: isPrimary ? 700 : 400,
            color: isPrimary ? '#FF4D2A' : '#222',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: '"SF Mono", "Fira Code", monospace',
          }}
        >
          {model.id}
        </code>
        {model.name && model.name !== model.id && (
          <span style={{ fontSize: 12, color: '#aaa', flexShrink: 0 }}>{model.name}</span>
        )}
        {supportsImage && (
          <span
            style={{
              fontSize: 10,
              color: '#7c3aed',
              background: '#f5f3ff',
              padding: '1px 5px',
              borderRadius: 3,
              flexShrink: 0,
            }}
          >
            {t('models.imageTag')}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 0,
          flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      >
        <Tooltip title={t('models.testConnect')}>
          <Button
            type="text"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={onTest}
            loading={testState.status === 'testing'}
            style={{ color: '#9ca3af' }}
          />
        </Tooltip>
        <Tooltip title={t('common.edit')}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={onEdit}
            style={{ color: '#9ca3af' }}
          />
        </Tooltip>
        <Popconfirm
          title={t('models.deleteModelTitle', { id: model.id })}
          onConfirm={onDelete}
          okType="danger"
          placement="topRight"
        >
          <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#fca5a5' }} />
        </Popconfirm>
      </div>
    </div>
  )
}
