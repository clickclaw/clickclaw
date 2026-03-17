import { ReloadOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import type { RemotePresetsSectionProps } from '../settings-page.types'
import { Section, SettingRow } from './SettingsPrimitives'

export function RemotePresetsSection({
  status,
  refreshing,
  onRefresh,
}: RemotePresetsSectionProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.remotePresets.title')}>
      <SettingRow
        label={t('settings.remotePresets.status')}
        desc={
          status?.fetchedAt
            ? t('settings.remotePresets.statusDesc', {
                count: status.providerCount,
                time: new Date(status.fetchedAt).toLocaleString(),
              })
            : t('settings.remotePresets.statusEmpty')
        }
        last
        control={
          <Button size="small" icon={<ReloadOutlined />} loading={refreshing} onClick={onRefresh}>
            {t('settings.remotePresets.refresh')}
          </Button>
        }
      />
    </Section>
  )
}
