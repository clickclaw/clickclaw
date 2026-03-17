import type { LogLineProps } from '../logs-page.types'
import { parseLogTime, stripLogMeta } from '../logs-page.utils'

export function LogLine({ line, color }: LogLineProps): React.ReactElement {
  const time = parseLogTime(line)
  const text = stripLogMeta(line) || line
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {time && (
        <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, userSelect: 'none' }}>
          {time}
        </span>
      )}
      <span style={{ color, wordBreak: 'break-all' }}>{text}</span>
    </div>
  )
}
