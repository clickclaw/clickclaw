import { useCallback, useEffect, useMemo, useState } from 'react'

interface ModelCatalogEntry {
  id: string
  provider?: string | null
}

interface ConfiguredProvider {
  apiKey?: string
  baseUrl?: string
  api?: string
  models?: Array<{
    id: string
    name?: string
    input?: string[]
  }>
}

type DefaultModelConfig = string | { primary: string; fallbacks?: string[] } | null

interface SessionListRow {
  key?: string
  sessionKey?: string
  model?: string | null
  modelProvider?: string | null
}

interface SessionListResult {
  sessions?: SessionListRow[]
  defaults?: {
    model?: string | null
    modelProvider?: string | null
  }
}

interface ModelOption {
  value: string
  label: string
}

interface SessionsPatchResult {
  resolved?: {
    model?: string
    modelProvider?: string
  }
}

interface UseChatModelSwitcherArgs {
  status: string
  sessionKey: string | null
  isStreaming: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
  onSwitched?: (model: string) => void
}

function buildQualifiedModelValue(model?: string | null, provider?: string | null): string {
  const trimmedModel = model?.trim() || ''
  if (!trimmedModel) return ''
  if (trimmedModel.includes('/')) return trimmedModel
  const trimmedProvider = provider?.trim() || ''
  return trimmedProvider ? `${trimmedProvider}/${trimmedModel}` : trimmedModel
}

function formatModelLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const separator = trimmed.indexOf('/')
  if (separator <= 0) return trimmed
  return `${trimmed.slice(separator + 1)} · ${trimmed.slice(0, separator)}`
}

function buildModelOption(entry: ModelCatalogEntry): ModelOption | null {
  const value = buildQualifiedModelValue(entry.id, entry.provider)
  if (!value) return null
  return { value, label: formatModelLabel(value) }
}

export function useChatModelSwitcher({
  status,
  sessionKey,
  isStreaming,
  callRpc,
  onSwitched,
}: UseChatModelSwitcherArgs) {
  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [switchingModel, setSwitchingModel] = useState(false)
  const [currentModelBySession, setCurrentModelBySession] = useState<Record<string, string>>({})
  const [defaultModel, setDefaultModel] = useState('')

  const fetchSessionModelState = useCallback(async (): Promise<{
    currentModel: string
    defaultModel: string
  }> => {
    if (status !== 'ready' || !sessionKey) {
      return { currentModel: '', defaultModel: '' }
    }

    const [raw, defaultConfig] = await Promise.all([
      callRpc('sessions.list', {
        includeGlobal: true,
        includeUnknown: true,
      }) as Promise<SessionListResult | SessionListRow[]>,
      window.api.model.getDefault() as Promise<DefaultModelConfig>,
    ])

    const result = Array.isArray(raw) ? { sessions: raw } : raw
    const session = (result.sessions || []).find(
      (item) => (item.key || item.sessionKey) === sessionKey
    )
    const defaultValue =
      typeof defaultConfig === 'string' ? defaultConfig : (defaultConfig?.primary ?? '')

    return {
      currentModel: buildQualifiedModelValue(session?.model, session?.modelProvider),
      defaultModel: defaultValue.trim(),
    }
  }, [callRpc, sessionKey, status])

  const loadCurrentSessionModel = useCallback(async (): Promise<void> => {
    if (status !== 'ready' || !sessionKey) {
      return
    }
    const state = await fetchSessionModelState()
    setCurrentModelBySession((prev) => ({ ...prev, [sessionKey]: state.currentModel }))
    setDefaultModel(state.defaultModel)
  }, [fetchSessionModelState, sessionKey, status])

  const currentModel = sessionKey ? (currentModelBySession[sessionKey] ?? '') : ''

  const loadModelCatalog = useCallback(async (): Promise<void> => {
    setLoadingModels(true)
    try {
      const providers = (await window.api.model.listProviders()) as Record<
        string,
        ConfiguredProvider
      >
      const entries: ModelCatalogEntry[] = []

      for (const [providerKey, config] of Object.entries(providers)) {
        for (const model of config.models || []) {
          if (!model.id?.trim()) continue
          entries.push({
            id: model.id,
            provider: providerKey,
          })
        }
      }

      setCatalog(entries)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  useEffect(() => {
    void loadModelCatalog().catch(() => {})
  }, [loadModelCatalog])

  useEffect(() => {
    void loadCurrentSessionModel().catch(() => {})
  }, [loadCurrentSessionModel])

  const options = useMemo(() => {
    const seen = new Set<string>()
    const result: ModelOption[] = []

    const addOption = (option: ModelOption | null) => {
      if (!option) return
      const normalized = option.value.toLowerCase()
      if (seen.has(normalized)) return
      seen.add(normalized)
      result.push(option)
    }

    for (const entry of catalog) {
      addOption(buildModelOption(entry))
    }

    if (currentModel) {
      addOption({ value: currentModel, label: formatModelLabel(currentModel) })
    }

    return result
  }, [catalog, currentModel])

  const handleModelChange = useCallback(
    async (nextValue: string): Promise<void> => {
      if (!sessionKey || status !== 'ready' || switchingModel) return
      const normalizedNext = nextValue.trim()
      if (normalizedNext === currentModel) return

      const prevModel = currentModel
      setCurrentModelBySession((prev) => ({ ...prev, [sessionKey]: normalizedNext }))
      setSwitchingModel(true)
      try {
        const patchResult = (await callRpc('sessions.patch', {
          key: sessionKey,
          model: normalizedNext || null,
        })) as SessionsPatchResult

        const resolvedModel = buildQualifiedModelValue(
          patchResult.resolved?.model,
          patchResult.resolved?.modelProvider
        )

        const verifiedState = await fetchSessionModelState()
        setCurrentModelBySession((prev) => ({
          ...prev,
          [sessionKey]: verifiedState.currentModel,
        }))
        setDefaultModel(verifiedState.defaultModel)

        const expectedModel = normalizedNext || defaultModel
        const actualModel =
          verifiedState.currentModel || resolvedModel || verifiedState.defaultModel

        if (expectedModel && actualModel && expectedModel !== actualModel) {
          throw new Error(`Gateway resolved ${actualModel}, expected ${expectedModel}`)
        }

        console.info('[chat:model-switch]', {
          sessionKey,
          requestedModel: normalizedNext || null,
          resolvedModel: resolvedModel || null,
          verifiedModel: verifiedState.currentModel || null,
          defaultModel: defaultModel || null,
        })

        onSwitched?.(actualModel)
      } catch (error) {
        setCurrentModelBySession((prev) => ({ ...prev, [sessionKey]: prevModel }))
        throw error
      } finally {
        setSwitchingModel(false)
      }
    },
    [
      callRpc,
      currentModel,
      defaultModel,
      fetchSessionModelState,
      loadCurrentSessionModel,
      onSwitched,
      sessionKey,
      status,
      switchingModel,
    ]
  )

  return {
    modelOptions: options,
    currentModel,
    defaultModel,
    loadingModels,
    switchingModel,
    modelSelectDisabled: status !== 'ready' || isStreaming || switchingModel,
    handleModelChange,
  }
}
