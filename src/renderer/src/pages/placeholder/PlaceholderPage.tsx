import { Empty, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

const { Title } = Typography

interface PlaceholderPageProps {
  titleKey: string
}

function PlaceholderPage({ titleKey }: PlaceholderPageProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <div
      style={{
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px)',
      }}
    >
      <Title level={3}>{t(titleKey)}</Title>
      <Empty description={t('placeholder.description')} />
    </div>
  )
}

export default PlaceholderPage
