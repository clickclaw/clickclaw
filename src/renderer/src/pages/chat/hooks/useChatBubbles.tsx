import { useMemo } from 'react'
import { XMarkdown } from '@ant-design/x-markdown'
import { Think, ThoughtChain } from '@ant-design/x'
import type { BubbleListProps } from '@ant-design/x'
import { Avatar, Button } from 'antd'
import { CopyOutlined, FileOutlined } from '@ant-design/icons'
import type { ChatMessage } from '../../../hooks/useGatewayWs'

interface UseChatBubblesArgs {
  messages: ChatMessage[]
  tokenColorTextSecondary: string
  showThinking: boolean
  showToolCalls: boolean
  showUsage: boolean
  onCopied: () => void
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(value)
}

function shortenModelName(model?: string): string | undefined {
  if (!model) return undefined
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

function toLocalMediaSrc(src?: string): string | undefined {
  if (!src) return src
  if (src.startsWith('/')) {
    return `app://local-file/open?path=${encodeURIComponent(src)}`
  }
  if (!src.startsWith('file://')) return src
  try {
    const parsed = new URL(src)
    let localPath = decodeURIComponent(parsed.pathname || '')
    if (/^\/[A-Za-z]:\//.test(localPath)) {
      localPath = localPath.slice(1)
    }
    return `app://local-file/open?path=${encodeURIComponent(localPath)}`
  } catch {
    return src
  }
}

function rewriteLocalFileImages(markdown: string): string {
  if (!markdown) return markdown
  return markdown.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_all, alt, rawUrl) => {
    const mapped = toLocalMediaSrc(rawUrl) || rawUrl
    return `![${alt}](${mapped})`
  })
}

export function useChatBubbles({
  messages,
  tokenColorTextSecondary,
  showThinking,
  showToolCalls,
  showUsage,
  onCopied,
}: UseChatBubblesArgs): {
  bubbleItems: BubbleListProps['items']
  bubbleRoles: BubbleListProps['role']
} {
  const markdownComponents = useMemo(
    () => ({
      img: (props: { src?: string; alt?: string; title?: string }): React.ReactElement => {
        const mappedSrc = toLocalMediaSrc(props.src)
        return (
          <img
            src={mappedSrc}
            alt={props.alt}
            title={props.title}
            style={{ maxWidth: '100%', borderRadius: 8 }}
          />
        )
      },
    }),
    []
  )
  const markdownDompurifyConfig = useMemo(
    () => ({
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|app|file):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    }),
    []
  )

  const bubbleItems: BubbleListProps['items'] = useMemo(
    () =>
      messages
        .map((chatMsg) => {
          if (chatMsg.role === 'assistant') {
            const hasText = Boolean(chatMsg.content?.trim()) || Boolean(chatMsg.streaming)
            const hasThinking = showThinking && Boolean(chatMsg.thinking?.trim())
            const hasTools = showToolCalls && Boolean(chatMsg.toolCalls?.length)
            const hasVisibleContent = hasText || hasThinking || hasTools

            // 当前开关下没有可见内容时，整条 assistant 气泡不渲染，避免出现空白气泡
            if (!hasVisibleContent) return null
          }

          return {
            key: chatMsg.id,
            role: chatMsg.role === 'assistant' ? 'ai' : 'user',
            content:
              chatMsg.role === 'assistant' ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {showThinking && chatMsg.thinking ? (
                    <Think defaultExpanded={false}>
                      <XMarkdown
                        content={rewriteLocalFileImages(chatMsg.thinking)}
                        openLinksInNewTab
                        components={markdownComponents}
                        dompurifyConfig={markdownDompurifyConfig}
                      />
                    </Think>
                  ) : null}
                  {showToolCalls && chatMsg.toolCalls && chatMsg.toolCalls.length > 0 ? (
                    <ThoughtChain
                      items={chatMsg.toolCalls.map((toolCall) => ({
                        key: toolCall.id,
                        title: toolCall.name,
                        status: toolCall.status,
                        collapsible: Boolean(toolCall.argumentsText || toolCall.resultText),
                        content:
                          toolCall.argumentsText || toolCall.resultText ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              {toolCall.argumentsText ? (
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: 8,
                                    borderRadius: 6,
                                    background: 'rgba(0,0,0,0.04)',
                                    whiteSpace: 'pre-wrap',
                                    fontSize: 12,
                                    color: tokenColorTextSecondary,
                                  }}
                                >
                                  {toolCall.argumentsText}
                                </pre>
                              ) : null}
                              {toolCall.resultText ? (
                                <XMarkdown
                                  content={rewriteLocalFileImages(toolCall.resultText)}
                                  openLinksInNewTab
                                  components={markdownComponents}
                                  dompurifyConfig={markdownDompurifyConfig}
                                />
                              ) : null}
                            </div>
                          ) : undefined,
                      }))}
                      line="dashed"
                    />
                  ) : null}
                  {(chatMsg.content || chatMsg.streaming) && (
                    <XMarkdown
                      content={rewriteLocalFileImages(
                        chatMsg.content || (chatMsg.streaming ? '...' : '')
                      )}
                      openLinksInNewTab
                      components={markdownComponents}
                      dompurifyConfig={markdownDompurifyConfig}
                    />
                  )}
                </div>
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
            // ant-design/x 的 Bubble 在 loading=true 时会覆盖正文，
            // 仅在还没有任何可见内容时显示 loading，占位避免“整段最终才出现”。
            loading:
              chatMsg.role === 'assistant'
                ? Boolean(
                    chatMsg.streaming &&
                    !(
                      chatMsg.content?.trim() ||
                      chatMsg.thinking?.trim() ||
                      chatMsg.toolCalls?.length
                    )
                  )
                : false,
            footer:
              chatMsg.role === 'assistant' && !chatMsg.streaming ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {showUsage &&
                    (chatMsg.model || chatMsg.provider || chatMsg.usage || chatMsg.durationMs) && (
                      <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>
                        {[
                          shortenModelName(chatMsg.model),
                          chatMsg.provider,
                          chatMsg.usage
                            ? formatCompactNumber(chatMsg.usage.totalTokens)
                            : undefined,
                          chatMsg.durationMs
                            ? `${(chatMsg.durationMs / 1000).toFixed(1)}s`
                            : undefined,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
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
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [
      markdownComponents,
      markdownDompurifyConfig,
      messages,
      onCopied,
      showThinking,
      showToolCalls,
      showUsage,
      tokenColorTextSecondary,
    ]
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
