/**
 * 实时聊天页面（完整版）
 * 左侧：会话列表（Conversations）
 * 右侧：消息区域 + Sender（带附件面板和快捷指令）
 */

import { Bubble, Sender, Welcome, Attachments, Suggestion } from '@ant-design/x'
import { App, Button, Spin, Typography, Layout, theme } from 'antd'
import {
  PlayCircleOutlined,
  WifiOutlined,
  LoadingOutlined,
  PaperClipOutlined,
  RocketOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useGatewayContext } from '../../contexts/GatewayContext'
import { ChatEmptyState } from './components/ChatEmptyState'
import { ChatSessionModal } from './components/ChatSessionModal'
import { ChatSessionsSider } from './components/ChatSessionsSider'
import { StatusBar } from './components/StatusBar'
import { useChatBubbles } from './hooks/useChatBubbles'
import { useChatCommands } from './hooks/useChatCommands'
import { useChatComposer } from './hooks/useChatComposer'
import { useChatConnectionUi } from './hooks/useChatConnectionUi'
import { useChatPrompts } from './hooks/useChatPrompts'
import { useChatSessions } from './hooks/useChatSessions'

const { Title, Paragraph } = Typography
const { Content } = Layout

// ========== 主页面 ==========

function ChatPage(): React.ReactElement {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { message: msg, modal } = App.useApp()

  const {
    status,
    messages,
    isStreaming,
    errorMsg,
    gatewayRunning,
    sessions,
    defaultAgentId,
    sendMessage,
    abortMessage,
    newSession,
    reconnect,
    switchSession,
    deleteSession,
    resetSession,
    sessionKey,
  } = useGatewayContext()

  const {
    newSessionVisible,
    setNewSessionVisible,
    newSessionName,
    setNewSessionName,
    newSessionAgentId,
    setNewSessionAgentId,
    agentOptions,
    loadingAgents,
    handleOpenNewSession,
    handleConfirmNewSession,
    handleDeleteSession,
    handleResetSession,
  } = useChatSessions({
    defaultAgentId,
    sessions,
    newSession,
    deleteSession,
    resetSession,
    messageApi: msg,
    modalApi: modal,
    t,
  })

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
    handleCommandSelect,
  } = useChatComposer({ sendMessage })

  const slashCommands = useChatCommands(t)
  const quickPrompts = useChatPrompts(t)
  const { bubbleItems, bubbleRoles } = useChatBubbles({
    messages,
    tokenColorTextSecondary: token.colorTextSecondary,
    onCopied: () => msg.success(t('common.copied')),
  })

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
      {/* 新建会话弹窗 */}
      <ChatSessionModal
        open={newSessionVisible}
        newSessionName={newSessionName}
        setNewSessionName={setNewSessionName}
        newSessionAgentId={newSessionAgentId}
        setNewSessionAgentId={setNewSessionAgentId}
        defaultAgentId={defaultAgentId}
        loadingAgents={loadingAgents}
        agentOptions={agentOptions}
        onConfirm={handleConfirmNewSession}
        onCancel={() => setNewSessionVisible(false)}
      />

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

        {/* 消息区域 */}
        <div ref={messagesContainerRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
          {messages.length === 0 ? (
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
            <Suggestion items={slashCommands} onSelect={handleCommandSelect}>
              {({ onTrigger, onKeyDown }) => (
                <Sender
                  value={inputValue}
                  onChange={(nextVal) => {
                    if (nextVal === '/') onTrigger()
                    else if (!nextVal) onTrigger(false)
                    setInputValue(nextVal)
                  }}
                  onKeyDown={onKeyDown}
                  disabled={status !== 'ready'}
                  loading={isStreaming}
                  placeholder={
                    status !== 'ready'
                      ? t('chat.sender.waitingGateway')
                      : t('chat.sender.placeholder')
                  }
                  onSubmit={handleSend}
                  onCancel={abortMessage}
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
                  prefix={
                    <Button
                      type="text"
                      icon={<PaperClipOutlined />}
                      onClick={() => setAttachOpen(!attachOpen)}
                      style={{ color: attachFiles.length > 0 ? '#FF4D2A' : undefined }}
                      title={t('chat.attachments.addFile')}
                    />
                  }
                />
              )}
            </Suggestion>
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
