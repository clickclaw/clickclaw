import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GatewayAgentRow } from '../../../hooks/useGatewayWs'
import type { AgentConfig } from '../agents-page.types'

export function useAgentList(
  status: string,
  listAgents: () => Promise<{ agents: GatewayAgentRow[]; defaultId?: string } | null>
) {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    try {
      const configAgents = (await window.api.agent.list()) as AgentConfig[]
      const configMap = new Map(configAgents.map((a) => [a.id, a]))

      if (status === 'ready') {
        const result = await listAgents()
        if (result) {
          const runtimeIds = new Set(result.agents.map((row) => row.id))
          const runtimeFirst: AgentConfig[] = result.agents.map((row) => {
            const conf = configMap.get(row.id)
            return {
              ...(conf || {}),
              id: row.id,
              name: row.name || row.identity?.name || conf?.name,
              identity: row.identity || conf?.identity,
              default: row.id === result.defaultId || conf?.default,
            }
          })
          const configOnly: AgentConfig[] = configAgents.filter(
            (agent) => !runtimeIds.has(agent.id)
          )
          const list: AgentConfig[] = [...runtimeFirst, ...configOnly]
          setAgents(list)
          setSelectedId((prev) => {
            if (prev && list.some((a) => a.id === prev)) return prev
            return list[0]?.id || null
          })
          return
        }
      }
      const list = configAgents
      setAgents(list)
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev
        return list[0]?.id || null
      })
    } finally {
      setLoading(false)
    }
  }, [status, listAgents])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId]
  )

  return {
    agents,
    loading,
    selectedId,
    selectedAgent,
    setSelectedId,
    loadAgents,
  }
}
