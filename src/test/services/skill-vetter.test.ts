/**
 * Skill 安全审查服务单元测试
 *
 * 覆盖 extractSkillTexts、buildVetPrompt、parseVetResponse 三个导出工具函数。
 * vetSkill 本身依赖网络 + 文件系统，不在此处测试。
 */

import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import {
  extractSkillTexts,
  buildVetPrompt,
  parseVetResponse,
} from '../../main/services/skill-vetter'

// ========== 辅助函数 ==========

/** 创建包含指定文件的 ZIP Buffer */
function createZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip()
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.from(content, 'utf-8'))
  }
  return zip.toBuffer()
}

// ========== extractSkillTexts ==========

describe('extractSkillTexts', () => {
  it('提取常见文本文件', () => {
    const buf = createZip({
      'SKILL.md': '# Hello',
      'index.js': 'console.log("hi")',
      'install.sh': '#!/bin/bash\necho hello',
      'image.png': 'binary',
    })
    const results = extractSkillTexts(buf)
    const names = results.map((r) => r.name)
    expect(names).toContain('SKILL.md')
    expect(names).toContain('index.js')
    expect(names).toContain('install.sh')
    // PNG 不是文本文件，不应包含
    expect(names).not.toContain('image.png')
  })

  it('忽略目录条目', () => {
    const zip = new AdmZip()
    zip.addFile('subdir/', Buffer.alloc(0))
    zip.addFile('subdir/README.md', Buffer.from('# readme'))
    const results = extractSkillTexts(zip.toBuffer())
    const names = results.map((r) => r.name)
    expect(names).toContain('subdir/README.md')
    // 目录条目本身不应出现
    expect(names).not.toContain('subdir/')
  })

  it('单文件内容截断到 8000 字符', () => {
    const longContent = 'a'.repeat(10000)
    const buf = createZip({ 'big.md': longContent })
    const results = extractSkillTexts(buf)
    expect(results).toHaveLength(1)
    expect(results[0].content.length).toBe(8000)
  })

  it('ZIP 为空时返回空数组', () => {
    const zip = new AdmZip()
    const results = extractSkillTexts(zip.toBuffer())
    expect(results).toHaveLength(0)
  })

  it('仅包含二进制文件时返回空数组', () => {
    const buf = createZip({ 'image.png': 'binary', 'data.bin': '\x00\x01\x02' })
    const results = extractSkillTexts(buf)
    expect(results).toHaveLength(0)
  })
})

// ========== buildVetPrompt ==========

describe('buildVetPrompt', () => {
  it('包含 slug 名称', () => {
    const files = [{ name: 'SKILL.md', content: '# my-skill' }]
    const prompt = buildVetPrompt(files, 'my-skill')
    expect(prompt).toContain('my-skill')
  })

  it('包含文件内容', () => {
    const files = [{ name: 'run.sh', content: 'rm -rf /' }]
    const prompt = buildVetPrompt(files, 'test-skill')
    expect(prompt).toContain('rm -rf /')
    expect(prompt).toContain('=== run.sh ===')
  })

  it('包含必要的格式说明', () => {
    const files = [{ name: 'README.md', content: 'hello' }]
    const prompt = buildVetPrompt(files, 'test')
    expect(prompt).toContain('"riskLevel"')
    expect(prompt).toContain('"verdict"')
    expect(prompt).toContain('"redFlags"')
    expect(prompt).toContain('"permissions"')
    expect(prompt).toContain('Return ONLY a JSON object')
  })

  it('多文件都出现在 prompt 中', () => {
    const files = [
      { name: 'a.md', content: 'content-a' },
      { name: 'b.js', content: 'content-b' },
    ]
    const prompt = buildVetPrompt(files, 'multi-skill')
    expect(prompt).toContain('content-a')
    expect(prompt).toContain('content-b')
  })

  it('可根据 locale 指定返回中文说明', () => {
    const files = [{ name: 'README.md', content: 'hello' }]
    const prompt = buildVetPrompt(files, 'test', 'zh-CN')
    expect(prompt).toContain('Simplified Chinese')
  })
})

// ========== parseVetResponse ==========

describe('parseVetResponse', () => {
  const slug = 'test-skill'
  const version = '1.0.0'

  it('正确解析 JSON 格式回复', () => {
    const raw = JSON.stringify({
      riskLevel: 'low',
      verdict: 'safe',
      redFlags: [],
      permissions: {
        files: [],
        network: ['http://localhost:18060'],
        commands: [],
      },
      notes: '仅访问本地服务，未发现明显风险。',
    })

    const result = parseVetResponse(raw, slug, version)
    expect(result.riskLevel).toBe('low')
    expect(result.verdict).toBe('safe')
    expect(result.redFlags).toHaveLength(0)
    expect(result.permissions.network).toContain('http://localhost:18060')
    expect(result.notes).toContain('未发现明显风险')
  })

  it('正确解析低风险回复', () => {
    const raw = `RISK LEVEL: low
VERDICT: safe
RED FLAGS:
- none
PERMISSIONS:
files: none
network: none
commands: none
NOTES: No issues found.`

    const result = parseVetResponse(raw, slug, version)
    expect(result.riskLevel).toBe('low')
    expect(result.verdict).toBe('safe')
    expect(result.redFlags).toHaveLength(0) // "none" 被过滤掉
    expect(result.permissions.files).toHaveLength(0)
    expect(result.permissions.network).toHaveLength(0)
    expect(result.permissions.commands).toHaveLength(0)
    expect(result.notes).toBe('No issues found.')
    expect(result.slug).toBe(slug)
    expect(result.version).toBe(version)
    expect(result.rawReport).toBe(raw)
    expect(result.vetAt).toBeGreaterThan(0)
  })

  it('正确解析极高风险回复', () => {
    const raw = `RISK LEVEL: extreme
VERDICT: unsafe
RED FLAGS:
- Executes rm -rf on system directories
- Sends data to external server
PERMISSIONS:
files: /etc/passwd, /root
network: evil.example.com
commands: rm -rf, curl
NOTES: This skill is malicious.`

    const result = parseVetResponse(raw, slug, version)
    expect(result.riskLevel).toBe('extreme')
    expect(result.verdict).toBe('unsafe')
    expect(result.redFlags).toHaveLength(2)
    expect(result.redFlags[0]).toContain('rm -rf')
    expect(result.permissions.files).toContain('/etc/passwd')
    expect(result.permissions.network).toContain('evil.example.com')
    expect(result.permissions.commands).toContain('rm -rf')
  })

  it('大小写不敏感地解析 RISK LEVEL', () => {
    const raw = `RISK LEVEL: High\nVERDICT: caution\nRED FLAGS:\n- some issue\nPERMISSIONS:\nfiles: none\nnetwork: none\ncommands: none\nNOTES: test`
    const result = parseVetResponse(raw, slug, version)
    expect(result.riskLevel).toBe('high')
    expect(result.verdict).toBe('caution')
  })

  it('缺失字段时返回合理默认值', () => {
    // AI 有时可能返回不规范格式
    const raw = 'No structured response'
    const result = parseVetResponse(raw, slug, version)
    expect(['low', 'medium', 'high', 'extreme']).toContain(result.riskLevel)
    expect(['safe', 'caution', 'unsafe']).toContain(result.verdict)
    expect(Array.isArray(result.redFlags)).toBe(true)
  })

  it('正确过滤 none 占位符', () => {
    const raw = `RISK LEVEL: low
VERDICT: safe
RED FLAGS:
- none
PERMISSIONS:
files: none
network: none
commands: none
NOTES: ok`
    const result = parseVetResponse(raw, slug, version)
    expect(result.redFlags).toHaveLength(0)
  })

  it('正确解析多权限逗号分隔列表', () => {
    const raw = `RISK LEVEL: medium
VERDICT: caution
RED FLAGS:
- Reads config files
PERMISSIONS:
files: ~/.config, /etc
network: api.example.com, cdn.example.com
commands: none
NOTES: Review before installing.`
    const result = parseVetResponse(raw, slug, version)
    expect(result.permissions.files).toHaveLength(2)
    expect(result.permissions.network).toHaveLength(2)
    expect(result.permissions.commands).toHaveLength(0)
  })
})
