/**
 * env-file 单元测试
 *
 * 测试 .env 文件解析和值引号处理逻辑。
 * 均为纯函数，无文件 I/O，无需 mock。
 */

import { describe, it, expect } from 'vitest'
import { parseEnv, quoteValue } from '../../main/config/env-file'

// ═══════════════════════════════════════════
// parseEnv
// ═══════════════════════════════════════════

describe('parseEnv', () => {
  it('空字符串返回空对象', () => {
    expect(parseEnv('')).toEqual({})
  })

  it('解析基本 KEY=VALUE', () => {
    expect(parseEnv('FOO=bar')).toEqual({ FOO: 'bar' })
  })

  it('解析多行', () => {
    const raw = 'A=1\nB=2\nC=3'
    expect(parseEnv(raw)).toEqual({ A: '1', B: '2', C: '3' })
  })

  it('# 开头的注释行被忽略', () => {
    const raw = '# this is a comment\nKEY=value'
    expect(parseEnv(raw)).toEqual({ KEY: 'value' })
  })

  it('空行被忽略', () => {
    const raw = '\n\nKEY=value\n\n'
    expect(parseEnv(raw)).toEqual({ KEY: 'value' })
  })

  it('没有 = 的行被忽略', () => {
    expect(parseEnv('INVALID_LINE')).toEqual({})
  })

  it('双引号包裹的值去除引号', () => {
    expect(parseEnv('KEY="hello world"')).toEqual({ KEY: 'hello world' })
  })

  it('单引号包裹的值去除引号', () => {
    expect(parseEnv("KEY='hello world'")).toEqual({ KEY: 'hello world' })
  })

  it('值中包含 = 号（只按第一个 = 分割）', () => {
    expect(parseEnv('KEY=a=b=c')).toEqual({ KEY: 'a=b=c' })
  })

  it('键名前后有空格时去除空格', () => {
    expect(parseEnv('  KEY  =value')).toEqual({ KEY: 'value' })
  })

  it('混合注释、空行、有效行', () => {
    const raw = [
      '# API Keys',
      '',
      'ANTHROPIC_API_KEY=sk-ant-abc123',
      '# Telegram',
      'TELEGRAM_BOT_TOKEN=1234567890:AABBcc',
    ].join('\n')
    expect(parseEnv(raw)).toEqual({
      ANTHROPIC_API_KEY: 'sk-ant-abc123',
      TELEGRAM_BOT_TOKEN: '1234567890:AABBcc',
    })
  })

  it('行内 # 不作为注释（只有行首 # 才是注释）', () => {
    // KEY=val#ue → 值是 val#ue，不截断
    expect(parseEnv('KEY=val#ue')).toEqual({ KEY: 'val#ue' })
  })

  it('Windows 风格 CRLF 换行正常解析', () => {
    expect(parseEnv('A=1\r\nB=2')).toEqual({ A: '1', B: '2' })
  })
})

// ═══════════════════════════════════════════
// quoteValue
// ═══════════════════════════════════════════

describe('quoteValue', () => {
  it('纯字母数字值不加引号', () => {
    expect(quoteValue('sk-ant-abc123')).toBe('sk-ant-abc123')
  })

  it('含空格的值用双引号包裹', () => {
    expect(quoteValue('hello world')).toBe('"hello world"')
  })

  it('含 # 的值用双引号包裹（防止被误认为注释）', () => {
    expect(quoteValue('val#ue')).toBe('"val#ue"')
  })

  it('含双引号的值：引号被转义并整体加双引号', () => {
    expect(quoteValue('say "hello"')).toBe('"say \\"hello\\""')
  })

  it('含反斜杠的值：反斜杠被转义', () => {
    expect(quoteValue('C:\\path')).toBe('"C:\\\\path"')
  })

  it('含单引号的值用双引号包裹', () => {
    expect(quoteValue("it's")).toBe('"it\'s"')
  })

  it('空字符串不加引号', () => {
    expect(quoteValue('')).toBe('')
  })

  it('quoteValue 输出的值经 parseEnv 解析后还原原始值（往返一致性）', () => {
    const original = 'my secret key with spaces'
    const quoted = quoteValue(original)
    const parsed = parseEnv(`KEY=${quoted}`)
    expect(parsed.KEY).toBe(original)
  })

  it('含特殊字符的 API Key 往返一致', () => {
    const apiKey = 'sk-ant+abc/def=xyz'
    // 不含特殊触发字符，应原样返回
    expect(quoteValue(apiKey)).toBe(apiKey)
    const parsed = parseEnv(`ANTHROPIC_API_KEY=${quoteValue(apiKey)}`)
    expect(parsed.ANTHROPIC_API_KEY).toBe(apiKey)
  })
})
