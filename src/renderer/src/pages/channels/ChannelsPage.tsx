import { Button, Skeleton, Space } from 'antd'
import { PlusOutlined, PartitionOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import { AccountConfigDrawer } from './components/AccountConfigDrawer'
import { BindingRulesDrawer } from './components/BindingRulesDrawer'
import { ChannelCard } from './components/ChannelCard'
import { ChannelConfigDrawer } from './components/ChannelConfigDrawer'
import { ChannelPickerDrawer } from './components/ChannelPickerDrawer'
import { EmptyChannelsState } from './components/EmptyChannelsState'
import { useChannelsPage } from './hooks/useChannelsPage'

export default function ChannelsPage(): React.ReactElement {
  const { t } = useTranslation()
  const {
    presets,
    channels,
    agents,
    bindings,
    bindingRules,
    bindingRulesOpen,
    setBindingRulesOpen,
    bindingRulesLoading,
    loadBindingRules,
    loading,
    pickerOpen,
    setPickerOpen,
    configOpen,
    setConfigOpen,
    selectedPreset,
    editingKey,
    saving,
    accountDrawerOpen,
    setAccountDrawerOpen,
    accountChannelKey,
    accountPreset,
    accountEditingId,
    accountEditingData,
    accountSaving,
    allPresets,
    configuredKeys,
    findPreset,
    handleAddChannel,
    handlePickerSelect,
    handleEdit,
    handleSave,
    handleDelete,
    handleToggle,
    handleOpenAddAccount,
    handleOpenEditAccount,
    handleSaveAccount,
    handleDeleteAccount,
    handleSetDefaultAccount,
    handleSetBinding,
  } = useChannelsPage()

  return (
    <div
      style={{
        padding: '24px 28px',
        height: '100%',
        overflow: 'auto',
      }}
    >
      <PageHeader
        title={t('channels.title')}
        subtitle={
          !loading && configuredKeys.length > 0
            ? t('channels.channelCount', { count: configuredKeys.length })
            : undefined
        }
        extra={
          <Space>
            <Button icon={<PartitionOutlined />} onClick={() => setBindingRulesOpen(true)}>
              {t('channels.bindingRules.open')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddChannel}
              style={{ background: '#FF4D2A', borderColor: '#FF4D2A', fontWeight: 500 }}
            >
              {t('channels.addChannel')}
            </Button>
          </Space>
        }
      />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: '14px 18px',
                background: '#fff',
                borderRadius: 10,
                border: '1px solid #f0f0f0',
                borderLeft: '3px solid #f0f0f0',
                opacity: 1 - (i - 1) * 0.3,
              }}
            >
              <Skeleton active paragraph={{ rows: 1 }} />
            </div>
          ))}
        </div>
      ) : configuredKeys.length === 0 ? (
        <EmptyChannelsState
          onAdd={handleAddChannel}
          presets={[...presets.domestic, ...presets.international]}
        />
      ) : (
        <div>
          {configuredKeys.map((key) => {
            const config = channels[key]
            const preset = findPreset(key, config)
            const isCustom = !allPresets.some((p) => p.key === key)
            return (
              <ChannelCard
                key={key}
                channelKey={key}
                config={config}
                preset={preset}
                isCustom={isCustom}
                agents={agents}
                bindings={bindings}
                onEdit={() => handleEdit(key)}
                onDelete={() => handleDelete(key)}
                onToggle={(enabled) => handleToggle(key, enabled)}
                onAddAccount={() => handleOpenAddAccount(key)}
                onEditAccount={(accountId) => handleOpenEditAccount(key, accountId)}
                onDeleteAccount={(accountId) => handleDeleteAccount(key, accountId)}
                onSetDefaultAccount={(accountId) => handleSetDefaultAccount(key, accountId)}
                onSetBinding={(accountId, agentId) => handleSetBinding(key, accountId, agentId)}
              />
            )
          })}
        </div>
      )}

      <ChannelPickerDrawer
        open={pickerOpen}
        presets={presets}
        configuredKeys={configuredKeys}
        onSelect={handlePickerSelect}
        onClose={() => setPickerOpen(false)}
      />

      <ChannelConfigDrawer
        open={configOpen}
        preset={selectedPreset}
        existingConfig={editingKey ? channels[editingKey] : undefined}
        onClose={() => {
          if (!saving) setConfigOpen(false)
        }}
        onSave={handleSave}
        saving={saving}
      />

      <AccountConfigDrawer
        open={accountDrawerOpen}
        preset={accountPreset}
        channelKey={accountChannelKey}
        editingAccountId={accountEditingId}
        editingAccountData={accountEditingData}
        onClose={() => {
          if (!accountSaving) setAccountDrawerOpen(false)
        }}
        onSave={handleSaveAccount}
        saving={accountSaving}
      />

      <BindingRulesDrawer
        open={bindingRulesOpen}
        rules={bindingRules}
        loading={bindingRulesLoading}
        agents={agents}
        channels={channels}
        presets={allPresets}
        onClose={() => setBindingRulesOpen(false)}
        onRefresh={loadBindingRules}
      />
    </div>
  )
}
