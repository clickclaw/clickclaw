export interface ModelLike {
  id: string
  name?: string
  input?: string[]
}

export function upsertModel<T extends ModelLike>(existing: T[], model: T): T[] {
  const idx = existing.findIndex((m) => m.id === model.id)
  if (idx < 0) return [...existing, model]
  return existing.map((m, i) => (i === idx ? model : m))
}

export function removeModel<T extends ModelLike>(existing: T[], modelId: string): T[] {
  return existing.filter((m) => m.id !== modelId)
}

export function mergeRemoteModels<T extends ModelLike>(existing: T[], modelIds: string[]): T[] {
  const existingIds = new Set(existing.map((m) => m.id))
  const additions = modelIds
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ id, name: id, input: ['text'] }) as T)
  return [...existing, ...additions]
}

export function buildDefaultModelPathIfMissing(
  currentDefaultModel: string | { primary: string; fallbacks?: string[] } | null,
  providerKey: string,
  models: Array<{ id: string }> | undefined
): string | null {
  const currentDefault =
    typeof currentDefaultModel === 'string'
      ? currentDefaultModel
      : (currentDefaultModel?.primary ?? null)
  if (currentDefault) return null
  const firstModelId = models?.[0]?.id
  if (!firstModelId) return null
  return `${providerKey}/${firstModelId}`
}
