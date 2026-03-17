export type SortKey = 'trending' | 'updated' | 'downloads' | 'stars'

export interface VetStepUI {
  key: 'downloading' | 'parsing' | 'analyzing'
  labelKey: string
  status: 'wait' | 'processing' | 'done' | 'error'
}

export const INITIAL_VET_STEPS: VetStepUI[] = [
  { key: 'downloading', labelKey: 'skills.vetter.stageDownloading', status: 'wait' },
  { key: 'parsing', labelKey: 'skills.vetter.stageParsing', status: 'wait' },
  { key: 'analyzing', labelKey: 'skills.vetter.stageAnalyzing', status: 'wait' },
]

export interface InstalledTabProps {
  skills: InstalledSkillInfo[]
  skillsDir: string
  wsReady: boolean
  loading: boolean
  onUninstall: (baseDir: string, name: string) => Promise<void>
  onToggleEnabled: (skillKey: string, enabled: boolean) => void
  onSaveApiKey: (skillKey: string, apiKey: string) => Promise<void>
  onShowDetail: (skill: InstalledSkillInfo) => void
  onExport: (skill: InstalledSkillInfo) => Promise<void>
  onOpenDir: () => void
  onGoDiscover: () => void
  onRefresh: () => void
}
