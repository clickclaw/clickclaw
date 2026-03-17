/**
 * 配对审批弹窗
 *
 * 当检测到有 dmPolicy=pairing 的渠道有待审批配对请求时自动弹出。
 * 用户可以批准或拒绝，每次展示最早的一个请求，依次处理。
 */

import { useState, useEffect, useCallback } from 'react'
import { Modal, Button, Tag, Typography, Space, App, Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

const { Text } = Typography

// ========== 类型定义（与 main 进程对齐）==========

interface PairingRequest {
  code: string
  id: string
  name: string
  createdAt: string
  lastSeenAt: string
}

interface PairingRequestWithChannel extends PairingRequest {
  channel: string
}

interface PairingState {
  pendingCount: number
  requests: PairingRequestWithChannel[]
  updatedAt: number
}

// ========== 渠道名称映射 ==========

const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  feishu: '飞书',
  wecom: '企业微信',
  qqbot: 'QQ Bot',
  'dingtalk-connector': '钉钉',
  telegram: 'Telegram',
  discord: 'Discord',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
  bluebubbles: 'BlueBubbles',
  signal: 'Signal',
}

function getChannelName(channel: string): string {
  return CHANNEL_DISPLAY_NAMES[channel] || channel
}

function formatTime(isoStr: string): string {
  if (!isoStr) return ''
  try {
    return new Date(isoStr).toLocaleString()
  } catch {
    return isoStr
  }
}

// ========== 组件 ==========

export function PairingApprovalModal(): React.ReactElement | null {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const [pairingState, setPairingState] = useState<PairingState | null>(null)
  const [approving, setApproving] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  // 订阅配对状态变化
  useEffect(() => {
    // 初始获取状态
    window.api.pairing.getState().then((state) => {
      setPairingState(state as PairingState)
    })

    // 监听实时更新
    const unsubscribe = window.api.pairing.onStateChanged((state) => {
      setPairingState(state as PairingState)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // 当 state 变化时重置当前展示的请求索引（防止越界）
  useEffect(() => {
    if (pairingState) {
      setCurrentIdx((prev) => {
        if (prev >= pairingState.requests.length) return 0
        return prev
      })
    }
  }, [pairingState])

  const currentRequest: PairingRequestWithChannel | undefined = pairingState?.requests[currentIdx]

  const handleApprove = useCallback(async () => {
    if (!currentRequest) return
    setApproving(true)
    try {
      const result = await window.api.pairing.approve(currentRequest.channel, currentRequest.code)
      if (result.success) {
        message.success(t('pairing.approveSuccess'))
        // 审批成功后当前请求会从列表消失，触发 state 更新
      } else {
        message.error(t('pairing.approveFailed', { error: result.message || 'Unknown' }))
      }
    } catch (err) {
      message.error(
        t('pairing.approveFailed', {
          error: err instanceof Error ? err.message : String(err),
        })
      )
    } finally {
      setApproving(false)
    }
  }, [currentRequest, message, t])

  const handleReject = useCallback(async () => {
    if (!currentRequest) return
    await window.api.pairing.reject(currentRequest.channel, currentRequest.code)
    message.info(t('pairing.rejectSuccess'))
    // reject 只是本地标记，state 会在下次轮询后更新，但 UI 应立即响应
    setPairingState((prev) => {
      if (!prev) return prev
      const filtered = prev.requests.filter(
        (r) => !(r.channel === currentRequest.channel && r.code === currentRequest.code)
      )
      return {
        ...prev,
        pendingCount: filtered.length,
        requests: filtered,
      }
    })
  }, [currentRequest, message, t])

  const total = pairingState?.requests.length ?? 0
  const visible = total > 0

  if (!visible) return null

  return (
    <Modal
      open={visible}
      title={
        <Space>
          <span>{t('pairing.modalTitle')}</span>
          <Tag color="orange">{t('pairing.pendingBadge', { count: total })}</Tag>
        </Space>
      }
      footer={null}
      closable={false}
      maskClosable={false}
      width={440}
      styles={{ body: { paddingTop: 8 } }}
    >
      {currentRequest ? (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {/* 渠道标识 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('pairing.channelLabel')}
            </Text>
            <Tag style={{ margin: 0 }}>{getChannelName(currentRequest.channel)}</Tag>
          </div>

          {/* 请求详情卡片 */}
          <div
            style={{
              background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.04))',
              borderRadius: 8,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text strong style={{ fontSize: 15 }}>
              {currentRequest.name || currentRequest.id
                ? t('pairing.requestFrom', { name: currentRequest.name || currentRequest.id })
                : t('pairing.requestAnonymous')}
            </Text>
            <Tooltip title={t('pairing.codeExpireHint')}>
              <Text code style={{ fontSize: 18, letterSpacing: 3, cursor: 'default' }}>
                {currentRequest.code}
              </Text>
            </Tooltip>
            {currentRequest.createdAt && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('pairing.requestTime', { time: formatTime(currentRequest.createdAt) })}
              </Text>
            )}
          </div>

          {/* 多请求提示 */}
          {total > 1 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {currentIdx + 1} / {total}
            </Text>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {total > 1 && currentIdx < total - 1 && (
              <Button size="middle" onClick={() => setCurrentIdx((i) => i + 1)}>
                {t('common.skip')}
              </Button>
            )}
            <Button size="middle" danger onClick={handleReject} disabled={approving}>
              {t('pairing.reject')}
            </Button>
            <Button size="middle" type="primary" loading={approving} onClick={handleApprove}>
              {approving ? t('pairing.approving') : t('pairing.approve')}
            </Button>
          </div>
        </Space>
      ) : (
        <Text type="secondary">{t('pairing.noMore')}</Text>
      )}
    </Modal>
  )
}
