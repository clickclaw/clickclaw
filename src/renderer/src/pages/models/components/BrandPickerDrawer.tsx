import { Drawer } from 'antd'
import { RightOutlined, SettingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import type { BrandPickerDrawerProps, DisplayBrand, DisplayBrandSection } from '../model-page.types'
import { ProviderAvatar } from './ProviderAvatar'

export function BrandPickerDrawer({
  open,
  sections,
  configuredKeys,
  onSelect,
  onClose,
}: BrandPickerDrawerProps): React.ReactElement {
  const { t } = useTranslation()

  const getSectionLabel = (key: DisplayBrandSection['key']): string => {
    if (key === 'recommended') return t('models.recommended')
    if (key === 'international') return t('models.international')
    return t('models.domestic')
  }

  const renderRow = (brand: DisplayBrand, sectionKey: DisplayBrandSection['key']) => {
    const isAdded = brand.allKeys.some((k) => configuredKeys.includes(k))
    return (
      <div
        key={brand.key}
        onClick={() => onSelect(brand)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'background 0.12s',
          marginBottom: 2,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f3')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <ProviderAvatar
          providerKey={brand.key}
          logoUrl={brand.logoUrl}
          color={brand.color}
          initials={brand.initials}
          size={36}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{brand.name}</span>
            {sectionKey === 'recommended' && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#d9480f',
                  background: '#fff7e6',
                  border: '1px solid #ffd591',
                  padding: '1px 6px',
                  borderRadius: 999,
                }}
              >
                {t('models.recommended')}
              </span>
            )}
            {isAdded && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#16a34a',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {t('models.added')}
              </span>
            )}
          </div>
          {brand.tagline && (
            <div
              style={{
                fontSize: 12,
                color: '#888',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {brand.tagline}
            </div>
          )}
        </div>
        <RightOutlined style={{ fontSize: 11, color: '#ccc', flexShrink: 0 }} />
      </div>
    )
  }

  const sectionLabel = (text: string) => (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#bbb',
        textTransform: 'uppercase',
        padding: '4px 16px 6px',
        marginTop: 8,
      }}
    >
      {text}
    </div>
  )

  return (
    <Drawer
      title={<span style={{ fontWeight: 700 }}>{t('models.brandPickerTitle')}</span>}
      placement="right"
      open={open}
      onClose={onClose}
      width={380}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      styles={{ body: { padding: '8px 0' } }}
    >
      {sections.map((section, index) => (
        <div key={section.key}>
          {sectionLabel(getSectionLabel(section.key))}
          {section.items.map((brand) => renderRow(brand, section.key))}
          {index < sections.length - 1 && (
            <div style={{ height: 1, background: '#f0f0f0', margin: '12px 16px' }} />
          )}
        </div>
      ))}

      {sections.length > 0 && (
        <div style={{ height: 1, background: '#f0f0f0', margin: '12px 16px' }} />
      )}

      <div
        onClick={() => onSelect('custom')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'background 0.12s',
          margin: '0 0 4px',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f3')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SettingOutlined style={{ color: '#888', fontSize: 16 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#444' }}>
            {t('models.customProvider')}
          </div>
          <div style={{ fontSize: 12, color: '#aaa' }}>{t('models.customTagline')}</div>
        </div>
        <RightOutlined style={{ fontSize: 11, color: '#ccc' }} />
      </div>
    </Drawer>
  )
}
