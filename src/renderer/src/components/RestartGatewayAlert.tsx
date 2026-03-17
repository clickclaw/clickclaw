/**
 * 通用"配置已更新，需重启 Gateway"提示条
 *
 * 用法：
 *   const [needsRestart, setNeedsRestart] = useState(false)
 *   <RestartGatewayAlert show={needsRestart} onDismiss={() => setNeedsRestart(false)} />
 */

import { useState } from 'react'
import { Alert, Button, App } from 'antd'
import { useTranslation } from 'react-i18next'

interface RestartGatewayAlertProps {
  show: boolean
  onDismiss: () => void
  style?: React.CSSProperties
}

export function RestartGatewayAlert({
  show,
  onDismiss,
  style,
}: RestartGatewayAlertProps): React.ReactElement | null {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [restarting, setRestarting] = useState(false)

  if (!show) return null

  const handleRestart = async () => {
    setRestarting(true)
    try {
      const result = await window.api.gateway.restart()
      if (result.success) {
        onDismiss()
        message.success(t('common.restartSuccess'))
      } else {
        message.error(result.error || t('common.restartFailed'))
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('common.restartFailed'))
    } finally {
      setRestarting(false)
    }
  }

  return (
    <Alert
      type="warning"
      showIcon
      style={{ borderRadius: 8, ...style }}
      message={t('common.restartRequired')}
      action={
        <Button size="small" loading={restarting} onClick={handleRestart}>
          {t('common.restartGateway')}
        </Button>
      }
      closable
      onClose={onDismiss}
    />
  )
}
