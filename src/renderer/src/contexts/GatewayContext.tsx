/**
 * GatewayContext — 全局单例 Gateway 状态
 *
 * 放在 MainLayout 层，页面切换时不重建 WebSocket 连接。
 * ChatPage 和 DashboardPage 都从此读取状态，无需各自初始化。
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { useGatewayWs } from '../hooks/useGatewayWs'
import type { UseGatewayWsReturn } from '../hooks/useGatewayWs'

export type GatewayProcessState = 'stopped' | 'starting' | 'running' | 'stopping'

export interface GatewayContextValue extends UseGatewayWsReturn {
  /** Gateway 进程状态（来自主进程 IPC，比 gatewayRunning 更细粒度） */
  gwState: GatewayProcessState
  /** Gateway 监听端口（running 时有值） */
  gwPort: number
}

const GatewayContext = createContext<GatewayContextValue | null>(null)

export function GatewayProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const ws = useGatewayWs()
  const [gwState, setGwState] = useState<GatewayProcessState>('stopped')
  const [gwPort, setGwPort] = useState(0)

  useEffect(() => {
    // 获取初始进程状态
    window.api.gateway.getState().then((state) => {
      setGwState(state as GatewayProcessState)
      if (state === 'running') window.api.gateway.getPort().then(setGwPort)
    })
    // 订阅进程状态变更
    const offStateChange = window.api.gateway.onStateChange((state) => {
      setGwState(state as GatewayProcessState)
      if (state === 'running') {
        window.api.gateway.getPort().then(setGwPort)
      } else {
        setGwPort(0)
      }
    })

    return () => {
      offStateChange()
    }
  }, [])

  return (
    <GatewayContext.Provider value={{ ...ws, gwState, gwPort }}>{children}</GatewayContext.Provider>
  )
}

export function useGatewayContext(): GatewayContextValue {
  const ctx = useContext(GatewayContext)
  if (!ctx) throw new Error('useGatewayContext must be used within GatewayProvider')
  return ctx
}
