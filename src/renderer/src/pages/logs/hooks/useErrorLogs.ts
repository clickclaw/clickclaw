import { useEffect, useState } from 'react'
import { isErrorLine } from '../logs-page.utils'

export function useErrorLogs() {
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    window.api.gateway.getLogBuffer().then((buf) => {
      const errs = buf.filter((line) => isErrorLine(line))
      if (errs.length > 0) setErrors(errs)
    })

    const offLog = window.api.gateway.onLog((line) => {
      if (isErrorLine(line)) {
        setErrors((prev) => {
          const next = [...prev, line]
          return next.length > 200 ? next.slice(-200) : next
        })
      }
    })
    return () => {
      offLog()
    }
  }, [])

  return { errors }
}
