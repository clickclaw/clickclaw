import { Button } from 'antd'
import { DisconnectOutlined, LoadingOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

export function StatusBar({
  status,
  errorMsg,
  onReconnect,
}: {
  status: string
  errorMsg: string | null
  onReconnect: () => void
}): React.ReactElement | null {
  const { t } = useTranslation()

  if (status === 'ready') return null

  const statusConfig: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
    disconnected: {
      icon: <DisconnectOutlined />,
      text: t('chat.status.disconnected'),
      color: '#999',
    },
    connecting: {
      icon: <LoadingOutlined spin />,
      text: t('chat.status.connecting'),
      color: '#1677ff',
    },
    handshaking: {
      icon: <LoadingOutlined spin />,
      text: t('chat.status.handshaking'),
      color: '#1677ff',
    },
    error: {
      icon: <DisconnectOutlined />,
      text: errorMsg || t('chat.status.error'),
      color: '#ff4d4f',
    },
  }

  const cfg = statusConfig[status] || statusConfig.disconnected

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        background: status === 'error' ? '#fff2f0' : '#f5f5f5',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        fontSize: 13,
        color: cfg.color,
        flexShrink: 0,
      }}
    >
      {cfg.icon}
      <span>{cfg.text}</span>
      {(status === 'disconnected' || status === 'error') && (
        <Button
          size="small"
          type="link"
          onClick={onReconnect}
          style={{ padding: 0, height: 'auto' }}
        >
          {t('chat.status.retry')}
        </Button>
      )}
    </div>
  )
}
