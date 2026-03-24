import { useGatewayContext } from '../../../contexts/GatewayContext'
import { useAgentActions } from './useAgentActions'
import { useAgentList } from './useAgentList'

export function useAgentPage() {
  const { status, listAgents, callRpc } = useGatewayContext()
  const wsReady = status === 'ready'

  const listState = useAgentList(status, listAgents)
  const actions = useAgentActions({
    agents: listState.agents,
    loadAgents: listState.loadAgents,
    setSelectedId: listState.setSelectedId,
    wsReady,
    callRpc,
  })

  return {
    callRpc,
    wsReady,
    ...listState,
    ...actions,
  }
}
