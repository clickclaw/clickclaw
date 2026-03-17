import { useTranslation } from 'react-i18next'
import type { DefaultModelBannerProps } from '../model-page.types'
import { getBrandByKey } from '../model-page.utils'
import { ProviderAvatarByKey } from './ProviderAvatar'

export function DefaultModelBanner({
  defaultModel,
  brands,
}: DefaultModelBannerProps): React.ReactElement | null {
  const { t } = useTranslation()
  if (!defaultModel) return null

  const primary = typeof defaultModel === 'string' ? defaultModel : defaultModel.primary
  const fallbacks = typeof defaultModel === 'object' ? defaultModel.fallbacks || [] : []
  const providerKey = primary.split('/')[0]
  const brand = getBrandByKey(providerKey, brands)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        marginBottom: 16,
        borderRadius: 8,
        background: '#fff',
        border: '1px solid #ebebeb',
        borderLeft: `3px solid ${brand?.color ?? '#FF4D2A'}`,
      }}
    >
      <ProviderAvatarByKey providerKey={providerKey} brands={brands} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#aaa',
            letterSpacing: '0.06em',
            marginBottom: 1,
          }}
        >
          {t('models.currentPrimary')}
        </div>
        <code
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#111',
            fontFamily: '"SF Mono", monospace',
          }}
        >
          {primary}
        </code>
        {fallbacks.length > 0 && (
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>
            {t('models.fallbackPreview', {
              text:
                fallbacks.slice(0, 2).join(' · ') +
                (fallbacks.length > 2 ? ` +${fallbacks.length - 2}` : ''),
            })}
          </div>
        )}
      </div>
    </div>
  )
}
