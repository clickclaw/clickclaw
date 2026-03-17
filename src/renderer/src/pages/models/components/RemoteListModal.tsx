import { useEffect, useState } from 'react'
import { Button, Checkbox, Modal, Skeleton } from 'antd'
import { useTranslation } from 'react-i18next'
import type { RemoteListModalProps } from '../model-page.types'

export function RemoteListModal({
  open,
  loading,
  remoteModels,
  existingModelIds,
  onClose,
  onAdd,
}: RemoteListModalProps): React.ReactElement {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (open) setSelected([])
  }, [open])

  const toggle = (id: string) => {
    if (existingModelIds.includes(id)) return
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  return (
    <Modal
      title={t('models.fetchRemoteListTitle')}
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            disabled={selected.length === 0}
            onClick={() => {
              onAdd(selected)
              setSelected([])
            }}
            style={{ background: '#FF4D2A', borderColor: '#FF4D2A' }}
          >
            {t('models.fetchRemoteListAdd', { count: selected.length })}
          </Button>
        </div>
      }
      width={480}
    >
      {loading ? (
        <Skeleton active />
      ) : remoteModels.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#bbb', padding: '24px 0' }}>
          {t('models.fetchRemoteListEmpty')}
        </div>
      ) : (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {remoteModels.map((id) => {
            const added = existingModelIds.includes(id)
            const sel = selected.includes(id)
            return (
              <div
                key={id}
                onClick={() => toggle(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 12px',
                  borderRadius: 6,
                  marginBottom: 3,
                  cursor: added ? 'default' : 'pointer',
                  background: sel ? '#fff5f2' : '#fff',
                  border: `1px solid ${sel ? '#FF4D2A40' : '#f0f0f0'}`,
                  opacity: added ? 0.5 : 1,
                }}
              >
                <Checkbox
                  checked={sel || added}
                  disabled={added}
                  onChange={() => toggle(id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <code style={{ fontFamily: 'monospace', fontSize: 13, flex: 1 }}>{id}</code>
                {added && (
                  <span style={{ fontSize: 11, color: '#16a34a' }}>
                    {t('models.fetchRemoteListAdded')}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
