import { useEffect, useRef } from 'react'
import { Alert, Button, Modal, Spin, Tag } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { VetStepUI } from '../skills-page.types'

const RISK_COLORS: Record<VetResult['riskLevel'], { bg: string; border: string; text: string }> = {
  low: { bg: '#f6ffed', border: '#b7eb8f', text: '#52c41a' },
  medium: { bg: '#fffbe6', border: '#ffe58f', text: '#faad14' },
  high: { bg: '#fff7e6', border: '#ffd591', text: '#fa8c16' },
  extreme: { bg: '#fff1f0', border: '#ffa39e', text: '#ff4d4f' },
}

interface VetModalProps {
  open: boolean
  slug: string
  phase: 'progress' | 'result'
  steps: VetStepUI[]
  streamText: string
  error: string | null
  result: VetResult | null
  onConfirm: () => void
  onCancel: () => void
}

export function VetModal({
  open,
  slug,
  phase,
  steps,
  streamText,
  error,
  result,
  onConfirm,
  onCancel,
}: VetModalProps): React.ReactElement {
  const { t } = useTranslation()
  const streamEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamText])

  const renderStep = (step: VetStepUI): React.ReactElement => {
    let icon: React.ReactNode
    let color = '#bbb'

    switch (step.status) {
      case 'done':
        icon = <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 14 }} />
        color = '#52c41a'
        break
      case 'processing':
        icon = <Spin size="small" />
        color = '#1677ff'
        break
      case 'error':
        icon = <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
        color = '#ff4d4f'
        break
      default:
        icon = (
          <span
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '1.5px solid #d9d9d9',
            }}
          />
        )
    }

    return (
      <div
        key={step.key}
        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}
      >
        <span
          style={{ width: 18, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 13, color }}>{t(step.labelKey)}</span>
      </div>
    )
  }

  const colors = result ? RISK_COLORS[result.riskLevel] : RISK_COLORS.low
  const isExtreme = result?.riskLevel === 'extreme'

  const riskLabels: Record<VetResult['riskLevel'], string> = {
    low: t('skills.vetter.riskLow'),
    medium: t('skills.vetter.riskMedium'),
    high: t('skills.vetter.riskHigh'),
    extreme: t('skills.vetter.riskExtreme'),
  }

  const verdictLabels: Record<VetResult['verdict'], string> = {
    safe: t('skills.vetter.verdictSafe'),
    caution: t('skills.vetter.verdictCaution'),
    unsafe: t('skills.vetter.verdictUnsafe'),
  }

  const renderPermList = (label: string, items: string[]): React.ReactElement | null => {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: 4 }}>
        <span style={{ color: '#666', fontSize: 12 }}>{label}：</span>
        <span style={{ fontSize: 12 }}>{items.join('，')}</span>
      </div>
    )
  }

  return (
    <Modal
      open={open}
      title={t('skills.vetter.modalTitle')}
      footer={null}
      onCancel={onCancel}
      width={520}
      destroyOnHidden
      maskClosable={phase === 'result'}
    >
      {phase === 'progress' ? (
        <>
          <div style={{ marginBottom: 16, paddingTop: 4 }}>
            {steps.map((step) => renderStep(step))}
          </div>

          {streamText && (
            <div
              style={{
                background: '#1a1a1a',
                borderRadius: 6,
                padding: '10px 12px',
                maxHeight: 200,
                overflowY: 'auto',
                marginBottom: 16,
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#d4d4d4',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {streamText}
              <div ref={streamEndRef} />
            </div>
          )}

          {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button onClick={onCancel}>{t('skills.vetter.cancel')}</Button>
          </div>
        </>
      ) : (
        result && (
          <>
            <div
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Tag
                color={
                  result.riskLevel === 'low'
                    ? 'success'
                    : result.riskLevel === 'medium'
                      ? 'warning'
                      : 'error'
                }
                style={{ fontWeight: 600, fontSize: 12 }}
              >
                {riskLabels[result.riskLevel]}
              </Tag>
              <span style={{ color: colors.text, fontWeight: 500, fontSize: 13 }}>
                {verdictLabels[result.verdict]}
              </span>
              <span style={{ color: '#aaa', fontSize: 12, marginLeft: 'auto' }}>{slug}</span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                {t('skills.vetter.redFlags')}
              </div>
              {result.redFlags.length === 0 ? (
                <div style={{ color: '#52c41a', fontSize: 13 }}>
                  {t('skills.vetter.noRedFlags')}
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, color: colors.text }}>
                  {result.redFlags.map((flag, i) => (
                    <li key={i} style={{ fontSize: 13 }}>
                      {flag}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {(result.permissions.files.length > 0 ||
              result.permissions.network.length > 0 ||
              result.permissions.commands.length > 0) && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  {t('skills.vetter.permissions')}
                </div>
                {renderPermList(t('skills.vetter.filesLabel'), result.permissions.files)}
                {renderPermList(t('skills.vetter.networkLabel'), result.permissions.network)}
                {renderPermList(t('skills.vetter.commandsLabel'), result.permissions.commands)}
              </div>
            )}

            {result.notes && (
              <div style={{ color: '#595959', fontSize: 13, marginBottom: 14 }}>{result.notes}</div>
            )}

            {isExtreme && (
              <Alert
                type="error"
                message={t('skills.vetter.extremeWarning')}
                style={{ marginBottom: 14 }}
                showIcon
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={onCancel}>{t('skills.vetter.cancel')}</Button>
              <Button type="primary" danger={isExtreme} onClick={onConfirm}>
                {isExtreme ? t('skills.vetter.forceInstall') : t('skills.vetter.confirmInstall')}
              </Button>
            </div>
          </>
        )
      )}
    </Modal>
  )
}
