import { useCallback, useRef, useState } from 'react'
import type { UploadFile } from 'antd'
import type { AttachmentPayload } from '../../../hooks/useGatewayWs'
import { buildAttachmentPayloads } from '../chat-page.utils'

interface UseChatComposerArgs {
  sendMessage: (text: string, attachments?: AttachmentPayload[]) => void
}

export function useChatComposer({ sendMessage }: UseChatComposerArgs) {
  const [inputValue, setInputValue] = useState('')
  const [attachFiles, setAttachFiles] = useState<UploadFile[]>([])
  const [attachOpen, setAttachOpen] = useState(false)
  const attachRef = useRef(null)

  const handleSend = useCallback(
    (text: string): void => {
      if (!text.trim() && !attachFiles.length) return

      const doSend = async (): Promise<void> => {
        let payloads: AttachmentPayload[] | undefined
        if (attachFiles.length > 0) {
          payloads = await buildAttachmentPayloads(attachFiles)
          setAttachFiles([])
          setAttachOpen(false)
        }
        sendMessage(text, payloads)
      }

      setInputValue('')
      doSend()
    },
    [attachFiles, sendMessage]
  )

  const handleCommandSelect = useCallback((itemVal: string) => {
    setInputValue(itemVal + ' ')
  }, [])

  return {
    inputValue,
    setInputValue,
    attachFiles,
    setAttachFiles,
    attachOpen,
    setAttachOpen,
    attachRef,
    handleSend,
    handleCommandSelect,
  }
}
