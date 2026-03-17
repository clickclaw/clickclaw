export function resolveInitialRoute(params: {
  hasValidConfig: boolean
  hasProviders: boolean
  setupCompleted?: boolean
  hasSeenConfigFoundDialog?: boolean
}): { route: '/setup' | '/dashboard'; hasConfig: boolean; hasProviders?: boolean } {
  if (params.setupCompleted && params.hasValidConfig && params.hasProviders) {
    return { route: '/dashboard', hasConfig: false }
  }

  if (params.hasValidConfig && params.hasSeenConfigFoundDialog) {
    return {
      route: params.hasProviders ? '/dashboard' : '/setup',
      hasConfig: false,
    }
  }

  if (params.hasValidConfig && params.hasProviders) {
    return { route: '/setup', hasConfig: true, hasProviders: true }
  }
  if (params.hasValidConfig) {
    return { route: '/setup', hasConfig: true }
  }
  return { route: '/setup', hasConfig: false }
}
