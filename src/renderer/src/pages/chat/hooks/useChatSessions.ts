import { useCallback, useState } from 'react'

interface UseChatSessionsArgs {
  defaultAgentId: string
  sessions: Array<{ key: string; label: string }>
  newSession: (name: string, agentId?: string) => void
  deleteSession: (key: string) => Promise<void>
  resetSession: (key?: string) => Promise<void>
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
  defaultAgentId,
  sessions,
  newSession,
  deleteSession,
  resetSession,
  messageApi,
  modalApi,
  t,
}: UseChatSessionsArgs) {
  const [newSessionVisible, setNewSessionVisible] = useState(false)
  const [newSessionName, setNewSessionName] = useState('')
  const [newSessionAgentId, setNewSessionAgentId] = useState('')
  const [agentOptions, setAgentOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)

  const handleOpenNewSession = useCallback(async (): Promise<void> => {
    setNewSessionName('')
    setNewSessionAgentId(defaultAgentId)
    setNewSessionVisible(true)
    setLoadingAgents(true)
    try {
      const list = (await window.api.agent.list()) as Array<{
        id: string
        name?: string
        identity?: { name?: string; emoji?: string }
        default?: boolean
      }>
      const opts = list.map((a) => {
        const displayName = a.identity?.name || a.name || a.id
        const emoji = a.identity?.emoji
        return {
          value: a.id,
          label: emoji ? `${emoji} ${displayName}` : displayName,
        }
      })
      if (defaultAgentId && !opts.find((o) => o.value === defaultAgentId)) {
        opts.unshift({ value: defaultAgentId, label: `${defaultAgentId} (默认)` })
      }
      setAgentOptions(opts)
    } catch {
      setAgentOptions(
        defaultAgentId ? [{ value: defaultAgentId, label: `${defaultAgentId} (默认)` }] : []
      )
    } finally {
      setLoadingAgents(false)
    }
  }, [defaultAgentId])

  const handleConfirmNewSession = useCallback((): void => {
    const name = newSessionName.trim()
    if (!name) {
      messageApi.warning(t('chat.sessions.newSessionNameRequired'))
      return
    }
    newSession(name, newSessionAgentId || defaultAgentId)
    messageApi.success(t('chat.sessions.newSessionSuccess'))
    setNewSessionVisible(false)
  }, [newSessionName, messageApi, t, newSession, newSessionAgentId, defaultAgentId])

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
  }
}
