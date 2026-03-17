import { useState, useCallback } from 'react'
import { theme } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import StepWelcome from './StepWelcome'
import StepProvider from './StepProvider'
import StepChannel from './StepChannel'
import StepConfirm from './StepConfirm'
import StepLaunch from './StepLaunch'
import SetupActionBar from './SetupActionBar'
import logoSvg from '../../assets/logo.svg'
import LanguageSelect from '../../components/LanguageSelect'
import AppVersion from '../../components/AppVersion'

const { useToken } = theme

/** 向导共享状态 */
export interface SetupData {
  detection: Record<string, unknown> | null
  providerKey: string
  platformKey: string
  apiKey: string
  modelId: string
  channels: Record<string, Record<string, unknown>>
}

const INITIAL_DATA: SetupData = {
  detection: null,
  providerKey: '',
  platformKey: '',
  apiKey: '',
  modelId: '',
  channels: {},
}

function SetupPage(): React.ReactElement {
  const { token } = useToken()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [data, setData] = useState<SetupData>(INITIAL_DATA)

  const stepKeys = ['welcome', 'provider', 'channel', 'confirm', 'launch'] as const
  const stepTitles = stepKeys.map((k) => t(`setup.steps.${k}`))

  const updateData = useCallback((partial: Partial<SetupData>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, 4)), [])
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), [])
  const goToDashboard = useCallback(() => navigate('/dashboard'), [navigate])

  const providerCanContinue = !!data.apiKey && !!data.modelId && !!data.providerKey && !!data.platformKey
  const confirmCanContinue = true

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return <StepWelcome data={data} updateData={updateData} onNext={next} />
      case 1:
        return <StepProvider data={data} updateData={updateData} />
      case 2:
        return <StepChannel data={data} updateData={updateData} />
      case 3:
        return <StepConfirm data={data} />
      case 4:
        return <StepLaunch data={data} onDone={goToDashboard} />
      default:
        return null
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {/* 左侧品牌侧边栏 */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: 'linear-gradient(160deg, #1a0500 0%, #7A1A0F 50%, #CC3D21 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '32px 20px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 装饰光晕 */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            right: -80,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'rgba(255, 77, 42, 0.12)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo + 品牌名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <img src={logoSvg} alt="ClickClaw" style={{ width: 28, height: 28 }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
            ClickClaw
          </span>
        </div>

        {/* 步骤列表 */}
        <div style={{ flex: 1 }}>
          {stepTitles.map((title, index) => {
            const isDone = index < current
            const isActive = index === current

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  marginBottom: 4,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(255,255,255,0.13)' : 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                {/* 步骤圆圈 */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    background: isDone
                      ? 'rgba(82, 196, 26, 0.9)'
                      : isActive
                        ? '#fff'
                        : 'rgba(255,255,255,0.15)',
                    color: isActive ? '#CC3D21' : '#fff',
                    boxShadow: isActive ? '0 0 0 2px rgba(255,255,255,0.25)' : 'none',
                  }}
                >
                  {isDone ? <CheckOutlined style={{ fontSize: 10 }} /> : index + 1}
                </div>

                {/* 步骤名 */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isDone
                      ? 'rgba(255,255,255,0.55)'
                      : isActive
                        ? '#fff'
                        : 'rgba(255,255,255,0.32)',
                    lineHeight: 1.3,
                  }}
                >
                  {title}
                </span>
              </div>
            )
          })}
        </div>

        {/* 底部品牌署名 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.32)',
            letterSpacing: '0.02em',
          }}
        >
          <span>ClickClaw · OpenClaw</span>
          <AppVersion style={{ color: 'rgba(255,255,255,0.42)' }} />
        </div>
      </div>

      {/* 右侧内容区 */}
      <div
        style={{
          flex: 1,
          background: token.colorBgLayout,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '0 48px',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '16px 0 8px',
            background: `linear-gradient(180deg, ${token.colorBgLayout} 0%, ${token.colorBgLayout} 72%, transparent 100%)`,
          }}
        >
          <LanguageSelect />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '16px 0 24px',
          }}
        >
          {renderStepContent()}
        </div>

        {current === 1 && (
          <SetupActionBar
            primaryLabel={t('common.next')}
            onPrimary={next}
            onBack={prev}
            primaryDisabled={!providerCanContinue}
          />
        )}
        {current === 2 && (
          <SetupActionBar primaryLabel={t('common.next')} onPrimary={next} onBack={prev} />
        )}
        {current === 3 && (
          <SetupActionBar
            primaryLabel={t('setup.confirm.completeSetup')}
            onPrimary={next}
            onBack={prev}
            primaryDisabled={!confirmCanContinue}
          />
        )}
      </div>
    </div>
  )
}

export default SetupPage
