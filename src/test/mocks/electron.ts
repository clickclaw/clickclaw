export const app = {
  getPath: (): string => '/tmp/clickclaw-test',
  getAppPath: (): string => '/tmp/clickclaw-test-app',
  isPackaged: false,
  getVersion: (): string => '2026.3.9',
}

export const protocol = {
  registerSchemesAsPrivileged: (): void => {},
  handle: (): void => {},
}

export const net = {
  fetch: async (): Promise<Response> => {
    throw new Error('electron.net.fetch mock not implemented')
  },
}
