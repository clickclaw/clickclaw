import { Button, Skeleton, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { RestartGatewayAlert } from '../../components/RestartGatewayAlert'
import PageHeader from '../../components/PageHeader'
import { AgentCreateDrawer } from './components/AgentCreateDrawer'
import { AgentDetailPanel } from './components/AgentDetailPanel'
import { AgentSideItem } from './components/AgentSideItem'
import { NoSelectionState } from './components/NoSelectionState'
import { useAgentPage } from './hooks/useAgentPage'

export default function AgentPage(): React.ReactElement {
  const { t } = useTranslation()
  const {
    agents,
    loading,
    selectedId,
    selectedAgent,
    setSelectedId,
    drawerOpen,
    creating,
    needsRestart,
    callRpc,
    wsReady,
    openCreateDrawer,
    closeCreateDrawer,
    dismissRestart,
    handleSaveAgent,
    handleCreateAgent,
    handleDelete,
    handleSetDefault,
  } = useAgentPage()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 0', flexShrink: 0, background: '#fff' }}>
        <PageHeader
          title={t('agents.title')}
          subtitle={
            !loading && agents.length > 0
              ? t('agents.agentCount', { count: agents.length })
              : undefined
          }
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateDrawer}
              style={{ background: '#FF4D2A', borderColor: '#FF4D2A', fontWeight: 500 }}
            >
              {t('agents.create')}
            </Button>
          }
        />
      </div>

      {needsRestart && (
        <div style={{ flexShrink: 0 }}>
          <RestartGatewayAlert show={needsRestart} onDismiss={dismissRestart} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: 228,
            flexShrink: 0,
            borderRight: '1px solid #eeece9',
            overflowY: 'auto',
            padding: '10px 8px',
            background: '#fff',
          }}
        >
          {loading ? (
            <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{ padding: '10px 12px', borderRadius: 8, opacity: 1 - (i - 1) * 0.3 }}
                >
                  <Skeleton active avatar={{ size: 34, shape: 'square' }} paragraph={false} />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('agents.empty')}
              </Typography.Text>
            </div>
          ) : (
            agents.map((agent) => (
              <AgentSideItem
                key={agent.id}
                agent={agent}
                selected={agent.id === selectedId}
                onClick={() => setSelectedId(agent.id)}
              />
            ))
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', background: '#fff' }}>
          {!selectedAgent ? (
            <NoSelectionState onCreate={openCreateDrawer} />
          ) : (
            <AgentDetailPanel
              agent={selectedAgent}
              wsReady={wsReady}
              callRpc={callRpc}
              onSaveAgent={handleSaveAgent}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          )}
        </div>
      </div>

      <AgentCreateDrawer
        open={drawerOpen}
        onClose={closeCreateDrawer}
        onCreate={handleCreateAgent}
        saving={creating}
      />
    </div>
  )
}
