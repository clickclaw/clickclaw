import { useCallback, useEffect, useState } from 'react'
import type { ProviderConfig, ProviderEntry } from '../model-page.types'

export function useProviderQuery() {
  const [providers, setProviders] = useState<ProviderEntry[]>([])
  const [defaultModel, setDefaultModel] = useState<
    string | { primary: string; fallbacks?: string[] } | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [map, def] = await Promise.all([
        window.api.model.listProviders(),
        window.api.model.getDefault(),
      ])
      setProviders(
        Object.entries(map as Record<string, ProviderConfig>).map(([key, config]) => ({
          key,
          config,
        }))
      )
      setDefaultModel(def as string | { primary: string; fallbacks?: string[] } | null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const touch = useCallback(() => {
    loadData()
  }, [loadData])

  return {
    providers,
    defaultModel,
    setDefaultModel,
    loading,
    loadError,
    loadData,
    touch,
  }
}
