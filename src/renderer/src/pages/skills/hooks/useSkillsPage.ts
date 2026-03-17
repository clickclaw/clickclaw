import { useCallback, useState } from 'react'
import { useInstalledSkills } from './useInstalledSkills'
import { useSkillInstallFlow } from './useSkillInstallFlow'
import { useSkillsMarketplaces } from './useSkillsMarketplaces'

export function useSkillsPage() {
  const [activeTab, setActiveTab] = useState('discover')
  const [detailSkill, setDetailSkill] = useState<InstalledSkillInfo | null>(null)

  const { marketplaces, activeMarketplace, setActiveMarketplace, marketplaceOptions } =
    useSkillsMarketplaces()

  const {
    wsReady,
    installedSkills,
    skillsDir,
    installedLoading,
    loadInstalled,
    handleUninstall,
    handleToggleEnabled,
    handleSaveApiKey,
    handleExport,
    handleOpenDir,
    installedSlugs,
  } = useInstalledSkills()

  const {
    installingSlug,
    vetModalOpen,
    vetModalSlug,
    vetPhase,
    vetSteps,
    vetStreamText,
    vetResult,
    vetError,
    handleInstall,
    handleConfirmInstall,
    handleCancelVet,
  } = useSkillInstallFlow({
    activeMarketplace,
    skillsDir,
    loadInstalled,
  })

  const handleGoDiscover = useCallback(() => setActiveTab('discover'), [])
  const handleCloseDetail = useCallback(() => setDetailSkill(null), [])

  return {
    wsReady,
    activeTab,
    setActiveTab,
    marketplaces,
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
  }
}
