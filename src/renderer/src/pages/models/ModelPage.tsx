import { Alert, Button, Modal, Select, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import { BrandPickerDrawer } from './components/BrandPickerDrawer'
import { DefaultModelBanner } from './components/DefaultModelBanner'
import { EmptyState } from './components/EmptyState'
import { ModelDrawer } from './components/ModelDrawer'
import { ProviderCard } from './components/ProviderCard'
import { ProviderSetupDrawer } from './components/ProviderSetupDrawer'
import { RemoteListModal } from './components/RemoteListModal'
import { useModelPage } from './hooks/useModelPage'

export default function ModelPage(): React.ReactElement {
  const { t } = useTranslation()
  const [fallbackEditorOpen, setFallbackEditorOpen] = useState(false)
  const [primaryDraft, setPrimaryDraft] = useState<string | undefined>(undefined)
  const [fallbackDraft, setFallbackDraft] = useState<string[]>([])
  const [savingFallbacks, setSavingFallbacks] = useState(false)
  const {
    brands,
    brandSections,
    providers,
    defaultModel,
    loading,
    loadError,
    brandPickerOpen,
    setBrandPickerOpen,
    setupDrawerOpen,
    setSetupDrawerOpen,
    selectedBrand,
    editingProvider,
    savingProvider,
    modelDrawerOpen,
    setModelDrawerOpen,
    modelDrawerProviderKey,
    editingModel,
    savingModel,
    remoteOpen,
    setRemoteOpen,
    remoteModels,
    remoteLoading,
    existingModelIds,
    loadData,
    handleBrandSelect,
    handleEditProvider,
    handleSaveProvider,
    handleDeleteProvider,
    openCreateModelDrawer,
    openEditModelDrawer,
    handleSaveModel,
    handleDeleteModel,
    handleSetPrimary,
    handleSetPrimaryAndFallbacks,
    fallbackOptions,
    fallbackValue,
    primaryModelPath,
    handleFetchRemote,
    handleAddRemoteModels,
  } = useModelPage()

  const editableFallbackOptions = useMemo(
    () => fallbackOptions.filter((item) => item !== primaryDraft),
    [fallbackOptions, primaryDraft]
  )

  const openFallbackEditor = () => {
    setPrimaryDraft(primaryModelPath ?? undefined)
    setFallbackDraft(fallbackValue.filter((item) => item !== primaryModelPath))
    setFallbackEditorOpen(true)
  }

  const handleSaveFallbacks = async () => {
    if (!primaryDraft) return
    setSavingFallbacks(true)
    try {
      await handleSetPrimaryAndFallbacks(primaryDraft, fallbackDraft)
      setFallbackEditorOpen(false)
    } finally {
      setSavingFallbacks(false)
    }
  }

  return (
    <div style={{ padding: '24px 28px', height: '100%', overflow: 'auto' }}>
      <PageHeader
        title={t('models.title')}
        subtitle={
          !loading && providers.length > 0
            ? t('models.providerCount', {
                count: providers.length,
                models: providers.reduce((s, p) => s + (p.config.models?.length || 0), 0),
              })
            : undefined
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setBrandPickerOpen(true)}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A', fontWeight: 500 }}
          >
            {t('models.addProvider')}
          </Button>
        }
      />

      <DefaultModelBanner
        defaultModel={defaultModel}
        brands={brands}
        onEditFallbacks={defaultModel ? openFallbackEditor : undefined}
      />

      {loadError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 14, borderRadius: 8 }}
          message={t('models.loadFailed', { error: loadError })}
          description={t('models.loadFailedHint')}
          action={
            <Button size="small" onClick={loadData}>
              {t('models.retry')}
            </Button>
          }
        />
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: '#fff',
                borderRadius: 10,
                border: '1px solid #ebebeb',
                padding: 16,
                opacity: 1 - (i - 1) * 0.3,
              }}
            >
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState brands={brands} onCreate={() => setBrandPickerOpen(true)} />
      ) : (
        providers.map((entry) => (
          <ProviderCard
            key={entry.key}
            entry={entry}
            brands={brands}
            defaultModel={defaultModel}
            onEdit={handleEditProvider}
            onDelete={handleDeleteProvider}
            onAddModel={openCreateModelDrawer}
            onEditModel={openEditModelDrawer}
            onDeleteModel={handleDeleteModel}
            onSetPrimary={handleSetPrimary}
            onFetchRemote={handleFetchRemote}
          />
        ))
      )}

      <BrandPickerDrawer
        open={brandPickerOpen}
        sections={brandSections}
        configuredKeys={providers.map((p) => p.key)}
        onSelect={handleBrandSelect}
        onClose={() => setBrandPickerOpen(false)}
      />

      <ProviderSetupDrawer
        open={setupDrawerOpen}
        brand={selectedBrand}
        editingEntry={editingProvider}
        brands={brands}
        onClose={() => !savingProvider && setSetupDrawerOpen(false)}
        onSave={handleSaveProvider}
        saving={savingProvider}
      />

      <ModelDrawer
        open={modelDrawerOpen}
        providerKey={modelDrawerProviderKey}
        brands={brands}
        editingModel={editingModel}
        onClose={() => !savingModel && setModelDrawerOpen(false)}
        onSave={handleSaveModel}
        saving={savingModel}
      />

      <RemoteListModal
        open={remoteOpen}
        loading={remoteLoading}
        remoteModels={remoteModels}
        existingModelIds={existingModelIds}
        onClose={() => setRemoteOpen(false)}
        onAdd={handleAddRemoteModels}
      />

      <Modal
        title={t('models.editPrimaryAndFallbacks')}
        open={fallbackEditorOpen}
        onCancel={() => !savingFallbacks && setFallbackEditorOpen(false)}
        onOk={handleSaveFallbacks}
        confirmLoading={savingFallbacks}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: !primaryDraft }}
      >
        <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
          {t('models.primaryAndFallbacksHint')}
        </div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{t('models.primary')}</div>
        <Select
          style={{ width: '100%', marginBottom: 12 }}
          value={primaryDraft}
          placeholder={t('models.primaryPlaceholder')}
          options={fallbackOptions.map((path) => ({ value: path, label: path }))}
          onChange={(value) => {
            setPrimaryDraft(value)
            setFallbackDraft((prev) => prev.filter((item) => item !== value))
          }}
          showSearch
          optionFilterProp="label"
        />
        <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>{t('models.fallbacks')}</div>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          value={fallbackDraft}
          placeholder={t('models.fallbacksPlaceholder')}
          options={editableFallbackOptions.map((path) => ({ value: path, label: path }))}
          onChange={(values) => setFallbackDraft(values)}
          showSearch
          optionFilterProp="label"
        />
      </Modal>
    </div>
  )
}
