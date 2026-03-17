import { CheckOutlined, WifiOutlined } from '@ant-design/icons'
import { Button, Input, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import { BORDER, TEXT_MUTED } from '../settings-page.constants'
import type { ProxySectionProps } from '../settings-page.types'
import { Section, SettingRow } from './SettingsPrimitives'

export function ProxySection({
  gwState,
  savedProxy,
  draftProxy,
  setDraftProxy,
  setProxyTestResult,
  proxyDirty,
  proxySaving,
  proxyJustSaved,
  proxyTesting,
  proxyTestResult,
  handleProxySave,
  handleProxyTest,
}: ProxySectionProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.proxy.title')}>
      <SettingRow
        label={t('settings.proxy.enable')}
        desc={t('settings.proxy.enableDesc')}
        highlight={draftProxy.enabled !== savedProxy.enabled}
        control={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {savedProxy.enabled && (
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 8px',
                  borderRadius: 10,
                  background: 'rgba(82, 196, 26, 0.1)',
                  color: '#52c41a',
                  border: '1px solid rgba(82, 196, 26, 0.25)',
                  fontWeight: 500,
                  lineHeight: '18px',
                  userSelect: 'none',
                }}
              >
                {t('settings.proxy.active')}
              </span>
            )}
            <Switch
              checked={draftProxy.enabled}
              onChange={(val) => {
                setDraftProxy((d) => ({ ...d, enabled: val }))
                setProxyTestResult(null)
              }}
            />
          </div>
        }
      />

      {draftProxy.enabled && (
        <>
          <SettingRow
            label={t('settings.proxy.url')}
            desc={t('settings.proxy.urlDesc')}
            highlight={draftProxy.url !== savedProxy.url}
            control={
              <div>
                <Input
                  value={draftProxy.url}
                  onChange={(e) => setDraftProxy((d) => ({ ...d, url: e.target.value }))}
                  placeholder={t('settings.proxy.urlPlaceholder')}
                  style={{ width: 230 }}
                  status={draftProxy.url !== savedProxy.url ? 'warning' : undefined}
                />
                {draftProxy.url.trim() &&
                  !/^[a-z][a-z0-9+.-]*:\/\//i.test(draftProxy.url.trim()) && (
                    <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>
                      → http://{draftProxy.url.trim()}
                    </div>
                  )}
              </div>
            }
          />
          <SettingRow
            label={t('settings.proxy.bypass')}
            desc={t('settings.proxy.bypassDesc')}
            highlight={draftProxy.bypass !== savedProxy.bypass}
            control={
              <Input
                value={draftProxy.bypass}
                onChange={(e) => setDraftProxy((d) => ({ ...d, bypass: e.target.value }))}
                placeholder={t('settings.proxy.bypassPlaceholder')}
                style={{ width: 230 }}
                status={draftProxy.bypass !== savedProxy.bypass ? 'warning' : undefined}
              />
            }
          />
        </>
      )}

      {(proxyDirty || draftProxy.enabled) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 22px',
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          {proxyDirty ? (
            <Button type="primary" size="small" loading={proxySaving} onClick={handleProxySave}>
              {gwState === 'running'
                ? t('settings.proxy.applyAndRestart')
                : t('settings.proxy.apply')}
            </Button>
          ) : (
            proxyJustSaved && (
              <span
                style={{
                  fontSize: 12,
                  color: '#52c41a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckOutlined style={{ fontSize: 12 }} />
                {t('settings.proxy.applied')}
              </span>
            )
          )}
          {draftProxy.enabled && (
            <Button
              size="small"
              icon={<WifiOutlined />}
              loading={proxyTesting}
              onClick={handleProxyTest}
            >
              {t('settings.proxy.testBtn')}
            </Button>
          )}
          {proxyTestResult && (
            <span style={{ fontSize: 12, color: proxyTestResult.ok ? '#52c41a' : '#ff4d4f' }}>
              {proxyTestResult.ok
                ? t('settings.proxy.testOk', { latency: proxyTestResult.latencyMs ?? '-' })
                : `${t('settings.proxy.testFail')}${proxyTestResult.error ? `: ${proxyTestResult.error}` : ''}`}
            </span>
          )}
        </div>
      )}
    </Section>
  )
}
