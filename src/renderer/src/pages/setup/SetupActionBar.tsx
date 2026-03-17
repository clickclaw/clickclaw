import { Button, Flex, theme } from 'antd'
import { useTranslation } from 'react-i18next'

interface SetupActionBarProps {
  primaryLabel: string
  onPrimary: () => void
  primaryDisabled?: boolean
  showBack?: boolean
  onBack?: () => void
}

function SetupActionBar({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  showBack = true,
  onBack,
}: SetupActionBarProps): React.ReactElement {
  const { token } = theme.useToken()
  const { t } = useTranslation()

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'center',
        padding: '16px 0 20px',
        background: `linear-gradient(0deg, ${token.colorBgLayout} 0%, ${token.colorBgLayout} 72%, transparent 100%)`,
      }}
    >
      <div style={{ width: '100%', maxWidth: 1120 }}>
        <Flex justify="space-between" align="center" gap={16}>
          <div>
            {showBack ? <Button onClick={onBack}>{t('common.prev')}</Button> : <div />}
          </div>
          <Button type="primary" onClick={onPrimary} disabled={primaryDisabled}>
            {primaryLabel}
          </Button>
        </Flex>
      </div>
    </div>
  )
}

export default SetupActionBar
