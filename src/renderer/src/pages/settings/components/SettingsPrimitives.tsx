import { BRAND, BRAND_LIGHT, BORDER, TEXT_MUTED, TEXT_PRIMARY } from '../settings-page.constants'
import type { SectionProps, SettingRowProps } from '../settings-page.types'

export function SectionLabel({ label }: { label: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
      <span
        style={{
          display: 'block',
          width: 2,
          height: 13,
          borderRadius: 1,
          background: BRAND,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.11em',
          textTransform: 'uppercase',
          color: BRAND,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export function SettingRow({
  label,
  desc,
  control,
  last,
  highlight,
}: SettingRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 62,
        padding: '0 22px',
        borderBottom: last ? 'none' : `1px solid ${BORDER}`,
        background: highlight ? BRAND_LIGHT : 'transparent',
        transition: 'background 0.2s ease',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 28 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: TEXT_PRIMARY,
            lineHeight: 1.35,
          }}
        >
          {label}
        </div>
        {desc && (
          <div
            style={{
              fontSize: 11.5,
              color: TEXT_MUTED,
              marginTop: 3,
              lineHeight: 1.45,
              wordBreak: 'break-all',
            }}
          >
            {desc}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  )
}

export function Section({ title, children }: SectionProps): React.ReactElement {
  return (
    <div style={{ marginBottom: 40 }}>
      <SectionLabel label={title} />
      <div
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function SubGroupHeader({ label }: { label: string }): React.ReactElement {
  return (
    <div
      style={{
        padding: '7px 22px',
        background: '#f5f5f5',
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        fontSize: 11,
        fontWeight: 600,
        color: '#999',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}
    >
      {label}
    </div>
  )
}
