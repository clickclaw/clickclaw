import { FolderOpenOutlined } from '@ant-design/icons'
import { Button, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import type { LogsSectionProps } from '../settings-page.types'
import { Section, SettingRow } from './SettingsPrimitives'

export function LogsSection({ logDir, onOpenPath }: LogsSectionProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.logs.title')}>
      {logDir ? (
        <SettingRow
          label={t('settings.logs.openLogDir')}
          desc={logDir}
          last
          control={
            <Button icon={<FolderOpenOutlined />} onClick={() => onOpenPath(logDir)}>
              {t('settings.open')}
            </Button>
          }
        />
      ) : (
        <div style={{ padding: '20px 22px' }}>
          <Spin size="small" />
        </div>
      )}
    </Section>
  )
}
