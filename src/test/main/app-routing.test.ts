import { describe, expect, it } from 'vitest'
import { resolveInitialRoute } from '../../main/app-routing'

describe('resolveInitialRoute', () => {
  it('setup 已完成且配置有效时直接进入 dashboard', () => {
    expect(
      resolveInitialRoute({
        hasValidConfig: true,
        hasProviders: true,
        setupCompleted: true,
        hasSeenConfigFoundDialog: false,
      })
    ).toEqual({
      route: '/dashboard',
      hasConfig: false,
    })
  })

  it('仅检测到现有配置但尚未完成 setup 时仍进入 setup', () => {
    expect(
      resolveInitialRoute({
        hasValidConfig: true,
        hasProviders: true,
        setupCompleted: false,
        hasSeenConfigFoundDialog: false,
      })
    ).toEqual({
      route: '/setup',
      hasConfig: true,
      hasProviders: true,
    })
  })

  it('用户已处理过配置发现弹窗且无 provider 时保持在 setup', () => {
    expect(
      resolveInitialRoute({
        hasValidConfig: true,
        hasProviders: false,
        hasSeenConfigFoundDialog: true,
      })
    ).toEqual({
      route: '/setup',
      hasConfig: false,
    })
  })
})
