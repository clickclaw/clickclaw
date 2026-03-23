/**
 * 托盘弹出窗口页面
 * 通过 hash #/tray-popup 与主窗口共用同一 renderer，独立渲染
 */

import { useState, useEffect } from 'react'
import { Button, Divider } from 'antd'
import {
  PlayCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  RightOutlined,
  GlobalOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import logo from '../../assets/logo.svg'

type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: string }
type UpdateInfo = {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
  version?: string
  progress?: number
  error?: string
}

const BG = '#161616'
const BORDER = 'rgba(255,255,255,0.07)'
const WEBSITE_URL = 'https://www.clickclaw.cn'

export default function TrayPopupPage(): React.ReactElement {
  const { t } = useTranslation()
  const [gwState, setGwState] = useState<string>('stopped')
  const [port, setPort] = useState<number>(0)
  const [version, setVersion] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>({ status: 'idle' })

  useEffect(() => {
    Promise.all([
      window.api.gateway.getState(),
      window.api.gateway.getPort(),
      window.api.getVersion(),
      window.api.update.getInfo(),
    ]).then(([state, p, v, upd]) => {
      setGwState(state as string)
      setPort(p)
      setVersion(v)
      setUpdateInfo(upd as UpdateInfo)
    })

    const offStateChange = window.api.gateway.onStateChange((state) => {
      setGwState(state)
      if (state === 'running') {
        window.api.gateway.getPort().then(setPort)
      }
      setLoading(null)
    })

    const offUpdateStatus = window.api.update.onStatusChanged((info) => {
      setUpdateInfo(info as UpdateInfo)
    })

    return () => {
      offStateChange()
      offUpdateStatus()
    }
  }, [])

  const isRunning = gwState === 'running'
  const isStopped = gwState === 'stopped'
  const isTransitioning = gwState === 'starting' || gwState === 'stopping'

  const statusColor: Record<string, string> = {
    running: '#52c41a',
    stopped: '#595959',
    starting: '#faad14',
    stopping: '#faad14',
  }
  const dot = statusColor[gwState] ?? '#595959'

  const statusText: Record<string, string> = {
    running: t('tray.popup.statusRunning'),
    stopped: t('tray.popup.statusStopped'),
    starting: t('tray.popup.statusStarting'),
    stopping: t('tray.popup.statusStopping'),
  }

  const handleStart = (): void => {
    setLoading('start')
    window.api.gateway.start().catch(() => setLoading(null))
  }
  const handleStop = (): void => {
    setLoading('stop')
    window.api.gateway.stop().catch(() => setLoading(null))
  }
  const handleRestart = (): void => {
    setLoading('restart')
    window.api.gateway.restart().catch(() => setLoading(null))
  }

  const handleOpenWebUI = async (): Promise<void> => {
    if (!isRunning) return
    const token = await window.api.gateway.getToken()
    const url = `http://127.0.0.1:${port}/?token=${token}`
    window.api.shell.openExternal(url)
  }

  const handleCheckUpdate = (): void => {
    window.api.update.check()
  }
  const handleDownload = (): void => {
    window.api.update.download()
  }
  const handleInstall = (): void => {
    window.api.update.install()
  }

  // 检查更新：左侧文字内容
  const renderUpdateLabel = (): React.ReactNode => {
    const { status, version: ver } = updateInfo
    if (status === 'checking')
      return (
        <span
          style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <SyncOutlined spin style={{ fontSize: 12 }} />
          {t('tray.popup.updateChecking')}
        </span>
      )
    if (status === 'available')
      return (
        <span style={{ color: '#faad14' }}>
          {t('tray.popup.updateAvailable', { version: ver })}
        </span>
      )
    if (status === 'downloading')
      return (
        <span
          style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <SyncOutlined spin style={{ fontSize: 12 }} />
          {t('tray.popup.updateDownloading', { progress: updateInfo.progress ?? 0 })}
        </span>
      )
    if (status === 'downloaded')
      return (
        <span style={{ color: '#52c41a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThunderboltOutlined style={{ fontSize: 12 }} />
          {t('tray.popup.updateInstall')}
        </span>
      )
    if (status === 'not-available')
      return (
        <span
          style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <CheckCircleOutlined style={{ fontSize: 12, color: '#52c41a' }} />
          {t('tray.popup.updateLatest')}
        </span>
      )
    // idle / error
    return <span style={{ color: 'rgba(255,255,255,0.8)' }}>{t('tray.popup.checkUpdate')}</span>
  }

  // 检查更新：右侧图标（checking / downloading / not-available 时不显示）
  const renderUpdateRightIcon = (): React.ReactNode => {
    const { status } = updateInfo
    if (status === 'checking' || status === 'downloading' || status === 'not-available') return null
    return <RightOutlined style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }} />
  }

  const handleUpdateClick = (): void => {
    const { status } = updateInfo
    if (status === 'available') {
      handleDownload()
      return
    }
    if (status === 'downloaded') {
      handleInstall()
      return
    }
    if (status === 'checking' || status === 'downloading') return
    handleCheckUpdate()
  }

  return (
    <div
      style={
        {
          width: 280,
          minHeight: '100vh',
          background: BG,
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 13,
          userSelect: 'none',
          WebkitAppRegion: 'drag',
        } as ElectronStyle
      }
    >
      {/* ── 头部 ── */}
      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: `1px solid ${BORDER}`,
            WebkitAppRegion: 'drag',
          } as ElectronStyle
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={logo}
            alt="ClickClaw"
            width={20}
            height={20}
            style={{ filter: 'drop-shadow(0 0 5px rgba(255,77,42,0.5))' }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: 14,
              background: 'linear-gradient(135deg, #FF7A5C 0%, #FF4D2A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ClickClaw
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{version}</span>
      </div>

      {/* ── Gateway 状态 ── */}
      <div style={{ padding: '14px 16px 10px', WebkitAppRegion: 'no-drag' } as ElectronStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dot,
              boxShadow: isRunning ? `0 0 6px ${dot}` : 'none',
              flexShrink: 0,
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          />
          <span style={{ fontWeight: 600, color: '#fff' }}>{statusText[gwState] ?? gwState}</span>
          {isRunning && port > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>:{port}</span>
          )}
        </div>
      </div>

      {/* ── 控制按钮 ── */}
      <div
        style={
          {
            padding: '6px 16px 16px',
            display: 'flex',
            gap: 8,
            minHeight: 54,
            alignItems: 'center',
            WebkitAppRegion: 'no-drag',
          } as ElectronStyle
        }
      >
        {isStopped && (
          <Button
            type="primary"
            size="small"
            icon={<PlayCircleOutlined />}
            loading={loading === 'start'}
            onClick={handleStart}
            style={{ flex: 1, background: '#FF4D2A', borderColor: '#FF4D2A' }}
          >
            {t('tray.popup.start')}
          </Button>
        )}
        {isRunning && (
          <>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading === 'restart'}
              onClick={handleRestart}
              style={{
                flex: 1,
                background: 'transparent',
                borderColor: 'rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              {t('tray.popup.restart')}
            </Button>
            <Button
              size="small"
              danger
              icon={<PoweroffOutlined />}
              loading={loading === 'stop'}
              onClick={handleStop}
              style={{ flex: 1 }}
            >
              {t('tray.popup.stop')}
            </Button>
          </>
        )}
        {isTransitioning && (
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, lineHeight: '28px' }}>
            {t('tray.popup.processing')}
          </span>
        )}
      </div>

      <Divider style={{ margin: 0, borderColor: BORDER }} />

      {/* ── 打开主窗口 ── */}
      <MenuItem onClick={() => window.api.app.showMainWindow()}>
        <span
          style={{ color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <AppstoreOutlined style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }} />
          {t('tray.popup.openMainWindow')}
        </span>
        <RightOutlined style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }} />
      </MenuItem>

      {/* ── 打开 OpenClaw 控制台 ── */}
      <MenuItem onClick={handleOpenWebUI}>
        <span
          style={{
            color: isRunning ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <GlobalOutlined
            style={{
              fontSize: 13,
              color: isRunning ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)',
            }}
          />
          {t('tray.popup.openWebUI')}
        </span>
        {isRunning && <RightOutlined style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }} />}
      </MenuItem>

      <Divider style={{ margin: 0, borderColor: BORDER }} />

      {/* ── 打开官网 ── */}
      <MenuItem onClick={() => window.api.shell.openExternal(WEBSITE_URL)}>
        <span
          style={{ color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <GlobalOutlined style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }} />
          {t('tray.popup.website')}
        </span>
        <RightOutlined style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }} />
      </MenuItem>

      {/* ── 检查更新 ── */}
      <MenuItem onClick={handleUpdateClick}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SyncOutlined style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }} />
          {renderUpdateLabel()}
        </span>
        {renderUpdateRightIcon()}
      </MenuItem>

      <Divider style={{ margin: 0, borderColor: BORDER }} />

      {/* ── 退出 ── */}
      <MenuItem onClick={() => window.api.app.quit()}>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{t('tray.popup.quit')}</span>
      </MenuItem>
    </div>
  )
}

// ── 菜单行小组件 ──
function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={
        {
          padding: '11px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
          transition: 'background 0.1s',
          WebkitAppRegion: 'no-drag',
        } as ElectronStyle
      }
    >
      {children}
    </div>
  )
}
