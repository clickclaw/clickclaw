/**
 * deepMerge 单元测试
 *
 * 测试配置对象合并逻辑：深度递归、数组替换、null 删除键。
 */

import { describe, it, expect } from 'vitest'
import { deepMerge } from '../../main/config/manager'

describe('deepMerge', () => {
  // ─── 基础合并 ───

  it('合并平级对象，source 覆盖 target 同名字段', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 99, c: 3 })
    expect(result).toEqual({ a: 1, b: 99, c: 3 })
  })

  it('target 中 source 未提及的字段保持不变', () => {
    const result = deepMerge({ keep: 'yes', change: 'old' }, { change: 'new' })
    expect(result.keep).toBe('yes')
  })

  it('source 新增字段被加入结果', () => {
    const result = deepMerge({ a: 1 }, { b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  // ─── 深度合并 ───

  it('嵌套对象递归合并，子字段各自独立', () => {
    const target = { models: { providers: { anthropic: { api: 'old' } } } }
    const source = { models: { providers: { openai: { api: 'new' } } } }
    const result = deepMerge(target as Record<string, unknown>, source as Record<string, unknown>)
    expect((result.models as Record<string, unknown>).providers).toEqual({
      anthropic: { api: 'old' },
      openai: { api: 'new' },
    })
  })

  it('深层嵌套：source 只修改指定子字段，不影响兄弟字段', () => {
    const target = { gateway: { port: 18789, bind: 'loopback', mode: 'http' } }
    const source = { gateway: { port: 9999 } }
    const result = deepMerge(target as Record<string, unknown>, source as Record<string, unknown>)
    const gw = result.gateway as Record<string, unknown>
    expect(gw.port).toBe(9999)
    expect(gw.bind).toBe('loopback') // 未被 source 覆盖
    expect(gw.mode).toBe('http') // 未被 source 覆盖
  })

  // ─── 数组行为 ───

  it('数组直接替换，不做合并', () => {
    const target = { list: [1, 2, 3] }
    const source = { list: [4, 5] }
    const result = deepMerge(target as Record<string, unknown>, source as Record<string, unknown>)
    expect(result.list).toEqual([4, 5])
  })

  it('target 是数组、source 是对象时，source 直接替换', () => {
    const target = { data: [1, 2] }
    const source = { data: { key: 'value' } }
    const result = deepMerge(target as Record<string, unknown>, source as Record<string, unknown>)
    expect(result.data).toEqual({ key: 'value' })
  })

  // ─── null / undefined 删除键 ───

  it('source 字段为 null，删除 target 中的对应键', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: null })
    expect('b' in result).toBe(false)
    expect(result.a).toBe(1)
  })

  it('source 字段为 undefined，删除 target 中的对应键', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: undefined })
    expect('b' in result).toBe(false)
  })

  // ─── 不可变性 ───

  it('不修改 target 原对象', () => {
    const target = { a: 1 }
    deepMerge(target, { b: 2 })
    expect(target).toEqual({ a: 1 })
  })

  it('不修改 source 原对象', () => {
    const source = { b: 2 }
    deepMerge({ a: 1 }, source)
    expect(source).toEqual({ b: 2 })
  })

  // ─── 空对象边界 ───

  it('target 为空对象，结果等于 source', () => {
    expect(deepMerge({}, { x: 1, y: 2 })).toEqual({ x: 1, y: 2 })
  })

  it('source 为空对象，结果等于 target', () => {
    expect(deepMerge({ x: 1, y: 2 }, {})).toEqual({ x: 1, y: 2 })
  })

  it('两者均为空对象，结果为空对象', () => {
    expect(deepMerge({}, {})).toEqual({})
  })

  // ─── 实际业务场景 ───

  it('模拟 ensureInsecureAuth：追加 allowedOrigins 而不覆盖 port', () => {
    const current = { gateway: { port: 18789, controlUi: { allowInsecureAuth: true } } }
    const patch = { gateway: { controlUi: { allowedOrigins: ['app://localhost'] } } }
    const result = deepMerge(current as Record<string, unknown>, patch as Record<string, unknown>)
    const gw = result.gateway as Record<string, unknown>
    expect(gw.port).toBe(18789)
    const ui = gw.controlUi as Record<string, unknown>
    expect(ui.allowInsecureAuth).toBe(true)
    expect(ui.allowedOrigins).toEqual(['app://localhost'])
  })
})
