import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import {
  Tabs,
  Input,
  Select,
  Button,
  Row,
  Col,
  Tag,
  Space,
  Typography,
  Empty,
  Spin,
  Tooltip,
} from 'antd'
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import PageHeader from '../../components/PageHeader'
import { SkillCard } from './components/SkillCard'
import { SortKey } from './skills-page.types'
import { InstalledTab } from './components/InstalledTab'
import { VetModal } from './components/VetModal'
import { DetailModal } from './components/DetailModal'
import { useSkillsPage } from './hooks/useSkillsPage'

const { Text } = Typography

// ========== DiscoverTab ==========

interface DiscoverTabProps {
  marketplaceId: string
  installedSlugs: Set<string>
  installingSlug: string | null
  onInstall: (slug: string) => Promise<void>
}

const DiscoverTab = memo(function DiscoverTab({
  marketplaceId,
  installedSlugs,
  installingSlug,
  onInstall,
}: DiscoverTabProps): React.ReactElement {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'browse' | 'search'>('browse')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('trending')
  const [searchResults, setSearchResults] = useState<SkillSearchResult[]>([])
  const [browseItems, setBrowseItems] = useState<SkillBrowseItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [browseError, setBrowseError] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 切换市场时立即清空旧列表，避免短暂显示上一个市场的内容
  useEffect(() => {
    setBrowseItems([])
    setSearchResults([])
    setNextCursor(null)
    setQuery('')
    setMode('browse')
  }, [marketplaceId])

  const loadBrowse = useCallback(
    async (cursor?: string) => {
      const isLoadMore = !!cursor
      if (isLoadMore) setLoadingMore(true)
      else {
        setLoading(true)
        setBrowseError(false)
      }
      try {
        const result = await window.api.skill.browse(marketplaceId, { sort, limit: 20, cursor })
        if (isLoadMore) setBrowseItems((prev) => [...prev, ...result.items])
        else setBrowseItems(result.items)
        setNextCursor(result.nextCursor)
      } catch {
        if (!isLoadMore) setBrowseError(true)
      } finally {
        if (isLoadMore) setLoadingMore(false)
        else setLoading(false)
      }
    },
    [marketplaceId, sort]
  )

  useEffect(() => {
    if (mode === 'browse') loadBrowse()
  }, [mode, sort, marketplaceId, loadBrowse])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setMode('browse')
      return
    }
    setMode('search')
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        setSearchResults(await window.api.skill.search(marketplaceId, query.trim(), { limit: 20 }))
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query, marketplaceId])

  const sortOptions = [
    { value: 'trending', label: t('skills.sort.trending') },
    { value: 'updated', label: t('skills.sort.updated') },
    { value: 'downloads', label: t('skills.sort.downloads') },
    { value: 'stars', label: t('skills.sort.stars') },
  ]

  const displayItems = useMemo(
    () =>
      mode === 'search'
        ? searchResults.map((r) => ({
            slug: r.slug,
            displayName: r.displayName,
            summary: r.summary,
            version: r.version,
          }))
        : browseItems.map((b) => ({
            slug: b.slug,
            displayName: b.displayName,
            summary: b.summary,
            version: b.latestVersion?.version,
            stats: b.stats,
          })),
    [mode, searchResults, browseItems]
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('skills.searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={{ flex: 1 }}
        />
        {mode === 'browse' && (
          <Select
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={sortOptions}
            style={{ width: 140 }}
          />
        )}
        {mode === 'browse' && (
          <Tooltip title={t('skills.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={() => loadBrowse()} />
          </Tooltip>
        )}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : browseError && mode === 'browse' ? (
        <Empty description={t('skills.browseError')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button onClick={() => loadBrowse()}>{t('skills.refresh')}</Button>
        </Empty>
      ) : displayItems.length === 0 ? (
        <Empty description={t('skills.noResults')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {displayItems.map((item) => (
              <Col key={item.slug} xs={24} sm={12} md={8} lg={6}>
                <SkillCard
                  slug={item.slug}
                  displayName={item.displayName}
                  summary={item.summary}
                  emoji={(item as { emoji?: string }).emoji}
                  version={item.version}
                  stats={(item as { stats?: { downloads?: number; stars?: number } }).stats}
                  isInstalled={installedSlugs.has(item.slug)}
                  isInstalling={installingSlug === item.slug}
                  onInstall={onInstall}
                />
              </Col>
            ))}
          </Row>
          {mode === 'browse' && nextCursor && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button onClick={() => loadBrowse(nextCursor)} loading={loadingMore}>
                {t('skills.loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
})

// ========== 主页面 ==========

export default function SkillsPage(): React.ReactElement {
  const { t } = useTranslation()
  const {
    wsReady,
    activeTab,
    setActiveTab,
    activeMarketplace,
    setActiveMarketplace,
    installedSkills,
    installingSlug,
    skillsDir,
    installedLoading,
    detailSkill,
    setDetailSkill,
    vetModalOpen,
    vetModalSlug,
    vetPhase,
    vetSteps,
    vetStreamText,
    vetResult,
    vetError,
    loadInstalled,
    handleInstall,
    handleConfirmInstall,
    handleCancelVet,
    handleUninstall,
    handleToggleEnabled,
    handleSaveApiKey,
    handleExport,
    handleOpenDir,
    handleGoDiscover,
    handleCloseDetail,
    installedSlugs,
    marketplaceOptions,
  } = useSkillsPage()

  const tabItems = [
    {
      key: 'discover',
      label: t('skills.tabs.discover'),
      children: (
        <DiscoverTab
          marketplaceId={activeMarketplace}
          installedSlugs={installedSlugs}
          installingSlug={installingSlug}
          onInstall={handleInstall}
        />
      ),
    },
    {
      key: 'installed',
      label: (
        <span>
          {t('skills.tabs.installed')}
          {installedSkills.length > 0 && (
            <Tag color="default" style={{ marginLeft: 6 }}>
              {installedSkills.length}
            </Tag>
          )}
        </span>
      ),
      children: (
        <InstalledTab
          skills={installedSkills}
          skillsDir={skillsDir}
          wsReady={wsReady}
          loading={installedLoading}
          onUninstall={handleUninstall}
          onToggleEnabled={handleToggleEnabled}
          onSaveApiKey={handleSaveApiKey}
          onShowDetail={setDetailSkill}
          onExport={handleExport}
          onOpenDir={handleOpenDir}
          onGoDiscover={handleGoDiscover}
          onRefresh={loadInstalled}
        />
      ),
    },
  ]

  return (
    <div style={{ padding: '24px 28px' }}>
      <PageHeader
        title={t('skills.title')}
        extra={
          marketplaceOptions.length > 1 ? (
            <Space>
              <Text type="secondary">{t('skills.marketplace')}:</Text>
              <Select
                value={activeMarketplace}
                options={marketplaceOptions}
                onChange={setActiveMarketplace}
                style={{ width: 140 }}
                size="small"
              />
            </Space>
          ) : undefined
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        destroyInactiveTabPane={false}
      />

      <DetailModal skill={detailSkill} onClose={handleCloseDetail} />

      {/* Skill 安全审查 Modal（进度阶段 + 结果阶段） */}
      <VetModal
        open={vetModalOpen}
        slug={vetModalSlug ?? ''}
        phase={vetPhase}
        steps={vetSteps}
        streamText={vetStreamText}
        error={vetError}
        result={vetResult}
        onConfirm={handleConfirmInstall}
        onCancel={handleCancelVet}
      />
    </div>
  )
}
