import { StarFilled } from '@ant-design/icons'
import type { AgentSideItemProps } from '../agents-page.types'
import { PROFILE_CONFIG } from '../agents-page.utils'

export function AgentSideItem({
  agent,
  selected,
  onClick,
}: AgentSideItemProps): React.ReactElement {
  const isMain = agent.id === 'main'
  const emoji = agent.identity?.emoji || '🤖'
  const displayName = agent.identity?.name || agent.name || agent.id
  const profile = agent.tools?.profile
  const profileCfg = profile ? PROFILE_CONFIG[profile] : null

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 8,
        marginBottom: 2,
        cursor: 'pointer',
        background: selected ? '#FF4D2A10' : 'transparent',
        borderLeft: `3px solid ${selected ? '#FF4D2A' : 'transparent'}`,
        transition: 'background 0.12s',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          background: selected ? '#FF4D2A18' : isMain ? '#FF4D2A10' : profileCfg?.bg || '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          flexShrink: 0,
        }}
      >
        {emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: selected ? 600 : 500,
            color: selected ? '#FF4D2A' : '#1a1a1a',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: '#aaa',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.id}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
          flexShrink: 0,
        }}
      >
        {agent.default && <StarFilled style={{ fontSize: 10, color: '#FF4D2A' }} />}
        {profile && profileCfg && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: profileCfg.color,
              background: profileCfg.bg,
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            {profile}
          </span>
        )}
      </div>
    </div>
  )
}
