import { getProviderLogo } from '../../../assets/brand-logos'
import type { ProviderAvatarByKeyProps, ProviderAvatarProps } from '../model-page.types'
import { getBrandByKey } from '../model-page.utils'

export function ProviderAvatar({
  providerKey,
  logoUrl,
  color,
  initials,
  size = 36,
}: ProviderAvatarProps): React.ReactElement {
  const resolvedLogoUrl = logoUrl || (providerKey ? getProviderLogo(providerKey) : undefined)
  if (resolvedLogoUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          background: '#fff',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <img
          src={resolvedLogoUrl}
          alt={initials}
          style={{ width: size - 8, height: size - 8, objectFit: 'contain', flexShrink: 0 }}
        />
      </div>
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        flexShrink: 0,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 700,
        fontSize: Math.round(size * 0.33),
        letterSpacing: '-0.03em',
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  )
}

export function ProviderAvatarByKey({
  providerKey,
  brands,
  size = 36,
}: ProviderAvatarByKeyProps): React.ReactElement {
  const brand = getBrandByKey(providerKey, brands)
  return (
    <ProviderAvatar
      providerKey={providerKey}
      logoUrl={brand?.logoUrl}
      color={brand?.color ?? '#6b7280'}
      initials={brand?.initials ?? providerKey.slice(0, 2).toUpperCase()}
      size={size}
    />
  )
}
