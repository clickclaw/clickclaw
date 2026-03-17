import { Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { GatewaySection } from './components/GatewaySection'
import { GeneralSection } from './components/GeneralSection'
import { LogsSection } from './components/LogsSection'
import { ProxySection } from './components/ProxySection'
import { RemotePresetsSection } from './components/RemotePresetsSection'
import { SecuritySection } from './components/SecuritySection'
import { VersionsSection } from './components/VersionsSection'
import { TEXT_PRIMARY } from './settings-page.constants'
import { useSettingsPage } from './hooks/useSettingsPage'

export default function SettingsPage(): React.ReactElement {
  const { t, i18n } = useTranslation()
  const {
    gwState,
    loading,
    version,
    paths,
    gatewayToken,
    editPort,
    setEditPort,
    savingPort,
    portJustSaved,
    portDirty,
    autoStart,
    launchAtLogin,
    updateInfo,
    remotePresetsStatus,
    remotePresetsRefreshing,
    savedProxy,
    draftProxy,
    setDraftProxy,
    proxySaving,
    proxyJustSaved,
    proxyTesting,
    proxyTestResult,
    setProxyTestResult,
    proxyDirty,
    vetterEnabled,
    vetterUseCustom,
    vetterCustomModel,
    vetterModelGroups,
    openclawUpdateInfo,
    openclawInstalling,
    openclawLogLines,
    logEndRef,
    handleSavePort,
    handleAutoStartChange,
    handleLaunchAtLoginChange,
    openPath,
    handleRefreshRemotePresets,
    handleProxySave,
    handleProxyTest,
    handleVetterEnabledChange,
    handleVetterModelModeChange,
    handleVetterCustomModelChange,
    handleCheckOpenclawUpdate,
    handleInstallOpenclawUpdate,
  } = useSettingsPage()

  if (loading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '36px 48px 60px',
        maxWidth: 700,
        boxSizing: 'border-box',
        minHeight: '100%',
      }}
    >
      <div style={{ marginBottom: 44 }}>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            margin: 0,
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}
        >
          {t('settings.title')}
        </h1>
      </div>

      <GeneralSection
        language={i18n.language === 'en' ? 'en' : 'zh-CN'}
        onChangeLanguage={(lang) => i18n.changeLanguage(lang)}
        launchAtLogin={launchAtLogin}
        onChangeLaunchAtLogin={handleLaunchAtLoginChange}
      />

      <GatewaySection
        gwState={gwState}
        gatewayToken={gatewayToken}
        editPort={editPort}
        setEditPort={setEditPort}
        savingPort={savingPort}
        portDirty={portDirty}
        portJustSaved={portJustSaved}
        autoStart={autoStart}
        onSavePort={handleSavePort}
        onChangeAutoStart={handleAutoStartChange}
        openclawDir={paths?.openclawDir}
        onOpenPath={openPath}
      />

      <ProxySection
        gwState={gwState}
        savedProxy={savedProxy}
        draftProxy={draftProxy}
        setDraftProxy={setDraftProxy}
        setProxyTestResult={setProxyTestResult}
        proxyDirty={proxyDirty}
        proxySaving={proxySaving}
        proxyJustSaved={proxyJustSaved}
        proxyTesting={proxyTesting}
        proxyTestResult={proxyTestResult}
        handleProxySave={handleProxySave}
        handleProxyTest={handleProxyTest}
      />

      <RemotePresetsSection
        status={remotePresetsStatus}
        refreshing={remotePresetsRefreshing}
        onRefresh={handleRefreshRemotePresets}
      />

      <SecuritySection
        vetterEnabled={vetterEnabled}
        vetterUseCustom={vetterUseCustom}
        vetterCustomModel={vetterCustomModel}
        vetterModelGroups={vetterModelGroups}
        onChangeVetterEnabled={handleVetterEnabledChange}
        onChangeVetterMode={handleVetterModelModeChange}
        onChangeVetterCustomModel={handleVetterCustomModelChange}
      />

      <LogsSection logDir={paths?.logDir} onOpenPath={openPath} />

      <VersionsSection
        version={version}
        updateInfo={updateInfo}
        openclawUpdateInfo={openclawUpdateInfo}
        openclawInstalling={openclawInstalling}
        openclawLogLines={openclawLogLines}
        logEndRef={logEndRef}
        handleCheckOpenclawUpdate={handleCheckOpenclawUpdate}
        handleInstallOpenclawUpdate={handleInstallOpenclawUpdate}
      />
    </div>
  )
}
