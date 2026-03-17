import { useMemo } from 'react'
import { XMarkdown } from '@ant-design/x-markdown'
import type { BubbleListProps } from '@ant-design/x'
import { Avatar, Button } from 'antd'
import { CopyOutlined, FileOutlined } from '@ant-design/icons'
import type { ChatMessage } from '../../../hooks/useGatewayWs'

interface UseChatBubblesArgs {
  messages: ChatMessage[]
  tokenColorTextSecondary: string
  onCopied: () => void
}

export function useChatBubbles({
  messages,
  tokenColorTextSecondary,
  onCopied,
}: UseChatBubblesArgs): {
  bubbleItems: BubbleListProps['items']
  bubbleRoles: BubbleListProps['role']
} {
  const bubbleItems: BubbleListProps['items'] = useMemo(
    () =>
      messages.map((chatMsg) => ({
        key: chatMsg.id,
        role: chatMsg.role === 'assistant' ? 'ai' : 'user',
        content:
          chatMsg.role === 'assistant' ? (
            <XMarkdown content={chatMsg.content || (chatMsg.streaming ? '...' : '')} />
          ) : (
            <div>
              {chatMsg.attachments && chatMsg.attachments.length > 0 && (
                <div style={{ marginBottom: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {chatMsg.attachments.map((att, i) =>
                    att.category === 'image' ? (
                      <img
                        key={i}
                        src={`data:${att.mimeType};base64,${att.content}`}
                        alt={att.fileName}
                        style={{
                          maxWidth: 200,
                          maxHeight: 150,
                          borderRadius: 6,
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <span key={i} style={{ fontSize: 12, color: tokenColorTextSecondary }}>
                        <FileOutlined style={{ marginRight: 4 }} />
                        {att.fileName}
                      </span>
                    )
                  )}
                </div>
              )}
              {chatMsg.content}
            </div>
          ),
        loading: chatMsg.streaming && !chatMsg.content,
        footer:
          chatMsg.role === 'assistant' && !chatMsg.streaming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {chatMsg.durationMs && (
                <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
                  {(chatMsg.durationMs / 1000).toFixed(1)}s
                  {chatMsg.usage ? ` · ${chatMsg.usage.total_tokens} tokens` : ''}
                </span>
              )}
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                style={{ fontSize: 12, color: '#999', padding: '0 4px', height: 'auto' }}
                onClick={() => {
                  navigator.clipboard.writeText(chatMsg.content)
                  onCopied()
                }}
              />
            </div>
          ) : undefined,
      })),
    [messages, onCopied, tokenColorTextSecondary]
  )

  const bubbleRoles: BubbleListProps['role'] = useMemo(
    () => ({
      ai: {
        placement: 'start',
        avatar: <Avatar style={{ background: '#FF4D2A', color: '#fff', flexShrink: 0 }}>A</Avatar>,
      },
      user: {
        placement: 'end',
        avatar: <Avatar style={{ background: '#1677ff', color: '#fff', flexShrink: 0 }}>U</Avatar>,
      },
    }),
    []
  )

  return { bubbleItems, bubbleRoles }
}
