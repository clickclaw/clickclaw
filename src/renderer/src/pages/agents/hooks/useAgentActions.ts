import { App } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentConfig, AgentFormValues } from '../agents-page.types'
import { formToAgent } from '../agents-page.utils'

interface UseAgentActionsArgs {
  agents: AgentConfig[]
  loadAgents: () => Promise<void>
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  wsReady: boolean
  callRpc: (method: string, params: unknown) => Promise<unknown>
}

function resolveDefaultWorkspace(agentId: string): string {
  const normalized = agentId.trim().toLowerCase()
  if (normalized === 'main') return '~/.openclaw/workspace'
  return `~/.openclaw/workspace-${normalized}`
}

function buildSetDefaultPatch(agents: AgentConfig[], targetAgentId: string): string {
  const targetId = targetAgentId.trim().toLowerCase()
  const list = agents
    .filter((item) => typeof item.id === 'string' && item.id.trim())
    .map((item) => ({
      id: item.id,
      default: item.id.trim().toLowerCase() === targetId,
    }))

  return JSON.stringify({
    agents: { list },
  })
}

export function useAgentActions({
  agents,
  loadAgents,
  setSelectedId,
  wsReady,
  callRpc,
}: UseAgentActionsArgs) {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const openCreateDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeCreateDrawer = useCallback(() => {
    if (!creating) setDrawerOpen(false)
  }, [creating])

  const handleSaveAgent = useCallback(
    async (updated: AgentConfig): Promise<void> => {
      await window.api.agent.save(updated)
      if (updated.default && updated.id) {
        await window.api.agent.setDefault(updated.id)
      }
      await loadAgents()
    },
    [loadAgents]
  )

  const handleCreateAgent = useCallback(
    async (values: AgentFormValues): Promise<void> => {
      setCreating(true)
      try {
        const agentData = formToAgent(values)
        let saved: AgentConfig

        if (wsReady) {
          try {
            const createResult = (await callRpc('agents.create', {
              name: values.id,
              workspace: resolveDefaultWorkspace(values.id),
              emoji: values.emoji || undefined,
            })) as { agentId?: string }
            const createdId = createResult?.agentId || values.id
            saved = (await window.api.agent.save({ ...agentData, id: createdId })) as AgentConfig
          } catch {
            saved = (await window.api.agent.save(agentData)) as AgentConfig
          }
        } else {
          saved = (await window.api.agent.save(agentData)) as AgentConfig
        }

        if (values.setAsDefault && saved.id) {
          await window.api.agent.setDefault(saved.id)
        }
        message.success(t('agents.saveSuccess'))
        setDrawerOpen(false)
        if (saved.id) setSelectedId(saved.id)
        await loadAgents()
      } catch (err) {
        message.error(
          t('agents.saveFailed', { error: err instanceof Error ? err.message : String(err) })
        )
      } finally {
        setCreating(false)
      }
    },
    [callRpc, loadAgents, message, setSelectedId, t, wsReady]
  )

  const handleDelete = useCallback(
    async (agent: AgentConfig): Promise<void> => {
      if (agent.id === 'main') return
      if (wsReady) {
        try {
          await callRpc('agents.delete', { agentId: agent.id, deleteFiles: true })
        } catch {
          await window.api.agent.delete(agent.id)
        }
      } else {
        await window.api.agent.delete(agent.id)
      }
      message.success(t('agents.deleteSuccess'))
      setSelectedId((prev) => {
        if (prev !== agent.id) return prev
        const remaining = agents.filter((a) => a.id !== agent.id)
        return remaining[0]?.id || null
      })
      await loadAgents()
    },
    [agents, callRpc, loadAgents, message, setSelectedId, t, wsReady]
  )

  const handleSetDefault = useCallback(
    async (agent: AgentConfig): Promise<void> => {
      if (wsReady) {
        try {
          await callRpc('config.patch', {
            raw: buildSetDefaultPatch(agents, agent.id),
            note: `clickclaw:set-default-agent:${agent.id}`,
          })
        } catch {
          await window.api.agent.setDefault(agent.id)
        }
      } else {
        await window.api.agent.setDefault(agent.id)
      }
      message.success(t('agents.setDefaultSuccess'))
      await loadAgents()
    },
    [agents, callRpc, loadAgents, message, t, wsReady]
  )

  return {
    drawerOpen,
    creating,
    openCreateDrawer,
    closeCreateDrawer,
    handleSaveAgent,
    handleCreateAgent,
    handleDelete,
    handleSetDefault,
  }
}
