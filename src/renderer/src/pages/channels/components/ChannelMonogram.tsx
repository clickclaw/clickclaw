import { getChannelLogo } from '../../../assets/brand-logos'
import type { ChannelMonogramProps } from '../channels-page.types'

export function ChannelMonogram({
  channelKey,
  initials,
  color,
  size = 36,
}: ChannelMonogramProps): React.ReactElement {
  const logoUrl = channelKey ? getChannelLogo(channelKey) : undefined
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={initials}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.25,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: color + '18',
        border: `1.5px solid ${color}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: color,
        fontWeight: 800,
        fontSize: size * 0.34,
        letterSpacing: '-0.04em',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {initials}
    </div>
  )
}
