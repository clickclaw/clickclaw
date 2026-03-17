import type { ApiType, DisplayBrand, ModelDef, DisplayBrandSection } from './model-page.types'

export function presetToDisplayBrand(preset: ProviderPresetForUI): DisplayBrand | null {
  if (!preset.platforms?.length) return null
  return {
    key: preset.key,
    name: preset.name,
    tagline: preset.tagline ?? '',
    group: preset.group,
    recommendedRank: preset.recommendedRank,
    logoUrl: preset.logoUrl,
    color: preset.color,
    initials: preset.initials,
    allKeys: [preset.key, ...preset.platforms.map((p) => p.key)],
    platforms: preset.platforms.map((p) => ({
      key: p.key,
      name: p.name,
      baseUrl: p.baseUrl,
      api: p.api as ApiType,
      apiKeyUrl: p.apiKeyUrl,
      models: p.models.map((m) => ({ id: m.id, name: m.name, input: m.input })),
    })),
  }
}

export function latencyColor(ms: number): string {
  if (ms < 2000) return '#16a34a'
  if (ms < 6000) return '#d97706'
  return '#dc2626'
}

export function getPrimaryModelId(
  def: string | { primary: string; fallbacks?: string[] } | null,
  providerKey: string
): string | null {
  const raw = typeof def === 'string' ? def : (def?.primary ?? null)
  if (!raw?.startsWith(providerKey + '/')) return null
  return raw.slice(providerKey.length + 1)
}

export function getPrimaryModelPath(
  def: string | { primary: string; fallbacks?: string[] } | null
): string | null {
  return typeof def === 'string' ? def : (def?.primary ?? null)
}

export function getBrandByKey(key: string, brands: DisplayBrand[]): DisplayBrand | undefined {
  return brands.find((b) => b.allKeys.includes(key))
}

export function getRecommendedModelIds(models: ModelDef[]): string[] {
  if (models.length === 0) return []

  const explicit = models.filter((m) => m.recommended).map((m) => m.id)
  if (explicit.length > 0) return Array.from(new Set(explicit))

  const primaryText = models.find((m) => !m.input?.includes('image'))
  const primaryImage = models.find((m) => m.input?.includes('image'))
  const picked = [primaryText?.id, primaryImage?.id].filter((id): id is string => !!id)
  if (picked.length > 0) return Array.from(new Set(picked))

  return [models[0].id]
}

export function toDisplaySections(sections: ProviderPresetSection[]): DisplayBrandSection[] {
  return sections
    .map((section) => ({
      key: section.key,
      items: section.items.map(presetToDisplayBrand).filter((b): b is DisplayBrand => b !== null),
    }))
    .filter((section) => section.items.length > 0)
}
