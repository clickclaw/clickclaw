import { Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { EmptyStateProps } from '../model-page.types'
import { ProviderAvatar } from './ProviderAvatar'

export function EmptyState({ brands, onCreate }: EmptyStateProps): React.ReactElement {
  const { t } = useTranslation()
  const showcaseBrands = brands.slice(0, 3)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {showcaseBrands.map((b) => (
          <ProviderAvatar
            key={b.key}
            providerKey={b.key}
            logoUrl={b.logoUrl}
            color={b.color}
            initials={b.initials}
            size={40}
          />
        ))}
      </div>
      <Typography.Title level={5} style={{ margin: '0 0 8px', color: '#111', fontWeight: 700 }}>
        {t('models.emptyTitle')}
      </Typography.Title>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 13, marginBottom: 24, display: 'block', maxWidth: 280 }}
      >
        {t('models.emptyHint')}
      </Typography.Text>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        size="large"
        onClick={onCreate}
        style={{ background: '#FF4D2A', borderColor: '#FF4D2A', fontWeight: 600 }}
      >
        {t('models.addFirstProvider')}
      </Button>
    </div>
  )
}
