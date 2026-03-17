import { Input, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'

interface ChatSessionModalProps {
  open: boolean
  newSessionName: string
  setNewSessionName: (v: string) => void
  newSessionAgentId: string
  setNewSessionAgentId: (v: string) => void
  defaultAgentId: string
  loadingAgents: boolean
  agentOptions: { value: string; label: string }[]
  onConfirm: () => void
  onCancel: () => void
}

export function ChatSessionModal({
  open,
  newSessionName,
  setNewSessionName,
  newSessionAgentId,
  setNewSessionAgentId,
  defaultAgentId,
  loadingAgents,
  agentOptions,
  onConfirm,
  onCancel,
}: ChatSessionModalProps): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Modal
      title={t('chat.sessions.newSessionTitle')}
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{ style: { background: '#FF4D2A', borderColor: '#FF4D2A' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>
            {t('chat.sessions.newSessionNameLabel')}
          </div>
          <Input
            autoFocus
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder={t('chat.sessions.newSessionNamePlaceholder')}
            onPressEnter={onConfirm}
          />
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>
            {t('chat.sessions.newSessionAgentLabel')}
          </div>
          <Select
            style={{ width: '100%' }}
            value={newSessionAgentId || defaultAgentId}
            onChange={setNewSessionAgentId}
            loading={loadingAgents}
            placeholder={t('chat.sessions.newSessionAgentPlaceholder')}
            options={agentOptions}
          />
        </div>
      </div>
    </Modal>
  )
}
