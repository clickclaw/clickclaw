import type {
  AgentConfig,
  AgentFormValues,
  ToolCatalogEntry,
  ToolEffectiveState,
} from './agents-page.types'

export function resolveToolState(
  toolId: string,
  groupId: string,
  defaultProfiles: string[],
  profile: string,
  allow: string[],
  deny: string[]
): ToolEffectiveState {
  const inProfile = profile === 'full' || defaultProfiles.includes(profile)
  const isDenied = deny.includes(toolId) || deny.includes(groupId)
  const isAllowed = allow.includes(toolId) || allow.includes(groupId)

  if (isDenied) return 'custom-deny'
  if (isAllowed && !inProfile) return 'custom-allow'
  if (inProfile) return 'profile-on'
  return 'profile-off'
}

export function toggleToolState(
  toolId: string,
  groupId: string,
  state: ToolEffectiveState,
  allow: string[],
  deny: string[]
): { allow: string[]; deny: string[] } {
  switch (state) {
    case 'profile-on':
      return { allow, deny: deny.includes(toolId) ? deny : [...deny, toolId] }
    case 'custom-deny':
      return { allow, deny: deny.filter((d) => d !== toolId && d !== groupId) }
    case 'profile-off':
      return { allow: allow.includes(toolId) ? allow : [...allow, toolId], deny }
    case 'custom-allow':
      return { allow: allow.filter((a) => a !== toolId && a !== groupId), deny }
  }
}

export function toggleGroupState(
  groupId: string,
  groupTools: ToolCatalogEntry[],
  profile: string,
  allow: string[],
  deny: string[]
): { allow: string[]; deny: string[] } {
  const allEffectivelyOn = groupTools.every((t) => {
    const s = resolveToolState(t.id, groupId, t.defaultProfiles, profile, allow, deny)
    return s === 'profile-on' || s === 'custom-allow'
  })

  const toolIds = groupTools.map((t) => t.id)
  const allInProfile = groupTools.every(
    (t) => t.defaultProfiles.includes(profile) || profile === 'full'
  )

  if (allEffectivelyOn) {
    return {
      allow: allow.filter((a) => a !== groupId && !toolIds.includes(a)),
      deny: [...deny.filter((d) => d !== groupId && !toolIds.includes(d)), groupId],
    }
  }

  const newDeny = deny.filter((d) => d !== groupId && !toolIds.includes(d))
  if (!allInProfile) {
    return {
      allow: [...allow.filter((a) => a !== groupId && !toolIds.includes(a)), groupId],
      deny: newDeny,
    }
  }
  return { allow: allow.filter((a) => a !== groupId && !toolIds.includes(a)), deny: newDeny }
}

export const PROFILE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  minimal: { color: '#8c8c8c', bg: '#fafafa', border: '#e8e8e8' },
  coding: { color: '#1677ff', bg: '#e6f4ff', border: '#91caff' },
  messaging: { color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7' },
  full: { color: '#389e0d', bg: '#f6ffed', border: '#b7eb8f' },
}

export const GROUP_ICONS: Record<string, string> = {
  'group:fs': '📁',
  'group:runtime': '⚡',
  'group:web': '🌐',
  'group:sessions': '💬',
  'group:memory': '🧠',
  'group:ui': '🖥',
  'group:automation': '⏰',
  'group:messaging': '📨',
  'group:nodes': '🔗',
  'group:openclaw': '🦞',
}

export const PROFILE_ORDER = ['minimal', 'coding', 'messaging', 'full'] as const

export const TOOLS_PROFILE_OPTIONS = [
  { value: 'minimal', labelKey: 'agents.form.toolsProfileMinimal' },
  { value: 'coding', labelKey: 'agents.form.toolsProfileCoding' },
  { value: 'messaging', labelKey: 'agents.form.toolsProfileMessaging' },
  { value: 'full', labelKey: 'agents.form.toolsProfileFull' },
] as const

export const FILE_DESCRIPTIONS: Record<string, { descKey: string; whenKey: string }> = {
  'AGENTS.md': {
    descKey: 'agents.files.desc.agents_md.desc',
    whenKey: 'agents.files.desc.agents_md.when',
  },
  'SOUL.md': {
    descKey: 'agents.files.desc.soul_md.desc',
    whenKey: 'agents.files.desc.soul_md.when',
  },
  'USER.md': {
    descKey: 'agents.files.desc.user_md.desc',
    whenKey: 'agents.files.desc.user_md.when',
  },
  'MEMORY.md': {
    descKey: 'agents.files.desc.memory_md.desc',
    whenKey: 'agents.files.desc.memory_md.when',
  },
  'HEARTBEAT.md': {
    descKey: 'agents.files.desc.heartbeat_md.desc',
    whenKey: 'agents.files.desc.heartbeat_md.when',
  },
  'sessions.json': {
    descKey: 'agents.files.desc.sessions_json.desc',
    whenKey: 'agents.files.desc.sessions_json.when',
  },
  'TOOLS.md': {
    descKey: 'agents.files.desc.tools_md.desc',
    whenKey: 'agents.files.desc.tools_md.when',
  },
  'IDENTITY.md': {
    descKey: 'agents.files.desc.identity_md.desc',
    whenKey: 'agents.files.desc.identity_md.when',
  },
}

export const SKILL_GROUPS = [
  { id: 'workspace', label: 'agents.skills.groupWorkspace', sources: ['openclaw-workspace'] },
  { id: 'built-in', label: 'agents.skills.groupBuiltin', sources: ['openclaw-bundled'] },
  { id: 'installed', label: 'agents.skills.groupInstalled', sources: ['openclaw-managed'] },
  { id: 'extra', label: 'agents.skills.groupExtra', sources: ['openclaw-extra'] },
]

export function formToAgent(values: AgentFormValues): AgentConfig {
  const identity: Record<string, unknown> = {
    name: values.displayName || values.id,
    emoji: values.emoji || '🤖',
  }
  if (values.theme) identity.theme = values.theme

  const agent: AgentConfig = {
    id: values.id,
    name: values.displayName || values.id,
    identity,
    default: values.setAsDefault || false,
  }
  if (values.model) agent.model = values.model
  if (values.toolsProfile) agent.tools = { profile: values.toolsProfile }
  return agent
}
