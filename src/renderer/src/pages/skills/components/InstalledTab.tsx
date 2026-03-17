import { memo, useMemo, useRef, useState } from 'react'
import { Alert, Button, Empty, Input, Spin, Tooltip, Typography } from 'antd'
import { FolderOpenOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { InstalledRow } from './InstalledRow'
import type { InstalledTabProps } from '../skills-page.types'

const { Text } = Typography

export const InstalledTab = memo(function InstalledTab({
  skills,
  skillsDir,
  wsReady,
  loading,
  onUninstall,
  onToggleEnabled,
  onSaveApiKey,
  onShowDetail,
  onExport,
  onOpenDir,
  onGoDiscover,
  onRefresh,
}: InstalledTabProps): React.ReactElement {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setSearchText(val)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (!val) {
      setDebouncedSearch('')
      return
    }
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(val), 150)
  }

  const filtered = useMemo(
    () =>
      debouncedSearch.trim()
        ? skills.filter(
            (s) =>
              s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              s.description?.toLowerCase().includes(debouncedSearch.toLowerCase())
          )
        : skills,
    [skills, debouncedSearch]
  )

  if (!wsReady) {
    return (
      <div>
        <Alert
          type="warning"
          message={t('skills.gatewayOffline')}
          description={t('skills.gatewayOfflineHint')}
          showIcon
          style={{ marginBottom: 16 }}
        />
        {skills.length > 0 && (
          <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
            {skills.map((skill) => (
              <InstalledRow
                key={skill.baseDir}
                skill={skill}
                wsReady={false}
                onUninstall={onUninstall}
                onToggleEnabled={onToggleEnabled}
                onSaveApiKey={onSaveApiKey}
                onShowDetail={onShowDetail}
                onExport={onExport}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('skills.searchInstalled')}
          value={searchText}
          onChange={handleSearchChange}
          allowClear
          style={{ flex: 1 }}
        />
        <Tooltip title={t('skills.refresh')}>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading} />
        </Tooltip>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : skills.length === 0 ? (
        <Empty
          description={
            <span>
              {t('skills.noInstalled')}
              <br />
              <Text type="secondary">{t('skills.noInstalledHint')}</Text>
            </span>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={onGoDiscover}>
            {t('skills.tabs.discover')}
          </Button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty description={t('skills.noResults')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        filtered.map((skill) => (
          <InstalledRow
            key={skill.baseDir}
            skill={skill}
            wsReady={wsReady}
            onUninstall={onUninstall}
            onToggleEnabled={onToggleEnabled}
            onSaveApiKey={onSaveApiKey}
            onShowDetail={onShowDetail}
            onExport={onExport}
          />
        ))
      )}

      <div
        style={{
          marginTop: 24,
          padding: '12px 16px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('skills.skillsDir')}
          </Text>
          <br />
          <Text code style={{ fontSize: 11 }}>
            {skillsDir}
          </Text>
        </div>
        <Button size="small" icon={<FolderOpenOutlined />} onClick={onOpenDir}>
          {t('skills.openDir')}
        </Button>
      </div>
    </div>
  )
})
