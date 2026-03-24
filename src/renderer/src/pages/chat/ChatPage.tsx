/**
 * 实时聊天页面（完整版）
 * 左侧：会话列表（Conversations）
 * 右侧：消息区域 + Sender（带附件面板）
 */

import { Bubble, Sender, Welcome, Attachments } from '@ant-design/x'
import {
  App,
  Button,
  Divider,
  Dropdown,
  Flex,
  GetRef,
  Spin,
  Switch,
  Typography,
  Layout,
  theme,
} from 'antd'
import {
  DownOutlined,
  PlayCircleOutlined,
  WifiOutlined,
  LoadingOutlined,
  PaperClipOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useGatewayContext } from '../../contexts/GatewayContext'
import { ChatEmptyState } from './components/ChatEmptyState'
import { ChatSessionsSider } from './components/ChatSessionsSider'
import { SlashCommandPanel } from './components/SlashCommandPanel'
import { StatusBar } from './components/StatusBar'
import { useChatBubbles } from './hooks/useChatBubbles'
import { useChatCommands } from './hooks/useChatCommands'
import { useChatComposer } from './hooks/useChatComposer'
import { useChatConnectionUi } from './hooks/useChatConnectionUi'
import { useChatModelSwitcher } from './hooks/useChatModelSwitcher'
import { useChatDisplayPrefs } from './hooks/useChatDisplayPrefs'
import { useChatPrompts } from './hooks/useChatPrompts'
import { useChatSessions } from './hooks/useChatSessions'
import { useSlashCommandMenu } from './hooks/useSlashCommandMenu'

const { Title, Paragraph } = Typography
const { Content } = Layout

// ========== 主页面 ==========

function ChatPage(): React.ReactElement {
  const { t } = useTranslation()
  const location = useLocation()
  const { token } = theme.useToken()
  const { message: msg, modal } = App.useApp()
  const senderRef = useRef<GetRef<typeof Sender>>(null)
  const seededAgentHintRef = useRef<string | null>(null)

  const {
    status,
    messages,
    historyLoading,
    isStreaming,
    errorMsg,
    gatewayRunning,
    sessions,
    defaultAgentId,
    isDraftSession,
    currentSessionAgentId,
    sendMessage,
    abortMessage,
    newSession,
    setDraftAgent,
    reconnect,
    switchSession,
    deleteSession,
    resetSession,
    sessionKey,
    listAgents,
    callRpc,
  } = useGatewayContext()

  const seedAgentId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('agent_id') || params.get('agentId') || ''
    const normalized = raw.trim()
    return normalized || null
  }, [location.search])

  const { messagesContainerRef, showConnectingSpinner } = useChatConnectionUi(
    status,
    messages,
    sessionKey
  )

  const {
    inputValue,
    setInputValue,
    attachFiles,
    setAttachFiles,
    attachOpen,
    setAttachOpen,
    attachRef,
    handleSend,
  } = useChatComposer({ sendMessage })

  const {
    modelOptions,
    currentModel,
    defaultModel,
    loadingModels,
    switchingModel,
    modelSelectDisabled,
    handleModelChange,
  } = useChatModelSwitcher({
    status,
    sessionKey,
    isStreaming,
    callRpc,
    onSwitched: (model) => {
      msg.success(
        model ? t('chat.model.switchSuccess', { model }) : t('chat.model.switchDefaultSuccess')
      )
    },
  })

  const quickPrompts = useChatPrompts(t)
  const [agentOptions, setAgentOptions] = useState<Array<{ value: string; label: string }>>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false)
  const [preferredNewSessionAgentId, setPreferredNewSessionAgentId] = useState<string | undefined>(
    undefined
  )
  const { handleOpenNewSession, handleDeleteSession, handleResetSession } = useChatSessions({
    sessions,
    newSession,
    deleteSession,
    resetSession,
    preferredAgentId: preferredNewSessionAgentId,
    preferredAgentName:
      agentOptions.find((item) => item.value === preferredNewSessionAgentId)?.label || undefined,
    messageApi: msg,
    modalApi: modal,
    t,
  })
  const slashCommands = useChatCommands(t)
  const {
    showThinking,
    setShowThinking,
    showToolCalls,
    setShowToolCalls,
    showUsage,
    setShowUsage,
  } = useChatDisplayPrefs()
  const { bubbleItems, bubbleRoles } = useChatBubbles({
    messages,
    tokenColorTextSecondary: token.colorTextSecondary,
    showThinking,
    showToolCalls,
    showUsage,
    onCopied: () => msg.success(t('common.copied')),
  })
  const slashMenu = useSlashCommandMenu({
    commands: slashCommands,
    onApplyCommand: (nextValue, cursor) => {
      setInputValue(nextValue)
      requestAnimationFrame(() => {
        const input = senderRef.current?.inputElement as HTMLTextAreaElement | undefined
        if (!input) return
        input.focus()
        input.setSelectionRange(cursor, cursor)
      })
    },
  })
  const effectiveModel = currentModel || defaultModel
  const selectedModelLabel =
    modelOptions.find((item) => item.value === currentModel)?.label ||
    modelOptions.find((item) => item.value === defaultModel)?.label ||
    effectiveModel.split('/').pop() ||
    t('chat.model.defaultOptionEmpty')
  const modelMenuItems = [
    {
      key: '__default__',
      label: defaultModel
        ? t('chat.model.defaultOption', { model: defaultModel })
        : t('chat.model.defaultOptionEmpty'),
    },
    ...modelOptions.map((option) => ({
      key: option.value,
      label: option.label,
    })),
  ]
  const canSelectDraftAgent = isDraftSession && messages.length === 0 && !isStreaming
  const selectedAgentLabel =
    agentOptions.find((item) => item.value === currentSessionAgentId)?.label ||
    currentSessionAgentId ||
    defaultAgentId
  const agentMenuItems = useMemo(
    () =>
      agentOptions.map((option) => ({
        key: option.value,
        label: option.label,
      })),
    [agentOptions]
  )
  const sessionKeyDisplay = useMemo(() => {
    if (!sessionKey) return t('chat.model.noSession')
    if (sessionKey.startsWith('draft:')) {
      const parts = sessionKey.split(':')
      const draftName = parts.slice(3).join(':') || 'draft'
      return `draft:${draftName}`
    }
    if (sessionKey.length <= 44) return sessionKey
    return `${sessionKey.slice(0, 24)}...${sessionKey.slice(-14)}`
  }, [sessionKey, t])

  useEffect(() => {
    if (status !== 'ready') return
    setLoadingAgents(true)
    listAgents()
      .then((result) => {
        const rows = result?.agents || []
        const items = rows.map((agent) => {
          const name = agent.identity?.name || agent.name || agent.id
          return {
            value: agent.id,
            label: name,
          }
        })
        setAgentOptions(items)
      })
      .finally(() => {
        setLoadingAgents(false)
        setAgentsLoadedOnce(true)
      })
  }, [listAgents, status])

  useEffect(() => {
    if (status !== 'ready' || loadingAgents || !agentsLoadedOnce) return

    const seedKey = seedAgentId || '__none__'
    if (seededAgentHintRef.current === seedKey) return
    seededAgentHintRef.current = seedKey

    if (!seedAgentId) {
      setPreferredNewSessionAgentId(undefined)
      return
    }

    const seeded = agentOptions.find((item) => item.value === seedAgentId)
    if (seeded) {
      setPreferredNewSessionAgentId(seeded.value)
      msg.info(t('chat.entry.prefilledAgentHint', { name: seeded.label }))
      return
    }

    if (defaultAgentId) {
      setPreferredNewSessionAgentId(defaultAgentId)
      msg.warning(t('chat.entry.invalidAgentFallback'))
      return
    }

    setPreferredNewSessionAgentId(undefined)
    msg.warning(t('chat.entry.noDefaultAgent'))
  }, [agentOptions, agentsLoadedOnce, defaultAgentId, loadingAgents, msg, seedAgentId, status, t])

  // ========== Gateway 未运行状态 ==========

  const isWsDown = status === 'disconnected' || status === 'error'

  if (isWsDown && messages.length === 0) {
    if (!gatewayRunning) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#fafafa',
          }}
        >
          <StatusBar status={status} errorMsg={errorMsg} onReconnect={reconnect} />
          <div
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              {/* 图标区 */}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  background: '#FFF3F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                }}
              >
                <RocketOutlined style={{ fontSize: 40, color: '#FF4D2A' }} />
              </div>
              <Title level={3} style={{ marginBottom: 8 }}>
                {t('chat.welcome.title')}
              </Title>
              <Paragraph type="secondary" style={{ fontSize: 14, marginBottom: 32 }}>
                {t('chat.welcome.description')}
              </Paragraph>
              {/* 功能标签 */}
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  justifyContent: 'center',
                  marginBottom: 32,
                  flexWrap: 'wrap',
                }}
              >
                {[
                  t('chat.welcome.feature1'),
                  t('chat.welcome.feature2'),
                  t('chat.welcome.feature3'),
                ].map((feat) => (
                  <div
                    key={feat}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      background: '#fff',
                      border: '1px solid #f0f0f0',
                      borderRadius: 20,
                      fontSize: 13,
                      color: '#595959',
                    }}
                  >
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                    {feat}
                  </div>
                ))}
              </div>
              {/* CTA 按钮 */}
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={() => window.api.gateway.start()}
                style={{ minWidth: 160, height: 44, fontSize: 15 }}
              >
                {t('chat.welcome.startGateway')}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <StatusBar status={status} errorMsg={errorMsg} onReconnect={reconnect} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Welcome
            icon={<LoadingOutlined style={{ fontSize: 48, color: '#FF4D2A' }} />}
            title={t('chat.welcome.ready')}
            description={errorMsg || t('chat.status.error')}
            extra={
              <Button icon={<WifiOutlined />} onClick={reconnect}>
                {t('chat.status.retry')}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  // ========== 连接中状态 ==========

  if (showConnectingSpinner && messages.length === 0) {
    return (
      <div
        style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        <Spin size="large" tip={t('chat.status.connecting')}>
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    )
  }

  // ========== 渲染 ==========

  return (
    <Layout style={{ height: '100%' }}>
      <ChatSessionsSider
        status={status}
        isStreaming={isStreaming}
        sessions={sessions}
        sessionKey={sessionKey}
        tokenBgContainer={token.colorBgContainer}
        tokenBorderColor={token.colorBorderSecondary}
        tokenTextTertiary={token.colorTextTertiary}
        onOpenNewSession={handleOpenNewSession}
        onSwitchSession={switchSession}
        onResetSession={handleResetSession}
        onDeleteSession={handleDeleteSession}
        t={t}
      />

      {/* 右侧聊天区域 */}
      <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶部状态栏 */}
        <StatusBar status={status} errorMsg={errorMsg} onReconnect={reconnect} />
        <div
          style={{
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: '8px 24px',
            background: token.colorBgContainer,
            flexShrink: 0,
          }}
        >
          <Flex justify="flex-end" align="center" gap={8} wrap="wrap">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                borderRadius: 999,
                background: token.colorFillTertiary,
                padding: '2px 10px',
                maxWidth: 520,
              }}
            >
              <span style={{ color: token.colorTextTertiary }}>{t('chat.sessions.title')}</span>
              <span
                style={{
                  color: token.colorText,
                  minWidth: 0,
                  maxWidth: 420,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={sessionKey || t('chat.model.noSession')}
              >
                {sessionKeyDisplay}
              </span>
            </span>
            {canSelectDraftAgent ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: agentMenuItems,
                  selectable: true,
                  selectedKeys: [currentSessionAgentId],
                  onClick: ({ key }) => setDraftAgent(String(key)),
                }}
                disabled={loadingAgents}
              >
                <Button
                  type="text"
                  icon={<RobotOutlined />}
                  disabled={loadingAgents}
                  title={t('chat.agent.label')}
                  style={{
                    borderRadius: 999,
                    background: token.colorFillTertiary,
                    color: token.colorText,
                    paddingInline: 12,
                    height: 28,
                    minWidth: 160,
                    justifyContent: 'space-between',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ color: token.colorTextTertiary }}>{t('chat.agent.label')}</span>
                  <span
                    style={{
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedAgentLabel}
                  </span>
                  <DownOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                </Button>
              </Dropdown>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: token.colorText,
                  borderRadius: 999,
                  background: token.colorFillTertiary,
                  padding: '2px 10px',
                  maxWidth: 260,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={selectedAgentLabel}
              >
                <span style={{ color: token.colorTextTertiary }}>{t('chat.agent.label')}: </span>
                {selectedAgentLabel}
              </span>
            )}
          </Flex>
        </div>

        {/* 消息区域 */}
        <div ref={messagesContainerRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {historyLoading && messages.length === 0 ? (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spin tip={t('chat.status.loadingHistory')}>
                <div style={{ width: 240, height: 120 }} />
              </Spin>
            </div>
          ) : messages.length === 0 ? (
            <ChatEmptyState quickPrompts={quickPrompts} onPromptSelect={setInputValue} t={t} />
          ) : (
            <Bubble.List
              items={bubbleItems}
              role={bubbleRoles}
              style={{ maxWidth: 800, margin: '0 auto' }}
            />
          )}
        </div>

        {/* 底部输入区 */}
        <div
          style={{
            padding: '12px 24px 16px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
            flexShrink: 0,
          }}
        >
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ position: 'relative' }}>
              {slashMenu.open ? (
                <SlashCommandPanel
                  items={slashMenu.items}
                  level={slashMenu.level}
                  query={slashMenu.query}
                  pathLabels={slashMenu.pathLabels}
                  canGoBack={slashMenu.canGoBack}
                  activeIndex={slashMenu.activeIndex}
                  onHover={slashMenu.setActiveIndex}
                  onSelect={(index) => slashMenu.handleItemClick(index, inputValue)}
                  onGoBack={slashMenu.goBack}
                  t={t}
                />
              ) : null}
              <Sender
                ref={senderRef}
                value={inputValue}
                onChange={(nextValue, event) => {
                  setInputValue(nextValue)
                  const cursor = event?.currentTarget.selectionStart ?? nextValue.length
                  slashMenu.handleInputChange(nextValue, cursor)
                }}
                onKeyDown={(event) => {
                  const handled = slashMenu.handleKeyDown(event, inputValue)
                  if (handled) return false
                  return undefined
                }}
                onBlur={() => slashMenu.closeMenu()}
                disabled={status !== 'ready'}
                loading={isStreaming}
                placeholder={
                  status !== 'ready'
                    ? t('chat.sender.waitingGateway')
                    : t('chat.sender.placeholder')
                }
                onSubmit={handleSend}
                onCancel={abortMessage}
                footer={(actionNode) => (
                  <Flex justify="space-between" align="center" gap={12} style={{ width: '100%' }}>
                    <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                      <Button
                        type="text"
                        icon={<PaperClipOutlined />}
                        onClick={() => setAttachOpen(!attachOpen)}
                        style={{ color: attachFiles.length > 0 ? '#FF4D2A' : undefined }}
                        title={t('chat.attachments.addFile')}
                      />
                      <Divider type="vertical" style={{ margin: 0 }} />
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: modelMenuItems,
                          selectable: true,
                          selectedKeys: [currentModel || '__default__'],
                          onClick: ({ key }) => {
                            handleModelChange(key === '__default__' ? '' : String(key)).catch(
                              (error: Error) => {
                                msg.error(t('chat.model.switchFailed', { error: error.message }))
                              }
                            )
                          },
                        }}
                        disabled={modelSelectDisabled}
                      >
                        <Button
                          type="text"
                          loading={loadingModels || switchingModel}
                          disabled={modelSelectDisabled}
                          title={t('chat.model.label')}
                          style={{
                            borderRadius: 999,
                            background: token.colorFillTertiary,
                            color: token.colorText,
                            paddingInline: 14,
                            height: 32,
                            minWidth: 140,
                            justifyContent: 'space-between',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              maxWidth: 180,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {selectedModelLabel}
                          </span>
                          <DownOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
                        </Button>
                      </Dropdown>
                      <Divider type="vertical" style={{ margin: 0 }} />
                      <Flex align="center" gap={6} wrap="wrap">
                        <Flex align="center" gap={4}>
                          <Switch size="small" checked={showThinking} onChange={setShowThinking} />
                          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            {t('chat.display.thinking')}
                          </span>
                        </Flex>
                        <Flex align="center" gap={4}>
                          <Switch
                            size="small"
                            checked={showToolCalls}
                            onChange={setShowToolCalls}
                          />
                          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            {t('chat.display.tools')}
                          </span>
                        </Flex>
                        <Flex align="center" gap={4}>
                          <Switch size="small" checked={showUsage} onChange={setShowUsage} />
                          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            {t('chat.display.usage')}
                          </span>
                        </Flex>
                      </Flex>
                    </Flex>
                    <Flex align="center" gap={8} flex="none">
                      <Divider type="vertical" style={{ margin: 0 }} />
                      {actionNode}
                    </Flex>
                  </Flex>
                )}
                header={
                  <Sender.Header
                    title={t('chat.attachments.title')}
                    open={attachOpen}
                    onOpenChange={setAttachOpen}
                    closable
                  >
                    <Attachments
                      ref={attachRef}
                      items={attachFiles}
                      onChange={({ fileList }) => setAttachFiles(fileList)}
                      beforeUpload={() => false}
                      placeholder={{
                        icon: <PaperClipOutlined />,
                        title: t('chat.attachments.placeholder'),
                        description: t('chat.attachments.supportedTypes'),
                      }}
                      overflow="scrollX"
                    />
                  </Sender.Header>
                }
                prefix={false}
                suffix={false}
              />
            </div>
            {/* 附件计数提示 */}
            {attachFiles.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, color: '#FF4D2A' }}>
                {t('chat.attachments.selected', { count: attachFiles.length })}
                <Button
                  type="link"
                  size="small"
                  style={{ padding: '0 4px', fontSize: 12 }}
                  onClick={() => setAttachFiles([])}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Content>
    </Layout>
  )
}

export default ChatPage
