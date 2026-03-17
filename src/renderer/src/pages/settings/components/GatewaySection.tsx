import { CheckOutlined, CopyOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { App, Button, Input, InputNumber, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import type { GatewaySectionProps } from '../settings-page.types'
import { SettingRow, Section } from './SettingsPrimitives'

export function GatewaySection({
  gwState,
  gatewayToken,
  editPort,
  setEditPort,
  savingPort,
  portDirty,
  portJustSaved,
  autoStart,
  onSavePort,
  onChangeAutoStart,
  openclawDir,
  onOpenPath,
}: GatewaySectionProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const copyGatewayToken = async (): Promise<void> => {
    if (!gatewayToken) return
    try {
      await navigator.clipboard.writeText(gatewayToken)
      message.success(t('common.copied'))
    } catch {
      message.error(t('common.saveFailed'))
    }
  }

  const portControl = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <InputNumber
        value={editPort}
        onChange={(v) => setEditPort(v ?? 18789)}
        min={1024}
        max={65535}
        style={{ width: 108 }}
        status={portDirty ? 'warning' : undefined}
      />
      {portDirty && (
        <Button
          type="primary"
          size="small"
          loading={savingPort}
          onClick={onSavePort}
          style={{ fontSize: 12 }}
        >
          {gwState === 'running' ? t('settings.saveAndRestart') : t('common.save')}
        </Button>
      )}
      {portJustSaved && !portDirty && <CheckOutlined style={{ color: '#52c41a', fontSize: 14 }} />}
    </div>
  )

  return (
    <Section title="Gateway">
      <SettingRow
        label={t('settings.gateway.port')}
        desc={t('settings.gateway.portDesc')}
        highlight={portDirty}
        control={portControl}
      />
      <SettingRow
        label={t('settings.gateway.autoStart')}
        desc={t('settings.gateway.autoStartDesc')}
        control={<Switch checked={autoStart} onChange={onChangeAutoStart} />}
      />
      <SettingRow
        label={t('settings.gateway.token')}
        desc={t('settings.gateway.tokenDesc')}
        control={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              value={gatewayToken || '-'}
              readOnly
              style={{ width: 280, fontFamily: 'monospace', fontSize: 12 }}
            />
            <Button
              icon={<CopyOutlined />}
              size="small"
              disabled={!gatewayToken}
              onClick={() => copyGatewayToken()}
            >
              {t('settings.gateway.copyToken')}
            </Button>
          </div>
        }
      />
      {openclawDir && (
        <SettingRow
          label={t('settings.gateway.openConfigDir')}
          desc={openclawDir}
          last
          control={
            <Button icon={<FolderOpenOutlined />} onClick={() => onOpenPath(openclawDir)}>
              {t('settings.open')}
            </Button>
          }
        />
      )}
    </Section>
  )
}
