/**
 * 自定义标题栏
 * - 横跨全宽，40px 高度，与侧边栏颜色无缝融合
 * - macOS：红绿灯由系统渲染，左侧留出空位
 * - Windows/Linux：右侧渲染自定义最小化/最大化/关闭按钮
 */

import { useState, useEffect } from 'react'
import { MinusOutlined, CloseOutlined, SwitcherOutlined, BorderOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import logo from '../assets/logo.svg'

// 与 Ant Design 深色侧边栏背景一致，实现无缝融合
const BAR_BG = '#001529'
export const TITLE_BAR_HEIGHT = 40

type GatewayState = 'stopped' | 'starting' | 'running' | 'stopping'
type ElectronStyle = React.CSSProperties & { WebkitAppRegion?: string }

/** Gateway 状态指示点 + 文字 */
function GatewayBadge({ state }: { state: GatewayState }): React.ReactElement {
  const { t } = useTranslation()

  const config: Record<GatewayState, { color: string; label: string; pulse: boolean }> = {
    running: { color: '#52c41a', label: t('titleBar.gwRunning'), pulse: false },
    starting: { color: '#faad14', label: t('titleBar.gwStarting'), pulse: true },
    stopping: { color: '#faad14', label: t('titleBar.gwStopping'), pulse: true },
    stopped: { color: 'rgba(255,255,255,0.25)', label: t('titleBar.gwStopped'), pulse: false },
  }
  const { color, label, pulse } = config[state]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        marginLeft: 10,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.06)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
          animation: pulse ? 'gw-pulse 1.2s ease-in-out infinite' : undefined,
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: state === 'running' ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
          letterSpacing: 0.2,
        }}
      >
        {label}
      </span>

      <style>{`
        @keyframes gw-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

function WinButton({
  onClick,
  danger = false,
  title,
  children,
}: {
  onClick: () => void
  danger?: boolean
  title?: string
  children: React.ReactNode
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={
        {
          width: 46,
          height: TITLE_BAR_HEIGHT,
          border: 'none',
          background: hovered ? (danger ? '#c42b1c' : 'rgba(255,255,255,0.08)') : 'transparent',
          color: hovered && danger ? '#fff' : 'rgba(255,255,255,0.7)',
          cursor: 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.1s, color 0.1s',
          WebkitAppRegion: 'no-drag',
        } as ElectronStyle
      }
    >
      {children}
    </button>
  )
}

export default function TitleBar(): React.ReactElement {
  const platform = window.api.win.platform
  const isMac = platform === 'darwin'
  const isWin = platform === 'win32' || platform === 'linux'

  const [maximized, setMaximized] = useState(false)
  const [gwState, setGwState] = useState<GatewayState>('stopped')

  useEffect(() => {
    if (!isWin) return
    window.api.win.isMaximized().then(setMaximized)
  }, [isWin])

  // 直接订阅 IPC，独立于 GatewayContext
  useEffect(() => {
    window.api.gateway.getState().then((s) => setGwState(s as GatewayState))
    const offStateChange = window.api.gateway.onStateChange((s) => setGwState(s as GatewayState))
    return () => {
      offStateChange()
    }
  }, [])

  return (
    <div
      style={
        {
          height: TITLE_BAR_HEIGHT,
          background: BAR_BG,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'drag',
          userSelect: 'none',
        } as ElectronStyle
      }
    >
      {/* macOS 红绿灯占位（约 76px） */}
      {isMac && <div style={{ width: 76, flexShrink: 0 }} />}

      {/* Logo + 应用名 + Gateway 状态 */}
      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingLeft: isMac ? 0 : 16,
            WebkitAppRegion: 'no-drag',
          } as ElectronStyle
        }
      >
        <img
          src={logo}
          alt="ClickClaw"
          style={{
            width: 22,
            height: 22,
            filter: 'drop-shadow(0 0 6px rgba(255,77,42,0.5))',
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.3,
            background: 'linear-gradient(135deg, #FF7A5C 0%, #FF4D2A 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          ClickClaw
        </span>

        <GatewayBadge state={gwState} />
      </div>

      {/* 弹性占位 */}
      <div style={{ flex: 1 }} />

      {/* Windows/Linux 窗口控制按钮 */}
      {isWin && (
        <div
          style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as ElectronStyle}
        >
          <WinButton title="最小化" onClick={() => window.api.win.minimize()}>
            <MinusOutlined style={{ fontSize: 11 }} />
          </WinButton>
          <WinButton
            title={maximized ? '向下还原' : '最大化'}
            onClick={() => {
              window.api.win.maximize()
              setMaximized((v) => !v)
            }}
          >
            {maximized ? (
              <SwitcherOutlined style={{ fontSize: 11 }} />
            ) : (
              <BorderOutlined style={{ fontSize: 11 }} />
            )}
          </WinButton>
          <WinButton title="关闭" danger onClick={() => window.api.win.close()}>
            <CloseOutlined style={{ fontSize: 11 }} />
          </WinButton>
        </div>
      )}
    </div>
  )
}
