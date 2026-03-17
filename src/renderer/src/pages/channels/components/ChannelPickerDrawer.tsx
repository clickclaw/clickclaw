import { CheckCircleFilled } from '@ant-design/icons'
import { Drawer } from 'antd'
import { useTranslation } from 'react-i18next'
import { TITLE_BAR_HEIGHT } from '../../../components/TitleBar'
import type { ChannelPickerDrawerProps, ChannelPresetForUI } from '../channels-page.types'
import { ChannelMonogram } from './ChannelMonogram'

export function ChannelPickerDrawer({
  open,
  presets,
  configuredKeys,
  onSelect,
  onClose,
}: ChannelPickerDrawerProps): React.ReactElement {
  const { t } = useTranslation()

  const renderGroup = (list: ChannelPresetForUI[], label: string): React.ReactElement | null => {
    if (list.length === 0) return null
    return (
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#aaa',
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        {list.map((preset) => {
          const configured = configuredKeys.includes(preset.key)
          return (
            <div
              key={preset.key}
              onClick={() => onSelect(preset)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                background: '#fff',
                border: '1px solid #f0f0f0',
                marginBottom: 6,
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#fafafa'
                ;(e.currentTarget as HTMLElement).style.borderColor = '#e0e0e0'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = '#fff'
                ;(e.currentTarget as HTMLElement).style.borderColor = '#f0f0f0'
              }}
            >
              <ChannelMonogram
                channelKey={preset.key}
                initials={preset.initials}
                color={preset.color}
                size={40}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a' }}>{preset.name}</div>
                {preset.tagline && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>{preset.tagline}</div>
                )}
              </div>
              {configured && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#52c41a',
                    fontSize: 12,
                  }}
                >
                  <CheckCircleFilled style={{ fontSize: 13 }} />
                  <span>{t('channels.pickerDrawer.added')}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 4, height: 18, background: '#FF4D2A', borderRadius: 2 }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>{t('channels.pickerDrawer.title')}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={400}
      rootStyle={{ top: TITLE_BAR_HEIGHT }}
      styles={{ body: { paddingTop: 16 } }}
    >
      {renderGroup(presets.domestic, t('channels.domestic'))}
      {renderGroup(presets.international, t('channels.international'))}
    </Drawer>
  )
}
