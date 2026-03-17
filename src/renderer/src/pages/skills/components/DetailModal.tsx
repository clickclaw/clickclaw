import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Divider, Modal, Space, Spin, Tabs, Tag, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { buildMissingHint, resolveSourceTag } from '../skills-page.utils'

const { Title, Text } = Typography

interface DetailModalProps {
  skill: InstalledSkillInfo | null
  onClose: () => void
}

export const DetailModal = memo(function DetailModal({
  skill,
  onClose,
}: DetailModalProps): React.ReactElement {
  const { t } = useTranslation()
  const [mdContent, setMdContent] = useState<string | null>(null)
  const [mdLoading, setMdLoading] = useState(false)
  const [mdError, setMdError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    if (!skill) return
    const t0 = performance.now()
    const fromClick = performance.getEntriesByName('detail-click').at(-1)
    if (fromClick) {
      console.log(
        `[perf] skill prop received in DetailModal: +${(t0 - fromClick.startTime).toFixed(1)}ms from click`
      )
    }
    setActiveTab('info')
    setMdContent(null)
    setMdError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.baseDir])

  const loadMd = useCallback(async () => {
    if (!skill) return
    setMdLoading(true)
    setMdError(null)
    try {
      const content = await window.api.skill.readMd(skill.filePath)
      setMdContent(content)
    } catch (err) {
      setMdError(String(err))
    } finally {
      setMdLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.filePath])

  useEffect(() => {
    if (activeTab === 'md' && skill && mdContent === null && !mdLoading) {
      loadMd()
    }
  }, [activeTab, skill, mdContent, mdLoading, loadMd])

  const infoContent = useMemo(() => {
    if (!skill) return null
    const t0 = performance.now()
    const fromClick = performance.getEntriesByName('detail-click').at(-1)
    if (fromClick) {
      console.log(
        `[perf] infoContent useMemo start: +${(t0 - fromClick.startTime).toFixed(1)}ms from click`
      )
    }
    const { label: srcLabel, color: srcColor } = resolveSourceTag(skill)
    const missingHint = buildMissingHint(skill.missing, t)
    return (
      <div>
        <Space align="start" style={{ marginBottom: 12 }}>
          {skill.emoji && <span style={{ fontSize: 32 }}>{skill.emoji}</span>}
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {skill.name}
            </Title>
            {skill.description && <Text type="secondary">{skill.description}</Text>}
          </div>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div>
            <Text type="secondary">{t('skills.detail.source')}：</Text>
            <Tag color={srcColor} style={{ fontSize: 11 }}>
              {t(`skills.source.${skill.rawSource ?? skill.source}`, { defaultValue: srcLabel })}
            </Tag>
          </div>
          {skill.version && (
            <div>
              <Text type="secondary">{t('skills.detail.version')}：</Text>
              <Text>{skill.version}</Text>
            </div>
          )}
          {skill.skillKey && (
            <div>
              <Text type="secondary">Config Key：</Text>
              <Text code>{skill.skillKey}</Text>
            </div>
          )}
          {skill.primaryEnv && (
            <div>
              <Text type="secondary">API Key {t('skills.detail.variable')}：</Text>
              <Text code>{skill.primaryEnv}</Text>
            </div>
          )}
          <div>
            <Text type="secondary">{t('skills.detail.status')}：</Text>
            {skill.eligible === false ? (
              <Tag color="orange">{t('skills.notReady')}</Tag>
            ) : (
              <Tag color="green">{t('skills.detail.ready')}</Tag>
            )}
            {skill.always && (
              <Tag color="cyan" style={{ marginLeft: 4 }}>
                {t('skills.alwaysEnabled')}
              </Tag>
            )}
          </div>
          {skill.eligible === false && missingHint && (
            <div>
              <Text type="secondary">{t('skills.notReadyHint')}</Text>
              <pre
                style={{
                  fontSize: 12,
                  margin: '4px 0 0',
                  background: 'rgba(0,0,0,0.04)',
                  padding: '6px 10px',
                  borderRadius: 4,
                }}
              >
                {missingHint}
              </pre>
            </div>
          )}
          {skill.error && (
            <div>
              <Text type="danger" style={{ fontSize: 12 }}>
                {t('skills.skillError', { msg: skill.error })}
              </Text>
            </div>
          )}
          <div>
            <Text type="secondary">{t('skills.detail.path')}：</Text>
            <Text code style={{ fontSize: 11, wordBreak: 'break-all' }}>
              {skill.baseDir}
            </Text>
          </div>
        </Space>
      </div>
    )
  }, [skill, t])

  const mdTabContent = useMemo(() => {
    if (mdLoading)
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      )
    if (mdError) return <Alert type="error" message={mdError} />
    return (
      <pre
        style={{
          fontSize: 12,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: 0,
          maxHeight: 400,
          overflow: 'auto',
          background: 'rgba(0,0,0,0.03)',
          padding: '12px 16px',
          borderRadius: 4,
        }}
      >
        {mdContent ?? ''}
      </pre>
    )
  }, [mdLoading, mdError, mdContent])

  const tabItems = useMemo(() => {
    const t0 = performance.now()
    const fromClick = performance.getEntriesByName('detail-click').at(-1)
    if (fromClick) {
      console.log(
        `[perf] tabItems useMemo start: +${(t0 - fromClick.startTime).toFixed(1)}ms from click`
      )
    }
    return [
      { key: 'info', label: t('skills.detail.tabInfo'), children: infoContent },
      { key: 'md', label: 'SKILL.md', children: mdTabContent },
    ]
  }, [infoContent, mdTabContent, t])

  return (
    <Modal
      open={!!skill}
      onCancel={onClose}
      footer={null}
      title={skill?.name ?? ''}
      width={600}
      destroyOnClose={false}
      afterOpenChange={(open) => {
        if (open) {
          const t0 = performance.now()
          const fromClick = performance.getEntriesByName('detail-click').at(-1)
          if (fromClick) {
            console.log(
              `[perf] Modal afterOpenChange(true) - animation done: +${(t0 - fromClick.startTime).toFixed(1)}ms from click`
            )
          }
        }
      }}
    >
      {skill && (
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
      )}
    </Modal>
  )
})
