import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Empty, Input, Popover, Skeleton, Spin, Typography } from 'antd'
import {
  ClockCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { AgentFilesTabProps } from '../agents-page.types'
import { FILE_DESCRIPTIONS } from '../agents-page.utils'

export function AgentFilesTab({
  agentId,
  wsReady,
  callRpc,
}: AgentFilesTabProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [files, setFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string>('')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [listLoading, setListLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const loadedRef = useRef<Set<string>>(new Set())

  const loadFileList = useCallback(
    async (aid: string): Promise<void> => {
      setListLoading(true)
      setListError(null)
      setFiles([])
      setActiveFile('')
      setContents({})
      setDrafts({})
      loadedRef.current = new Set()
      try {
        const res = (await callRpc('agents.files.list', { agentId: aid })) as {
          files: { name: string }[]
        } | null
        if (res?.files && res.files.length > 0) {
          const names = res.files.map((f) => f.name)
          setFiles(names)
          setActiveFile(names[0])
        }
      } catch (err) {
        setListError(String(err))
      } finally {
        setListLoading(false)
      }
    },
    [callRpc]
  )

  const loadFileContent = useCallback(
    async (aid: string, name: string): Promise<void> => {
      const key = `${aid}/${name}`
      if (loadedRef.current.has(key)) return
      loadedRef.current.add(key)
      setFileLoading(true)
      try {
        const res = (await callRpc('agents.files.get', { agentId: aid, name })) as {
          file?: { content?: string }
        } | null
        const content = res?.file?.content ?? ''
        setContents((prev) => ({ ...prev, [name]: content }))
        setDrafts((prev) => ({ ...prev, [name]: content }))
      } catch (err) {
        loadedRef.current.delete(key)
        message.error(t('agents.files.loadFailed', { error: String(err) }))
      } finally {
        setFileLoading(false)
      }
    },
    [callRpc, message, t]
  )

  useEffect(() => {
    if (!wsReady) {
      setFiles([])
      setActiveFile('')
      setContents({})
      setDrafts({})
      setListError(null)
      loadedRef.current = new Set()
      return
    }
    loadFileList(agentId)
  }, [agentId, wsReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeFile && wsReady) loadFileContent(agentId, activeFile)
  }, [activeFile, agentId, wsReady]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (): Promise<void> => {
    if (!activeFile || !wsReady) return
    setSaving(true)
    try {
      await callRpc('agents.files.set', {
        agentId,
        name: activeFile,
        content: drafts[activeFile] ?? '',
      })
      setContents((prev) => ({ ...prev, [activeFile]: drafts[activeFile] ?? '' }))
      message.success(t('agents.files.saveSuccess'))
    } catch (err) {
      message.error(t('agents.files.saveFailed', { error: String(err) }))
    } finally {
      setSaving(false)
    }
  }

  const isDirty =
    !!activeFile &&
    drafts[activeFile] !== undefined &&
    drafts[activeFile] !== (contents[activeFile] ?? '')

  if (!wsReady) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 28 }}>🔌</div>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('agents.files.wsRequired')}
        </Typography.Text>
      </div>
    )
  }

  if (listLoading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Spin size="small" />
        <div style={{ marginTop: 10, fontSize: 12, color: '#aaa' }}>
          {t('agents.files.loading')}
        </div>
      </div>
    )
  }

  if (listError) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <Typography.Text type="danger" style={{ fontSize: 13 }}>
          {t('agents.files.loadFailed', { error: listError })}
        </Typography.Text>
        <div style={{ marginTop: 12 }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => loadFileList(agentId)}>
            {t('agents.files.retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div style={{ padding: '32px 0' }}>
        <Empty
          image={<FileTextOutlined style={{ fontSize: 36, color: '#d9d9d9' }} />}
          imageStyle={{ height: 44 }}
          description={
            <div>
              <div style={{ fontSize: 13, color: '#595959', marginBottom: 4 }}>
                {t('agents.files.noFiles')}
              </div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{t('agents.files.noFilesHint')}</div>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: 160,
          flexShrink: 0,
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            padding: '12px 12px 6px',
            fontSize: 11,
            color: '#aaa',
            fontWeight: 600,
            letterSpacing: '0.05em',
            flexShrink: 0,
          }}
        >
          {t('agents.tabs.files').toUpperCase()}
        </div>
        {files.map((name) => {
          const isActive = name === activeFile
          const isFileDirty = drafts[name] !== undefined && drafts[name] !== (contents[name] ?? '')
          const fileMeta = FILE_DESCRIPTIONS[name]
          const popoverContent = fileMeta ? (
            <div style={{ maxWidth: 260 }}>
              <div style={{ fontSize: 13, color: '#262626', lineHeight: 1.6 }}>
                {t(fileMeta.descKey)}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#8c8c8c',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 4,
                }}
              >
                <span style={{ flexShrink: 0 }}>
                  <ClockCircleOutlined style={{ fontSize: 10 }} />
                </span>
                <span>{t(fileMeta.whenKey)}</span>
              </div>
            </div>
          ) : null
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                borderLeft: `2px solid ${isActive ? '#FF4D2A' : 'transparent'}`,
              }}
            >
              <button
                onClick={() => setActiveFile(name)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 0,
                  padding: '8px 10px 8px 8px',
                  border: 'none',
                  background: isActive ? '#FF4D2A08' : 'transparent',
                  cursor: 'pointer',
                  color: isActive ? '#FF4D2A' : '#595959',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 12,
                  textAlign: 'left',
                }}
              >
                <FileTextOutlined style={{ fontSize: 11, flexShrink: 0 }} />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </span>
                {isFileDirty && (
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#FF7A5C',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
              {popoverContent && (
                <Popover
                  content={popoverContent}
                  title={<span style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>}
                  trigger="click"
                  placement="rightTop"
                  overlayStyle={{ maxWidth: 300 }}
                >
                  <InfoCircleOutlined
                    style={{
                      padding: '0 8px',
                      fontSize: 11,
                      color: isActive ? '#FF4D2A99' : '#d9d9d9',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popover>
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px 0' }}>
          {fileLoading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : (
            <Input.TextArea
              value={drafts[activeFile] ?? ''}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [activeFile]: e.target.value }))}
              style={{
                height: '100%',
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, 'Courier New', monospace",
                fontSize: 13,
                lineHeight: 1.65,
                resize: 'none',
                borderColor: isDirty ? '#FF4D2A55' : undefined,
              }}
            />
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '10px 20px',
            borderTop: '1px solid #f0f0f0',
            flexShrink: 0,
          }}
        >
          <Button
            size="small"
            onClick={() => setDrafts((p) => ({ ...p, [activeFile]: contents[activeFile] ?? '' }))}
            disabled={!isDirty}
          >
            {t('agents.files.discardBtn')}
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!isDirty}
            onClick={handleSave}
            style={isDirty ? { background: '#FF4D2A', borderColor: '#FF4D2A' } : {}}
          >
            {t('agents.files.saveBtn')}
          </Button>
        </div>
      </div>
    </div>
  )
}
