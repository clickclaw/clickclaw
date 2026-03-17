import { useState, useEffect } from 'react'
import { ConfigProvider, theme, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SetupPage from './pages/setup/SetupPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ChatPage from './pages/chat/ChatPage'
import AgentPage from './pages/agents/AgentPage'
import ModelPage from './pages/models/ModelPage'
import ChannelsPage from './pages/channels/ChannelsPage'
import SettingsPage from './pages/settings/SettingsPage'
import AboutPage from './pages/about/AboutPage'
import LogsPage from './pages/logs/LogsPage'
import BackupPage from './pages/backup/BackupPage'
import SkillsPage from './pages/skills/SkillsPage'
import CronPage from './pages/cron/CronPage'
import MainLayout from './layouts/MainLayout'
import ConfigFoundDialog from './components/ConfigFoundDialog'
import TrayPopupPage from './pages/tray/TrayPopupPage'
import { PairingApprovalModal } from './components/PairingApprovalModal'
import logo from './assets/logo.svg'

// ─── 托盘弹窗入口（独立渲染，不走主应用路由流程）───────────────────────

function TrayApp(): React.ReactElement {
  const { i18n } = useTranslation()
  const antdLocale = i18n.language === 'en' ? enUS : zhCN
  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{ token: { colorPrimary: '#FF4D2A', borderRadius: 8 } }}
    >
      <TrayPopupPage />
    </ConfigProvider>
  )
}

// ─── 主应用入口 ──────────────────────────────────────────────────────────

function MainApp(): React.ReactElement {
  const [isDark] = useState(false)
  const { t, i18n } = useTranslation()
  const [initialRoute, setInitialRoute] = useState<string | null>(null)
  const [showConfigConfirm, setShowConfigConfirm] = useState(false)
  const [detection, setDetection] = useState<Record<string, unknown> | null>(null)
  const [autoStartGateway, setAutoStartGateway] = useState(true)

  useEffect(() => {
    Promise.all([window.api.app.getInitialRoute(), window.api.appState.get()]).then(
      ([result, appState]) => {
        setDetection(result.detection as unknown as Record<string, unknown>)
        setAutoStartGateway(appState.autoStartGateway !== false)

        if (result.route === '/dashboard') {
          setInitialRoute('/dashboard')
          if (appState.autoStartGateway !== false) {
            window.api.app.autoStartGateway()
          }
        } else if (result.hasConfig) {
          setShowConfigConfirm(true)
        } else {
          setInitialRoute('/setup')
        }
      }
    )
  }, [])

  const antdLocale = i18n.language === 'en' ? enUS : zhCN

  // Loading 闪屏
  if (!initialRoute && !showConfigConfirm) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(160deg, #1a0d09 0%, #120808 60%, #0d0d0d 100%)',
          gap: 0,
        }}
      >
        <style>{`
          @keyframes cc-shimmer {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          @keyframes cc-fadein {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            animation: 'cc-fadein 0.5s ease both',
          }}
        >
          <img
            src={logo}
            alt="ClickClaw"
            style={{
              width: 72,
              height: 72,
              filter: 'drop-shadow(0 0 20px rgba(255,77,42,0.4))',
            }}
          />
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 1,
              color: '#fff',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            ClickClaw
          </span>
        </div>

        <div
          style={{
            marginTop: 40,
            width: 200,
            height: 2,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
            animation: 'cc-fadein 0.5s 0.15s ease both',
            opacity: 0,
          }}
        >
          <div
            style={{
              width: '50%',
              height: '100%',
              borderRadius: 2,
              background: 'linear-gradient(90deg, transparent, #FF4D2A, #FF7A5C, transparent)',
              animation: 'cc-shimmer 1.4s ease-in-out infinite',
            }}
          />
        </div>

        <span
          style={{
            marginTop: 20,
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: 0.5,
            animation: 'cc-fadein 0.5s 0.3s ease both',
            opacity: 0,
          }}
        >
          {t('app.detecting')}
        </span>
      </div>
    )
  }

  // 弹确认框：检测到现有配置
  if (showConfigConfirm && detection) {
    const det = detection as {
      existingConfig?: { hasProviders?: boolean; hasChannels?: boolean; agentCount?: number }
    }
    return (
      <ConfigProvider
        locale={antdLocale}
        theme={{
          token: { colorPrimary: '#FF4D2A', borderRadius: 8 },
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
        <ConfigFoundDialog
          detection={{
            hasProviders: det.existingConfig?.hasProviders ?? false,
            hasChannels: det.existingConfig?.hasChannels ?? false,
            agentCount: det.existingConfig?.agentCount ?? 0,
          }}
          onUseExisting={() => {
            window.api.appState
              .set({ hasSeenConfigFoundDialog: true, setupCompleted: true })
              .catch(() => {})
            setShowConfigConfirm(false)
            setInitialRoute('/dashboard')
            if (autoStartGateway) {
              window.api.app.autoStartGateway()
            }
          }}
          onReconfigure={() => {
            window.api.appState.set({ hasSeenConfigFoundDialog: true }).catch(() => {})
            window.location.hash = '/setup'
            setShowConfigConfirm(false)
            setInitialRoute('/setup')
          }}
        />
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: { colorPrimary: '#FF4D2A', borderRadius: 8 },
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <AntdApp>
        <HashRouter>
          <Routes>
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/" element={<Navigate to={initialRoute!} replace />} />
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/agents" element={<AgentPage />} />
              <Route path="/channels" element={<ChannelsPage />} />
              <Route path="/models" element={<ModelPage />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/cron" element={<CronPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Route>
            <Route path="*" element={<Navigate to={initialRoute!} replace />} />
          </Routes>
        </HashRouter>
        {/* 全局配对审批弹窗：只在主应用（dashboard + 以后各页）中挂载 */}
        <PairingApprovalModal />
      </AntdApp>
    </ConfigProvider>
  )
}

// ─── 根组件：按 hash 决定渲染哪个入口 ──────────────────────────────────

function App(): React.ReactElement {
  if (window.location.hash === '#/tray-popup') {
    return <TrayApp />
  }
  return <MainApp />
}

export default App
