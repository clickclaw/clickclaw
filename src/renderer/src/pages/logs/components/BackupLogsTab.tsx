import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LOG_AREA_HEIGHT, logBoxStyle } from '../logs-page.utils'
import { LogLine } from './LogLine'

export function BackupLogsTab(): React.ReactElement {
  const { t } = useTranslation()
  const [lines, setLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.log.readClickclaw().then((all) => {
      setLines(all.filter((l) => l.toLowerCase().includes('[backup]')))
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ ...logBoxStyle, height: LOG_AREA_HEIGHT }}>
      {loading ? (
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('common.loading')}</span>
      ) : lines.length === 0 ? (
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('logs.noBackupLogs')}</span>
      ) : (
        lines.map((line, i) => <LogLine key={i} line={line} color="rgba(255,255,255,0.75)" />)
      )}
    </div>
  )
}
