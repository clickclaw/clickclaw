import { Radio, Select, Switch } from 'antd'
import type { DefaultOptionType } from 'antd/es/select'
import { useTranslation } from 'react-i18next'
import type { SecuritySectionProps } from '../settings-page.types'
import { Section, SettingRow } from './SettingsPrimitives'

export function SecuritySection({
  vetterEnabled,
  vetterUseCustom,
  vetterCustomModel,
  vetterModelGroups,
  onChangeVetterEnabled,
  onChangeVetterMode,
  onChangeVetterCustomModel,
}: SecuritySectionProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.security.title')}>
      <SettingRow
        label={t('settings.security.vetEnabled')}
        desc={t('settings.security.vetEnabledDesc')}
        control={<Switch checked={vetterEnabled} onChange={onChangeVetterEnabled} />}
      />
      {vetterEnabled && (
        <SettingRow
          label={t('settings.security.vetModel')}
          last
          control={
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}
            >
              <Radio.Group
                value={vetterUseCustom ? 'custom' : 'primary'}
                onChange={(e) => onChangeVetterMode(e.target.value === 'custom')}
                size="small"
              >
                <Radio value="primary">{t('settings.security.vetModelPrimary')}</Radio>
                <Radio value="custom">{t('settings.security.vetModelCustom')}</Radio>
              </Radio.Group>
              {vetterUseCustom && (
                <Select
                  size="small"
                  placeholder={t('settings.security.vetModelPlaceholder')}
                  value={vetterCustomModel || undefined}
                  onChange={onChangeVetterCustomModel}
                  style={{ width: 260 }}
                  showSearch
                  filterOption={(input, option) =>
                    String((option as DefaultOptionType | undefined)?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={vetterModelGroups.map((group) => ({
                    label: group.providerName,
                    options: group.models.map((m) => ({
                      value: `${group.providerKey}/${m.id}`,
                      label: m.name || m.id,
                    })),
                  }))}
                  notFoundContent={t('settings.security.vetModelNoOptions')}
                />
              )}
            </div>
          }
        />
      )}
    </Section>
  )
}
