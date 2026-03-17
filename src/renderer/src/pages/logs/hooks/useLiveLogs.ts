import { useEffect, useRef, useState } from 'react'

export function useLiveLogs() {
  const [lines, setLines] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const userScrolledUp = useRef(false)

  useEffect(() => {
    window.api.gateway.getLogBuffer().then((buf) => {
      if (buf.length > 0) setLines(buf)
    })
    const offLog = window.api.gateway.onLog((line) => {
      setLines((prev) => {
        const next = [...prev, line]
        return next.length > 500 ? next.slice(-500) : next
      })
    })
    return () => {
      offLog()
    }
  }, [])

  useEffect(() => {
    const box = boxRef.current
    if (!box || userScrolledUp.current) return
    box.scrollTop = box.scrollHeight
  }, [lines])

  const handleScroll = (): void => {
    const box = boxRef.current
    if (!box) return
    const distFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight
    userScrolledUp.current = distFromBottom > 80
  }

  const clear = (): void => setLines([])

  return {
    lines,
    boxRef,
    handleScroll,
    clear,
  }
}
