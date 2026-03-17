import type { CSSProperties } from 'react'

export const LOG_AREA_HEIGHT = 'calc(100vh - 200px)'
export const LOG_AREA_HEIGHT_WITH_TOOLBAR = 'calc(100vh - 240px)'
export const AUDIT_TABLE_HEIGHT = 'calc(100vh - 260px)'

export const logBoxStyle: CSSProperties = {
  overflowY: 'auto',
  background: '#141414',
  borderRadius: 6,
  padding: '8px 12px',
  fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace",
  fontSize: 12,
  lineHeight: '20px',
  border: '1px solid rgba(255,255,255,0.06)',
}

export function isErrorLine(line: string): boolean {
  const lower = line.toLowerCase()
  return lower.includes('[error]') || lower.includes('error:') || lower.includes('gateway:err')
}

export function colorForLine(line: string): string | undefined {
  const lower = line.toLowerCase()
  if (isErrorLine(line)) return '#ff4d4f'
  if (lower.includes('[warn]') || lower.includes('warning:')) return '#fa8c16'
  return undefined
}

export function parseLogTime(line: string): string {
  const m = line.match(/(\d{2}:\d{2}:\d{2})/)
  return m ? m[1] : ''
}

export function stripLogMeta(line: string): string {
  return line
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?\s*/, '')
    .replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, '')
    .replace(/^{"level":"[^"]*","time":[^,]+,/, '{')
    .trim()
}
