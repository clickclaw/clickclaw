/**
 * CLI 集成 POSIX 部分单元测试
 *
 * 测试 RC 文件注入块的生成与清除逻辑。
 * 均为纯字符串操作，无文件 I/O，无需 mock。
 */

import { describe, it, expect } from 'vitest'
import { posixBuildRcBlock, posixStripRcBlock } from '../../main/services/cli-integration'

const BIN_DIR = '/home/user/.openclaw/bin'

// ═══════════════════════════════════════════
// posixBuildRcBlock
// ═══════════════════════════════════════════

describe('posixBuildRcBlock', () => {
  it('包含开始标记', () => {
    expect(posixBuildRcBlock(BIN_DIR)).toContain('# >>> clickclaw-cli >>>')
  })

  it('包含结束标记', () => {
    expect(posixBuildRcBlock(BIN_DIR)).toContain('# <<< clickclaw-cli <<<')
  })

  it('包含 export PATH 并引用传入的 binDir', () => {
    const block = posixBuildRcBlock(BIN_DIR)
    expect(block).toContain(`export PATH="${BIN_DIR}:$PATH"`)
  })

  it('不同 binDir 生成不同的块', () => {
    const a = posixBuildRcBlock('/a/bin')
    const b = posixBuildRcBlock('/b/bin')
    expect(a).not.toBe(b)
    expect(a).toContain('/a/bin')
    expect(b).toContain('/b/bin')
  })
})

// ═══════════════════════════════════════════
// posixStripRcBlock
// ═══════════════════════════════════════════

describe('posixStripRcBlock', () => {
  it('内容不含块时原样返回', () => {
    const content = 'export PATH="$HOME/bin:$PATH"\n'
    expect(posixStripRcBlock(content)).toBe(content)
  })

  it('空字符串原样返回', () => {
    expect(posixStripRcBlock('')).toBe('')
  })

  it('只有块时，删除后内容为空或只剩换行', () => {
    const block = posixBuildRcBlock(BIN_DIR)
    const result = posixStripRcBlock(block)
    expect(result.trim()).toBe('')
  })

  it('块在文件末尾时，删除块后前面的内容保留', () => {
    const prefix = 'export EDITOR=vim\n\n'
    const block = posixBuildRcBlock(BIN_DIR)
    const content = prefix + block + '\n'
    const result = posixStripRcBlock(content)
    expect(result).toContain('export EDITOR=vim')
    expect(result).not.toContain('clickclaw-cli')
  })

  it('块在文件开头时，删除块后后面的内容保留', () => {
    const block = posixBuildRcBlock(BIN_DIR)
    const suffix = '\nexport EDITOR=vim\n'
    const content = block + suffix
    const result = posixStripRcBlock(content)
    expect(result).toContain('export EDITOR=vim')
    expect(result).not.toContain('clickclaw-cli')
  })

  it('块在文件中间时，前后内容均保留', () => {
    const before = 'export FOO=bar\n\n'
    const after = '\nexport BAZ=qux\n'
    const block = posixBuildRcBlock(BIN_DIR)
    const content = before + block + after
    const result = posixStripRcBlock(content)
    expect(result).toContain('export FOO=bar')
    expect(result).toContain('export BAZ=qux')
    expect(result).not.toContain('clickclaw-cli')
  })

  it('幂等：连续删除两次，结果与删除一次相同', () => {
    const prefix = 'export EDITOR=vim\n'
    const block = posixBuildRcBlock(BIN_DIR)
    const content = prefix + '\n\n' + block + '\n'
    const once = posixStripRcBlock(content)
    const twice = posixStripRcBlock(once)
    expect(twice).toBe(once)
  })

  it('删除后不含开始标记', () => {
    const content = 'line1\n' + posixBuildRcBlock(BIN_DIR) + '\nline2\n'
    expect(posixStripRcBlock(content)).not.toContain('# >>> clickclaw-cli >>>')
  })

  it('删除后不含结束标记', () => {
    const content = 'line1\n' + posixBuildRcBlock(BIN_DIR) + '\nline2\n'
    expect(posixStripRcBlock(content)).not.toContain('# <<< clickclaw-cli <<<')
  })
})

// ═══════════════════════════════════════════
// 注入 → 清除 往返一致性
// ═══════════════════════════════════════════

describe('RC 块注入 → 清除 往返一致性', () => {
  it('注入块再清除，还原为原始内容', () => {
    const original = 'export EDITOR=vim\nexport LANG=zh_CN.UTF-8\n'
    const block = posixBuildRcBlock(BIN_DIR)
    // 模拟注入（posixInjectRcFile 的核心逻辑）
    const injected = original.trimEnd() + '\n\n' + block + '\n'
    // 清除
    const restored = posixStripRcBlock(injected)
    // 原始内容（去尾空白后）应被保留
    expect(restored.trim()).toBe(original.trim())
  })

  it('重复注入（第二次覆盖第一次）再清除，仍还原为原始内容', () => {
    const original = 'export EDITOR=vim\n'
    const block1 = '\n\n' + posixBuildRcBlock('/old/bin') + '\n'
    // 第二次注入先清除旧块再追加新块
    const afterFirst = original.trimEnd() + block1
    const stripped = posixStripRcBlock(afterFirst)
    const block2 = '\n\n' + posixBuildRcBlock(BIN_DIR) + '\n'
    const afterSecond = stripped.trimEnd() + block2
    // 最终清除
    const result = posixStripRcBlock(afterSecond)
    expect(result.trim()).toBe(original.trim())
    expect(result).not.toContain('clickclaw-cli')
  })
})
