import { Button, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { NoSelectionStateProps } from '../agents-page.types'

export function NoSelectionState({ onCreate }: NoSelectionStateProps): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 10,
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 36, opacity: 0.25 }}>🤖</div>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        {t('agents.noSelection')}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('agents.noSelectionHint')}
      </Typography.Text>
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        size="small"
        onClick={onCreate}
        style={{ marginTop: 4 }}
      >
        {t('agents.create')}
      </Button>
    </div>
  )
}
