import { Prompts, Welcome } from '@ant-design/x'
import { ThunderboltOutlined } from '@ant-design/icons'
import type { TFunction } from 'i18next'

interface ChatEmptyStateProps {
  quickPrompts: React.ComponentProps<typeof Prompts>['items']
  onPromptSelect: (value: string) => void
  t: TFunction
}

export function ChatEmptyState({
  quickPrompts,
  onPromptSelect,
  t,
}: ChatEmptyStateProps): React.ReactElement {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
      }}
    >
      <Welcome
        icon={<ThunderboltOutlined style={{ fontSize: 40, color: '#FF4D2A' }} />}
        title={t('chat.welcome.ready')}
        description={t('chat.welcome.readyHint')}
      />
      <Prompts
        title={t('chat.prompts.title')}
        items={quickPrompts}
        wrap
        styles={{
          item: {
            flex: 'none',
            width: 'calc(33.33% - 8px)',
            backgroundImage: 'linear-gradient(137deg, #fff3f0 0%, #fff8f6 100%)',
            border: '1px solid #ffe8e0',
          },
          subItem: {
            background: 'rgba(255,255,255,0.75)',
            border: '1px solid rgba(255,255,255,0.95)',
          },
        }}
        onItemClick={({ data }) => {
          if (!data.children && typeof data.description === 'string') {
            onPromptSelect(data.description)
          }
        }}
      />
    </div>
  )
}
