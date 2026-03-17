import type { TFunction } from 'i18next'

const OS_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

export function pathBasename(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p
}

export function resolveSourceTag(skill: InstalledSkillInfo): { label: string; color: string } {
  const rs = skill.rawSource
  if (rs === 'openclaw-bundled') return { label: 'openclaw-bundled', color: 'default' }
  if (rs === 'openclaw-extra') return { label: 'openclaw-extra', color: 'cyan' }
  if (rs === 'agents-skills-personal') return { label: 'workspace', color: 'blue' }
  switch (skill.source) {
    case 'managed':
      return { label: 'managed', color: 'green' }
    case 'workspace':
      return { label: 'workspace', color: 'blue' }
    case 'bundled':
      return { label: 'built-in', color: 'default' }
    default:
      return { label: rs ?? skill.source, color: 'purple' }
  }
}

export function buildMissingHint(missing: InstalledSkillInfo['missing'], t: TFunction): string {
  if (!missing) return ''
  const parts: string[] = []
  if (missing.bins?.length) parts.push(t('skills.missingBins', { list: missing.bins.join(', ') }))
  if (missing.anyBins?.length)
    parts.push(t('skills.missingAnyBins', { list: missing.anyBins.join(', ') }))
  if (missing.env?.length) parts.push(t('skills.missingEnv', { list: missing.env.join(', ') }))
  if (missing.config?.length)
    parts.push(t('skills.missingConfig', { list: missing.config.join(', ') }))
  if (missing.os?.length)
    parts.push(t('skills.missingOs', { list: missing.os.map((o) => OS_NAMES[o] ?? o).join(', ') }))
  return parts.join('\n')
}
