import { useTranslation } from 'react-i18next'
import { useErrorLogs } from '../hooks/useErrorLogs'
import { LOG_AREA_HEIGHT, logBoxStyle } from '../logs-page.utils'
import { LogLine } from './LogLine'

export function ErrorLogsTab(): React.ReactElement {
  const { t } = useTranslation()
  const { errors } = useErrorLogs()

  return (
    <div style={{ ...logBoxStyle, height: LOG_AREA_HEIGHT }}>
      {errors.length === 0 ? (
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>{t('logs.noErrors')}</span>
      ) : (
        errors.map((line, i) => <LogLine key={i} line={line} color="#ff4d4f" />)
      )}
    </div>
  )
}
