import { beforeEach, describe, expect, it, vi } from 'vitest'
import { net } from 'electron'
import { verifySlack } from '../../main/config/channel-presets'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('verifySlack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('socket 模式下校验 botToken 和 appToken', async () => {
    const fetchMock = vi.spyOn(net, 'fetch')
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, url: 'wss://example.slack.com/link' }))

    await expect(
      verifySlack({
        mode: 'socket',
        botToken: 'xoxb-valid',
        appToken: 'xapp-valid',
      })
    ).resolves.toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://slack.com/api/auth.test')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://slack.com/api/apps.connections.open')
  })

  it('botToken 无效时返回 Slack 错误', async () => {
    vi.spyOn(net, 'fetch').mockResolvedValueOnce(jsonResponse({ ok: false, error: 'invalid_auth' }))

    await expect(
      verifySlack({
        mode: 'socket',
        botToken: 'xoxb-invalid',
        appToken: 'xapp-valid',
      })
    ).resolves.toEqual({
      success: false,
      message: 'Bot Token 无效: invalid_auth',
    })
  })

  it('socket 模式下 appToken 无效时返回 Slack 错误', async () => {
    const fetchMock = vi.spyOn(net, 'fetch')
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'invalid_auth' }))

    await expect(
      verifySlack({
        mode: 'socket',
        botToken: 'xoxb-valid',
        appToken: 'xapp-invalid',
      })
    ).resolves.toEqual({
      success: false,
      message: 'App Token 无效: invalid_auth',
    })
  })

  it('http 模式下 botToken 有效且 signingSecret 非空时返回成功', async () => {
    const fetchMock = vi.spyOn(net, 'fetch')
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(
      verifySlack({
        mode: 'http',
        botToken: 'xoxb-valid',
        signingSecret: 'signing-secret',
      })
    ).resolves.toEqual({
      success: true,
      message: 'Bot Token 有效。Signing Secret 将在接收 Slack 回调时完成签名校验。',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
