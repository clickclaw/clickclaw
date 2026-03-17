import { beforeEach, describe, expect, it, vi } from 'vitest'

const existsSyncMock = vi.fn()

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: (): string => '/app',
    getPath: (): string => '/tmp/clickclaw-test',
  },
}))

describe('resolveBundledNpmBin', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('在 Windows 下优先使用 runtime/node_modules/npm/bin/npm-cli.js', async () => {
    vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\Admin\\AppData\\Local')
    vi.stubEnv('HOME', '/home/test')

    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    Object.defineProperty(process, 'arch', { value: 'x64' })

    existsSyncMock.mockImplementation((path: string) =>
      path.includes('runtime/node_modules/npm/bin/npm-cli.js')
    )

    const { resolveBundledNpmBin } = await import('../../main/constants')
    expect(resolveBundledNpmBin()).toContain('runtime/node_modules/npm/bin/npm-cli.js')

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })
})
