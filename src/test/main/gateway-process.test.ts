import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.fn()
const execMock = vi.fn()
const httpGetMock = vi.fn()
const getRuntimeMock = vi.fn()
const resolveGatewayTokenMock = vi.fn()
const markCurrentConfigHealthyMock = vi.fn()
const readConfigMock = vi.fn()
const getSettingsMock = vi.fn()
const buildProxyEnvMock = vi.fn()

vi.mock('child_process', () => ({
  spawn: spawnMock,
  exec: execMock,
}))

vi.mock('http', () => ({
  get: httpGetMock,
}))

vi.mock('fs', () => ({
  existsSync: (): boolean => true,
}))

vi.mock('../../main/runtime', () => ({
  getRuntime: getRuntimeMock,
}))

vi.mock('../../main/gateway/auth', () => ({
  resolveGatewayToken: resolveGatewayTokenMock,
  maskToken: (token: string): string => token,
}))

vi.mock('../../main/config/backup', () => ({
  markCurrentConfigHealthy: markCurrentConfigHealthyMock,
}))

vi.mock('../../main/config', () => ({
  readConfig: readConfigMock,
}))

vi.mock('../../main/settings', () => ({
  getSettings: getSettingsMock,
}))

vi.mock('../../main/utils/proxy', () => ({
  buildProxyEnv: buildProxyEnvMock,
}))

vi.mock('../../main/constants', () => ({
  DEFAULT_PORT: 18789,
  DEFAULT_BIND: 'loopback',
  HEALTH_CHECK_TIMEOUT_MS: 80,
  HEALTH_POLL_INTERVAL_MS: 1,
  CRASH_COOLDOWN_MS: 0,
  MAX_RESTART_ATTEMPTS: 0,
  IS_WIN: false,
}))

type FakeChild = EventEmitter & {
  pid: number
  exitCode: number | null
  stdout: EventEmitter
  stderr: EventEmitter
  kill: (signal?: string) => void
}

function createFakeChild(): FakeChild {
  const proc = new EventEmitter() as FakeChild
  proc.pid = 4321
  proc.exitCode = null
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = (): void => {
    proc.exitCode = 0
    proc.emit('exit', 0, null)
  }
  return proc
}

describe('GatewayProcess', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getRuntimeMock.mockReturnValue({
      getGatewayCwd: () => '/tmp/gateway',
      getEnv: () => ({}),
      getNodePath: () => '/tmp/node',
      getGatewayEntry: () => '/tmp/openclaw.mjs',
    })
    resolveGatewayTokenMock.mockReturnValue('clickclaw-token')
    readConfigMock.mockReturnValue({})
    getSettingsMock.mockReturnValue({})
    buildProxyEnvMock.mockReturnValue({})

    execMock.mockImplementation((_cmd: string, _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
      cb(null, '')
    })
  })

  it('通过 /ready 后进入 running', async () => {
    spawnMock.mockImplementation(() => createFakeChild())
    httpGetMock.mockImplementation(((_url: unknown, cb: (res: { statusCode: number; resume: () => void }) => void) => {
      const req = new EventEmitter() as EventEmitter & {
        setTimeout: (ms: number, fn: () => void) => void
        destroy: () => void
      }
      queueMicrotask(() => cb({ statusCode: 200, resume: () => {} }))
      req.setTimeout = (_ms, _fn) => {}
      req.destroy = () => {}
      return req as never
    }) as any)

    const { createGatewayProcess } = await import('../../main/gateway/process')
    const gw = createGatewayProcess(18789)

    const result = await gw.start()

    expect(result.success).toBe(true)
    expect(gw.getState()).toBe('running')
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('并发 start 会合并到同一个启动任务', async () => {
    spawnMock.mockImplementation(() => createFakeChild())
    httpGetMock.mockImplementation(((_url: unknown, cb: (res: { statusCode: number; resume: () => void }) => void) => {
      const req = new EventEmitter() as EventEmitter & {
        setTimeout: (ms: number, fn: () => void) => void
        destroy: () => void
      }
      setTimeout(() => cb({ statusCode: 200, resume: () => {} }), 0)
      req.setTimeout = (_ms, _fn) => {}
      req.destroy = () => {}
      return req as never
    }) as any)

    const { createGatewayProcess } = await import('../../main/gateway/process')
    const gw = createGatewayProcess(18789)

    const [a, b] = await Promise.all([gw.start(), gw.start()])

    expect(a.success).toBe(true)
    expect(b.success).toBe(true)
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})
