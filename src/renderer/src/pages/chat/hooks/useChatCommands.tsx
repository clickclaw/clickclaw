import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import {
  InfoCircleOutlined,
  MessageOutlined,
  SettingOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'

export function useChatCommands(t: TFunction) {
  return useMemo(() => {
    const cmd = (value: string, descKey: string) => ({
      label: value,
      value,
      extra: (
        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
          {t(`chat.commands.${descKey}`)}
        </span>
      ),
    })

    return [
      {
        label: t('chat.commands.groupSession'),
        value: 'group-session',
        icon: <MessageOutlined />,
        children: [
          cmd('/session', 'session'),
          cmd('/stop', 'stop'),
          cmd('/reset', 'reset'),
          cmd('/new', 'new'),
          cmd('/compact', 'compact'),
        ],
      },
      {
        label: t('chat.commands.groupOptions'),
        value: 'group-options',
        icon: <ThunderboltOutlined />,
        children: [
          cmd('/usage', 'usage'),
          cmd('/think', 'think'),
          cmd('/verbose', 'verbose'),
          cmd('/reasoning', 'reasoning'),
          cmd('/elevated', 'elevated'),
          cmd('/exec', 'exec'),
          cmd('/model', 'model'),
          cmd('/models', 'models'),
          cmd('/queue', 'queue'),
        ],
      },
      {
        label: t('chat.commands.groupStatus'),
        value: 'group-status',
        icon: <InfoCircleOutlined />,
        children: [
          cmd('/help', 'help'),
          cmd('/commands', 'commands'),
          cmd('/status', 'status'),
          cmd('/context', 'context'),
          cmd('/export-session', 'exportSession'),
          cmd('/whoami', 'whoami'),
        ],
      },
      {
        label: t('chat.commands.groupManagement'),
        value: 'group-management',
        icon: <SettingOutlined />,
        children: [
          cmd('/allowlist', 'allowlist'),
          cmd('/approve', 'approve'),
          cmd('/subagents', 'subagents'),
          cmd('/acp', 'acp'),
          cmd('/focus', 'focus'),
          cmd('/unfocus', 'unfocus'),
          cmd('/agents', 'agents'),
          cmd('/kill', 'kill'),
          cmd('/steer', 'steer'),
          cmd('/activation', 'activation'),
          cmd('/send', 'send'),
        ],
      },
      {
        label: t('chat.commands.groupMedia'),
        value: 'group-media',
        icon: <SoundOutlined />,
        children: [cmd('/tts', 'tts')],
      },
      {
        label: t('chat.commands.groupTools'),
        value: 'group-tools',
        icon: <ToolOutlined />,
        children: [cmd('/skill', 'skill'), cmd('/restart', 'restart')],
      },
    ]
  }, [t])
}
