import {
  CheckOutlined,
  CloudDownloadOutlined,
  CopyOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { App, Button, Progress, Tag, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'
import { BRAND, BORDER, TEXT_MUTED } from '../settings-page.constants'
import type { VersionsSectionProps } from '../settings-page.types'
import { Section, SettingRow, SubGroupHeader } from './SettingsPrimitives'

export function VersionsSection({
  version,
  updateInfo,
  openclawUpdateInfo,
  openclawInstalling,
  openclawLogLines,
  logEndRef,
  handleCheckOpenclawUpdate,
  handleInstallOpenclawUpdate,
}: VersionsSectionProps): React.ReactElement {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const copyOpenclawError = async (): Promise<void> => {
    const lines = [
      `ClickClaw Version: ${version}`,
      `OpenClaw Current Version: ${openclawUpdateInfo.currentVersion || 'unknown'}`,
      `OpenClaw Target Version: ${openclawUpdateInfo.latestVersion || 'unknown'}`,
      `OpenClaw Update Status: ${openclawUpdateInfo.status}`,
    ]

    if (openclawUpdateInfo.error) {
      lines.push(`Error: ${openclawUpdateInfo.error}`)
    }

    if (openclawLogLines.length > 0) {
      lines.push('', 'Install Logs:', ...openclawLogLines)
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      message.success(t('settings.openclaw.copyErrorSuccess'))
    } catch {
      message.error(t('settings.openclaw.copyErrorFailed'))
    }
  }

  const renderUpdateControl = (): React.ReactElement => {
    const { status, version: ver, progress, error } = updateInfo
    if (status === 'checking') {
      return (
        <Button size="small" loading icon={<SyncOutlined />} disabled>
          {t('settings.about.updateChecking')}
        </Button>
      )
    }
    if (status === 'available') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: BRAND }}>
            {t('settings.about.updateAvailable', { version: ver })}
          </span>
          <Button type="primary" size="small" onClick={() => window.api.update.download()}>
            {t('settings.about.downloadUpdate')}
          </Button>
        </div>
      )
    }
    if (status === 'downloading') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
          <Progress
            percent={progress ?? 0}
            size="small"
            style={{ flex: 1, margin: 0 }}
            showInfo={false}
          />
          <span style={{ fontSize: 12, color: TEXT_MUTED, flexShrink: 0 }}>
            {t('settings.about.updateDownloading', { progress: progress ?? 0 })}
          </span>
        </div>
      )
    }
    if (status === 'downloaded') {
      return (
        <Button type="primary" size="small" onClick={() => window.api.update.install()}>
          {t('settings.about.installAndRestart')}
        </Button>
      )
    }
    if (status === 'not-available') {
      return (
        <Button
          size="small"
          icon={<CheckOutlined style={{ color: '#52c41a' }} />}
          onClick={() => window.api.update.check()}
        >
          {t('settings.about.updateNotAvailable')}
        </Button>
      )
    }
    if (status === 'error') {
      return (
        <Tooltip title={error}>
          <Button size="small" danger onClick={() => window.api.update.check()}>
            {t('settings.about.updateError')}
          </Button>
        </Tooltip>
      )
    }
    return (
      <Button size="small" icon={<SyncOutlined />} onClick={() => window.api.update.check()}>
        {t('settings.about.checkUpdate')}
      </Button>
    )
  }

  return (
    <Section title={t('settings.versions.title')}>
      <SubGroupHeader label={t('settings.versions.clickclawGroup')} />
      <SettingRow
        label={t('settings.versions.appVersion')}
        desc={t('settings.versions.appVersionDesc')}
        control={
          <span
            style={{
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
              color: '#595959',
              letterSpacing: '0.01em',
            }}
          >
            v{version}
          </span>
        }
      />
      <SettingRow label={t('settings.versions.appUpdate')} control={renderUpdateControl()} />

      <SubGroupHeader label={t('settings.versions.openclawGroup')} />
      <SettingRow
        label={t('settings.versions.engineVersion')}
        desc={t('settings.versions.engineVersionDesc')}
        control={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#595959', fontVariantNumeric: 'tabular-nums' }}>
              {openclawUpdateInfo.currentVersion || t('settings.openclaw.versionUnknown')}
            </span>
            {openclawUpdateInfo.currentVersion && (
              <Tag color="blue" style={{ fontSize: 11, padding: '0 6px', lineHeight: '18px' }}>
                {t('settings.openclaw.tagBundled')}
              </Tag>
            )}
          </div>
        }
      />

      <SettingRow
        label={t('settings.versions.engineUpdate')}
        last={openclawLogLines.length === 0 && openclawUpdateInfo.status !== 'done'}
        control={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {openclawUpdateInfo.latestVersion && (
              <span style={{ fontSize: 12, color: TEXT_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                {t('settings.versions.latestLabel')} {openclawUpdateInfo.latestVersion}
              </span>
            )}
            {openclawUpdateInfo.status === 'up-to-date' && (
              <Tag color="green" style={{ fontSize: 11, padding: '0 6px', lineHeight: '18px' }}>
                {t('settings.openclaw.upToDate')}
              </Tag>
            )}
            {openclawUpdateInfo.status === 'error' && (
              <Tooltip title={openclawUpdateInfo.error}>
                <Tag color="red" style={{ fontSize: 11, padding: '0 6px', lineHeight: '18px' }}>
                  {t('settings.openclaw.checkError')}
                </Tag>
              </Tooltip>
            )}
            {openclawUpdateInfo.status === 'done' && (
              <Tag color="green" style={{ fontSize: 11, padding: '0 6px', lineHeight: '18px' }}>
                {t('settings.openclaw.upgradeDone')}
              </Tag>
            )}

            <Button
              size="small"
              icon={<SyncOutlined spin={openclawUpdateInfo.status === 'checking'} />}
              loading={openclawUpdateInfo.status === 'checking'}
              onClick={handleCheckOpenclawUpdate}
              disabled={openclawInstalling}
            >
              {t('settings.openclaw.checkUpdate')}
            </Button>

            {openclawUpdateInfo.status === 'available' && openclawUpdateInfo.latestVersion && (
              <Button
                type="primary"
                size="small"
                icon={<CloudDownloadOutlined />}
                loading={openclawInstalling}
                onClick={() => handleInstallOpenclawUpdate(openclawUpdateInfo.latestVersion!)}
              >
                {t('settings.openclaw.upgradeTo', { version: openclawUpdateInfo.latestVersion })}
              </Button>
            )}

            {openclawUpdateInfo.status === 'done' && (
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => window.api.gateway.restart()}
              >
                {t('settings.openclaw.restartGateway')}
              </Button>
            )}

            {openclawUpdateInfo.status === 'error' && (
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyOpenclawError()}
              >
                {t('settings.openclaw.copyError')}
              </Button>
            )}

            {openclawUpdateInfo.status === 'installing' && (
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                {t('settings.openclaw.upgrading')}
              </span>
            )}
          </div>
        }
      />

      {openclawLogLines.length > 0 && (
        <div style={{ padding: '10px 22px', borderTop: `1px solid ${BORDER}` }}>
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              background: '#1a1a1a',
              color: '#d4d4d4',
              fontSize: 11.5,
              lineHeight: 1.6,
              borderRadius: 6,
              maxHeight: 200,
              overflowY: 'auto',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {openclawLogLines.join('\n')}
            <div ref={logEndRef} />
          </pre>
        </div>
      )}
    </Section>
  )
}
