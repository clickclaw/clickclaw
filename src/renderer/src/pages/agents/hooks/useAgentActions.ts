import { App } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentConfig, AgentFormValues } from '../agents-page.types'
import { formToAgent } from '../agents-page.utils'

interface UseAgentActionsArgs {
  agents: AgentConfig[]
  loadAgents: () => Promise<void>
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>
}

export function useAgentActions({ agents, loadAgents, setSelectedId }: UseAgentActionsArgs) {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [needsRestart, setNeedsRestart] = useState(false)

  const openCreateDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeCreateDrawer = useCallback(() => {
    if (!creating) setDrawerOpen(false)
  }, [creating])
  const dismissRestart = useCallback(() => setNeedsRestart(false), [])

  const handleSaveAgent = useCallback(
    async (updated: AgentConfig): Promise<void> => {
      await window.api.agent.save(updated)
      if (updated.default && updated.id) {
        await window.api.agent.setDefault(updated.id)
      }
      setNeedsRestart(true)
      await loadAgents()
    },
    [loadAgents]
  )

  const handleCreateAgent = useCallback(
    async (values: AgentFormValues): Promise<void> => {
      setCreating(true)
      try {
        const agentData = formToAgent(values)
        const saved = (await window.api.agent.save(agentData)) as AgentConfig
        if (values.setAsDefault && saved.id) {
          await window.api.agent.setDefault(saved.id)
        }
        message.success(t('agents.saveSuccess'))
        setDrawerOpen(false)
        setNeedsRestart(true)
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
    [loadAgents, message, setSelectedId, t]
  )

  const handleDelete = useCallback(
    async (agent: AgentConfig): Promise<void> => {
      if (agent.id === 'main') return
      await window.api.agent.delete(agent.id)
      message.success(t('agents.deleteSuccess'))
      setNeedsRestart(true)
      setSelectedId((prev) => {
        if (prev !== agent.id) return prev
        const remaining = agents.filter((a) => a.id !== agent.id)
        return remaining[0]?.id || null
      })
      await loadAgents()
    },
    [agents, loadAgents, message, setSelectedId, t]
  )

  const handleSetDefault = useCallback(
    async (agent: AgentConfig): Promise<void> => {
      await window.api.agent.setDefault(agent.id)
      message.success(t('agents.setDefaultSuccess'))
      setNeedsRestart(true)
      await loadAgents()
    },
    [loadAgents, message, t]
  )

  return {
    drawerOpen,
    creating,
    needsRestart,
    openCreateDrawer,
    closeCreateDrawer,
    dismissRestart,
    handleSaveAgent,
    handleCreateAgent,
    handleDelete,
    handleSetDefault,
  }
}
