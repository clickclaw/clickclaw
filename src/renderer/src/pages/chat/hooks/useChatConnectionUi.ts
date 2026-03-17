import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../../hooks/useGatewayWs'

export function useChatConnectionUi(
  status: string,
  messages: ChatMessage[],
  sessionKey: string | null
) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showConnectingSpinner, setShowConnectingSpinner] = useState(false)

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const threshold = 80
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
    if (isNearBottom || sessionKey) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, sessionKey])

  useEffect(() => {
    const isConnecting = status === 'connecting' || status === 'handshaking'
    if (!isConnecting) {
      setShowConnectingSpinner(false)
      return
    }
    const timer = setTimeout(() => setShowConnectingSpinner(true), 400)
    return () => clearTimeout(timer)
  }, [status])

  return { messagesContainerRef, showConnectingSpinner }
}
