import { useEffect, useState } from 'react'
import { Button, Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, LockOutlined, StarFilled } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import type { AgentDetailPanelProps } from '../agents-page.types'
import { AgentChannelsTab } from './AgentChannelsTab'
import { AgentCronTab } from './AgentCronTab'
import { AgentFilesTab } from './AgentFilesTab'
import { AgentOverviewTab } from './AgentOverviewTab'
import { AgentSkillsTab } from './AgentSkillsTab'
import { AgentToolsTab } from './AgentToolsTab'

export function AgentDetailPanel({
  agent,
  wsReady,
  callRpc,
  onSaveAgent,
  onDelete,
  onSetDefault,
}: AgentDetailPanelProps): React.ReactElement {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('overview')
  const isMain = agent.id === 'main'
  const displayName = agent.identity?.name || agent.name || agent.id

  useEffect(() => {
    setActiveTab('overview')
  }, [agent.id])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px 0',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { key: 'overview', label: t('agents.tabs.overview') },
            { key: 'channels', label: t('agents.tabs.channels') },
            { key: 'cron', label: t('agents.tabs.cron') },
            { key: 'files', label: t('agents.tabs.files') },
            { key: 'tools', label: t('agents.tabs.tools') },
            { key: 'skills', label: t('agents.tabs.skills') },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px 6px 0 0',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.key ? '#FF4D2A' : 'transparent'}`,
                background: 'transparent',
                color: activeTab === tab.key ? '#FF4D2A' : '#595959',
                fontWeight: activeTab === tab.key ? 600 : 400,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 4, paddingBottom: 4 }}>
          {agent.default && (
            <Tooltip title={t('agents.default')}>
              <StarFilled style={{ color: '#FF4D2A', fontSize: 14, padding: '4px 6px' }} />
            </Tooltip>
          )}
          {!agent.default && !isMain && (
            <Tooltip title={t('agents.setDefault')}>
              <Button
                type="text"
                size="small"
                icon={<StarFilled style={{ color: '#d9d9d9' }} />}
                onClick={() => onSetDefault(agent)}
              />
            </Tooltip>
          )}
          {isMain ? (
            <Tooltip title={t('agents.mainSessionProtected')}>
              <Button type="text" size="small" icon={<LockOutlined />} disabled />
            </Tooltip>
          ) : (
            <Popconfirm
              title={t('agents.deleteConfirmTitle')}
              description={t('agents.deleteConfirmContent', { name: displayName })}
              onConfirm={() => onDelete(agent)}
              okType="danger"
              placement="bottomRight"
            >
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: activeTab === 'files' ? 'hidden' : 'auto',
          padding: activeTab === 'files' ? 0 : '20px 24px',
        }}
      >
        {activeTab === 'overview' && (
          <AgentOverviewTab
            agent={agent}
            wsReady={wsReady}
            callRpc={callRpc}
            onSaveAgent={onSaveAgent}
          />
        )}
        {activeTab === 'files' && (
          <AgentFilesTab agentId={agent.id} wsReady={wsReady} callRpc={callRpc} />
        )}
        {activeTab === 'channels' && <AgentChannelsTab agentId={agent.id} />}
        {activeTab === 'cron' && (
          <AgentCronTab agentId={agent.id} wsReady={wsReady} callRpc={callRpc} />
        )}
        {activeTab === 'tools' && (
          <AgentToolsTab
            agent={agent}
            wsReady={wsReady}
            callRpc={callRpc}
            onSaveAgent={onSaveAgent}
          />
        )}
        {activeTab === 'skills' && (
          <AgentSkillsTab
            agent={agent}
            wsReady={wsReady}
            callRpc={callRpc}
            onSaveAgent={onSaveAgent}
          />
        )}
      </div>
    </div>
  )
}
