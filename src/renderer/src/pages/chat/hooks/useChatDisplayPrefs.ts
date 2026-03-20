import { useEffect, useState } from 'react'

interface ChatDisplayPrefsState {
  showThinking: boolean
  showToolCalls: boolean
  showUsage: boolean
}

const STORAGE_KEY = 'clickclaw.chat.display.v1'

function loadInitialPrefs(): ChatDisplayPrefsState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { showThinking: false, showToolCalls: true, showUsage: true }
    const parsed = JSON.parse(raw) as Partial<ChatDisplayPrefsState>
    return {
      showThinking: Boolean(parsed.showThinking),
      showToolCalls: parsed.showToolCalls !== false,
      showUsage: parsed.showUsage !== false,
    }
  } catch {
    return { showThinking: false, showToolCalls: true, showUsage: true }
  }
}

export function useChatDisplayPrefs() {
  const [showThinking, setShowThinking] = useState<boolean>(() => loadInitialPrefs().showThinking)
  const [showToolCalls, setShowToolCalls] = useState<boolean>(
    () => loadInitialPrefs().showToolCalls
  )
  const [showUsage, setShowUsage] = useState<boolean>(() => loadInitialPrefs().showUsage)

  useEffect(() => {
    const payload: ChatDisplayPrefsState = { showThinking, showToolCalls, showUsage }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [showThinking, showToolCalls, showUsage])

  return {
    showThinking,
    setShowThinking,
    showToolCalls,
    setShowToolCalls,
    showUsage,
    setShowUsage,
  }
}
