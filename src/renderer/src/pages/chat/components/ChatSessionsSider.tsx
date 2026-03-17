import { Conversations } from '@ant-design/x'
import { Button, Layout } from 'antd'
import { ClearOutlined, DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import type { TFunction } from 'i18next'

const { Sider } = Layout

interface ChatSessionItem {
  key: string
  label: string
}

interface ChatSessionsSiderProps {
  status: string
  isStreaming: boolean
  sessions: ChatSessionItem[]
  sessionKey?: string | null
  tokenBgContainer: string
  tokenBorderColor: string
  tokenTextTertiary: string
  onOpenNewSession: () => void
  onSwitchSession: (key: string) => void
  onResetSession: (key: string) => void
  onDeleteSession: (key: string) => void
  t: TFunction
}

export function ChatSessionsSider({
  status,
  isStreaming,
  sessions,
  sessionKey,
  tokenBgContainer,
  tokenBorderColor,
  tokenTextTertiary,
  onOpenNewSession,
  onSwitchSession,
  onResetSession,
  onDeleteSession,
  t,
}: ChatSessionsSiderProps): React.ReactElement {
  return (
    <Sider
      width={220}
      style={{
        background: tokenBgContainer,
        borderRight: `1px solid ${tokenBorderColor}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 12px 8px' }}>
          <Button
            block
            type="primary"
            icon={<MessageOutlined />}
            onClick={onOpenNewSession}
            disabled={status !== 'ready' || isStreaming}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
          >
            {t('chat.sessions.newSession')}
          </Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sessions.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: tokenTextTertiary,
                fontSize: 13,
              }}
            >
              {t('chat.sessions.empty')}
            </div>
          ) : (
            <Conversations
              activeKey={sessionKey || undefined}
              onActiveChange={(key) => onSwitchSession(key)}
              items={sessions.map((s) => ({
                key: s.key,
                label: s.label,
                icon: <MessageOutlined style={{ color: '#FF4D2A' }} />,
              }))}
              menu={(conversation) => ({
                items: [
                  {
                    key: 'reset',
                    label: t('chat.sessions.resetSession'),
                    icon: <ClearOutlined />,
                  },
                  {
                    key: 'delete',
                    label: t('chat.sessions.deleteSession'),
                    icon: <DeleteOutlined />,
                    danger: true,
                  },
                ],
                onClick: ({ key }: { key: string }) => {
                  if (key === 'reset') onResetSession(conversation.key)
                  if (key === 'delete') onDeleteSession(conversation.key)
                },
              })}
              styles={{
                item: { borderRadius: 6, margin: '2px 8px' },
              }}
            />
          )}
        </div>
      </div>
    </Sider>
  )
}
