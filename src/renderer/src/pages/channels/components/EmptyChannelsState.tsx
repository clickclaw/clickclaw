import { Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { EmptyChannelsStateProps } from '../channels-page.types'
import { ChannelMonogram } from './ChannelMonogram'

export function EmptyChannelsState({
  onAdd,
  presets,
}: EmptyChannelsStateProps): React.ReactElement {
  const { t } = useTranslation()
  const showcase = presets.slice(0, 5)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      {showcase.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {showcase.map((p) => (
            <ChannelMonogram
              key={p.key}
              channelKey={p.key}
              initials={p.initials}
              color={p.color}
              size={44}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#FF4D2A0D',
            border: '1.5px dashed #FF4D2A55',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            marginBottom: 20,
          }}
        >
          💬
        </div>
      )}
      <Typography.Title level={5} style={{ margin: '0 0 6px', color: '#1a1a1a', fontWeight: 600 }}>
        {t('channels.noChannels')}
      </Typography.Title>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 13, marginBottom: 20, display: 'block', maxWidth: 280 }}
      >
        {t('channels.noChannelsHint')}
      </Typography.Text>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onAdd}
        style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
      >
        {t('channels.addChannel')}
      </Button>
    </div>
  )
}
