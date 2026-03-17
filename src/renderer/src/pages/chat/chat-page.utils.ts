import type { AttachmentPayload } from '../../hooks/useGatewayWs'
import type { UploadFile } from 'antd'

export function colorForLine(line: string): string | undefined {
  const lower = line.toLowerCase()
  if (lower.includes('[error]') || lower.includes('error:') || lower.includes('gateway:err')) {
    return '#ff4d4f'
  }
  if (lower.includes('[warn]') || lower.includes('warning:')) {
    return '#fa8c16'
  }
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

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      const match = /^data:[^;]+;base64,(.+)$/.exec(result)
      if (match) resolve(match[1])
      else reject(new Error('base64 parse failed'))
    }
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

export async function buildAttachmentPayloads(files: UploadFile[]): Promise<AttachmentPayload[]> {
  return Promise.all(
    files.map(async (f) => {
      const base64 = f.originFileObj ? await fileToBase64(f.originFileObj) : ''
      const mime = f.type || 'application/octet-stream'
      const category: AttachmentPayload['category'] = mime.startsWith('image/')
        ? 'image'
        : 'document'
      return { category, mimeType: mime, fileName: f.name, content: base64 }
    })
  )
}
