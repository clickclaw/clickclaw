import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import { MessageOutlined, RocketOutlined, ThunderboltOutlined } from '@ant-design/icons'

export function useChatPrompts(t: TFunction) {
  return useMemo(
    () => [
      {
        key: 'start',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RocketOutlined style={{ color: '#FF4D2A' }} />
            <span>{t('chat.prompts.groupStart')}</span>
          </div>
        ),
        description: t('chat.prompts.groupStartDesc'),
        children: [
          { key: 'start-1', description: t('chat.prompts.start1') },
          { key: 'start-2', description: t('chat.prompts.start2') },
          { key: 'start-3', description: t('chat.prompts.start3') },
        ],
      },
      {
        key: 'assist',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageOutlined style={{ color: '#1677ff' }} />
            <span>{t('chat.prompts.groupAssist')}</span>
          </div>
        ),
        description: t('chat.prompts.groupAssistDesc'),
        children: [
          { key: 'assist-1', description: t('chat.prompts.assist1') },
          { key: 'assist-2', description: t('chat.prompts.assist2') },
          { key: 'assist-3', description: t('chat.prompts.assist3') },
        ],
      },
      {
        key: 'think',
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ThunderboltOutlined style={{ color: '#722ED1' }} />
            <span>{t('chat.prompts.groupThink')}</span>
          </div>
        ),
        description: t('chat.prompts.groupThinkDesc'),
        children: [
          { key: 'think-1', description: t('chat.prompts.think1') },
          { key: 'think-2', description: t('chat.prompts.think2') },
          { key: 'think-3', description: t('chat.prompts.think3') },
        ],
      },
    ],
    [t]
  )
}
