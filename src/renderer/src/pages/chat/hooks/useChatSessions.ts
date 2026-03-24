import { useCallback } from 'react'

interface UseChatSessionsArgs {
  sessions: Array<{ key: string; label: string }>
  newSession: (name: string, agentId?: string) => void
  deleteSession: (key: string) => Promise<void>
  resetSession: (key?: string) => Promise<void>
  preferredAgentId?: string
  preferredAgentName?: string
  messageApi: {
    success: (content: string) => void
    warning: (content: string) => void
    error: (content: string) => void
  }
  modalApi: {
    confirm: (config: {
      title: string
      content: string
      okText: string
      okButtonProps?: { danger?: boolean }
      cancelText: string
      onOk: () => void
    }) => void
  }
  t: (key: string, options?: Record<string, unknown>) => string
}

export function useChatSessions({
  sessions,
  newSession,
  deleteSession,
  resetSession,
  preferredAgentId,
  preferredAgentName,
  messageApi,
  modalApi,
  t,
}: UseChatSessionsArgs) {
  const handleOpenNewSession = useCallback((): void => {
    const now = new Date()
    const autoName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
    newSession(autoName, preferredAgentId)
    if (preferredAgentId && preferredAgentName) {
      messageApi.success(
        t('chat.sessions.newSessionWithAgentSuccess', { name: preferredAgentName })
      )
      return
    }
    messageApi.success(t('chat.sessions.newSessionSuccess'))
  }, [messageApi, newSession, preferredAgentId, preferredAgentName, t])

  const handleDeleteSession = useCallback(
    (key: string): void => {
      const label = sessions.find((s) => s.key === key)?.label || key
      modalApi.confirm({
        title: t('chat.sessions.deleteConfirmTitle'),
        content: t('chat.sessions.deleteConfirmContent', { label }),
        okText: t('common.confirm'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        onOk: () => {
          deleteSession(key)
            .then(() => messageApi.success(t('chat.sessions.deleteSuccess')))
            .catch((err: Error) => {
              if (err.message === 'main') {
                messageApi.warning(t('chat.sessions.mainSessionProtected'))
              } else {
                messageApi.error(t('chat.sessions.deleteFailed', { error: err.message }))
              }
            })
        },
      })
    },
    [deleteSession, messageApi, modalApi, sessions, t]
  )

  const handleResetSession = useCallback(
    (key?: string): void => {
      resetSession(key)
        .then(() => messageApi.success(t('chat.sessions.resetSuccess')))
        .catch((err: Error) =>
          messageApi.error(t('chat.sessions.resetFailed', { error: err.message }))
        )
    },
    [messageApi, resetSession, t]
  )

  return {
    handleOpenNewSession,
    handleDeleteSession,
    handleResetSession,
  }
}
