import { Select, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import type { GeneralSectionProps } from '../settings-page.types'
import { Section, SettingRow } from './SettingsPrimitives'

export function GeneralSection({
  language,
  onChangeLanguage,
  launchAtLogin,
  onChangeLaunchAtLogin,
}: GeneralSectionProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.general.title')}>
      <SettingRow
        label={t('settings.general.language')}
        desc={t('settings.general.languageDesc')}
        control={
          <Select
            value={language}
            onChange={(val) => onChangeLanguage(val as 'zh-CN' | 'en')}
            options={[
              { label: '中文', value: 'zh-CN' },
              { label: 'English', value: 'en' },
            ]}
            style={{ width: 118 }}
          />
        }
      />
      <SettingRow
        label={t('settings.general.launchAtLogin')}
        desc={t('settings.general.launchAtLoginDesc')}
        last
        control={<Switch checked={launchAtLogin} onChange={onChangeLaunchAtLogin} />}
      />
    </Section>
  )
}
