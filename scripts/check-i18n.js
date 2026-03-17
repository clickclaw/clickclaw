#!/usr/bin/env node
/**
 * check-i18n.js — i18n 键完整性检查
 *
 * 用法：node scripts/check-i18n.js [--unused]
 *
 * 默认只报告：代码中使用了但 i18n 文件中未定义的 key（missing）
 * 加 --unused 同时报告：i18n 文件中定义了但代码中未使用的 key（unused）
 */

const fs = require('fs')
const path = require('path')

// ─── 配置 ───────────────────────────────────────────────────────────────────

const SRC_DIR = path.resolve(__dirname, '../src/renderer/src')
const LOCALES_DIR = path.resolve(SRC_DIR, 'i18n/locales')

// 以 zh-CN 为基准（定义最全），用 en 做补充校验
const LOCALE_FILES = ['zh-CN.json', 'en.json']

// 扫描的文件扩展名
const FILE_EXTS = ['.tsx', '.ts']

// 排除目录
const EXCLUDE_DIRS = ['i18n', 'node_modules']

// 提取 t('key') 或 t("key") 的正则
// 故意不匹配动态 key（如 t(`xxx.${var}`），它们无法静态分析）
const T_KEY_RE = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g

// 动态 key 模式（用于识别并跳过，避免误报）
const DYNAMIC_T_RE = /\bt\(\s*[`${}]/g

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/** 递归展开 JSON 对象为 dot-notation key 集合 */
function flattenKeys(obj, prefix = '') {
  const keys = new Set()
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const nested of flattenKeys(v, fullKey)) {
        keys.add(nested)
      }
    } else {
      keys.add(fullKey)
    }
  }
  return keys
}

/** 递归遍历目录，返回所有匹配扩展名的文件路径 */
function walkDir(dir, exts, excludeDirs) {
  const results = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (excludeDirs.includes(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, exts, excludeDirs))
    } else if (exts.includes(path.extname(entry.name))) {
      results.push(fullPath)
    }
  }
  return results
}

/** 从单个文件中提取所有静态 t() key，返回 [{key, line}] */
function extractKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const results = []

  // 构建行号索引：字符偏移 → 行号
  const lineOffsets = []
  let offset = 0
  for (const line of lines) {
    lineOffsets.push(offset)
    offset += line.length + 1
  }
  const getLine = (index) => {
    let lo = 0,
      hi = lineOffsets.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (lineOffsets[mid] <= index) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }

  let match
  T_KEY_RE.lastIndex = 0
  while ((match = T_KEY_RE.exec(content)) !== null) {
    results.push({ key: match[1], line: getLine(match.index) })
  }
  return results
}

// ─── 主逻辑 ──────────────────────────────────────────────────────────────────

const showUnused = process.argv.includes('--unused')

// 1. 加载所有 locale 文件，取并集作为"已定义 key"
const definedKeys = new Set()
const localeKeysByFile = {}

for (const localeFile of LOCALE_FILES) {
  const filePath = path.join(LOCALES_DIR, localeFile)
  if (!fs.existsSync(filePath)) {
    console.warn(`[warn] locale 文件不存在：${localeFile}`)
    continue
  }
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const keys = flattenKeys(json)
  localeKeysByFile[localeFile] = keys
  for (const k of keys) definedKeys.add(k)
}

// 2. 扫描源码，收集所有使用到的 key
const sourceFiles = walkDir(SRC_DIR, FILE_EXTS, EXCLUDE_DIRS)

// usedKeys: Map<key, [{file, line}]>
const usedKeys = new Map()

for (const filePath of sourceFiles) {
  const entries = extractKeysFromFile(filePath)
  const relPath = path.relative(SRC_DIR, filePath)
  for (const { key, line } of entries) {
    if (!usedKeys.has(key)) usedKeys.set(key, [])
    usedKeys.get(key).push({ file: relPath, line })
  }
}

// 3. 比较

// missing: 代码中使用了，但 i18n 未定义
const missing = []
for (const [key, usages] of usedKeys.entries()) {
  if (!definedKeys.has(key)) {
    missing.push({ key, usages })
  }
}
missing.sort((a, b) => a.key.localeCompare(b.key))

// unused: i18n 定义了，但代码中未使用
const unusedByLocale = {}
if (showUnused) {
  for (const [localeFile, keys] of Object.entries(localeKeysByFile)) {
    const unused = []
    for (const key of keys) {
      if (!usedKeys.has(key)) {
        unused.push(key)
      }
    }
    unused.sort()
    unusedByLocale[localeFile] = unused
  }
}

// 4. 各 locale 文件之间的 key 对齐检查
const localeFiles = Object.keys(localeKeysByFile)
const mismatchBetweenLocales = []
if (localeFiles.length >= 2) {
  const [primary, ...rest] = localeFiles
  const primaryKeys = localeKeysByFile[primary]
  for (const other of rest) {
    const otherKeys = localeKeysByFile[other]
    const onlyInPrimary = [...primaryKeys].filter((k) => !otherKeys.has(k))
    const onlyInOther = [...otherKeys].filter((k) => !primaryKeys.has(k))
    if (onlyInPrimary.length || onlyInOther.length) {
      mismatchBetweenLocales.push({ primary, other, onlyInPrimary, onlyInOther })
    }
  }
}

// ─── 输出 ────────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

let hasError = false

// ── missing keys ──
if (missing.length === 0) {
  console.log(`${GREEN}✓ 未发现缺失的 i18n key${RESET}`)
} else {
  hasError = true
  console.log(`\n${RED}${BOLD}✗ 缺失 i18n key（代码中使用但未定义）：${missing.length} 个${RESET}`)
  for (const { key, usages } of missing) {
    console.log(`\n  ${RED}${BOLD}${key}${RESET}`)
    for (const { file, line } of usages) {
      console.log(`    ${DIM}→ ${file}:${line}${RESET}`)
    }
  }
  console.log()
}

// ── locale 文件对齐检查 ──
if (mismatchBetweenLocales.length > 0) {
  console.log(`\n${YELLOW}${BOLD}⚠ 各 locale 文件 key 不对齐：${RESET}`)
  for (const { primary, other, onlyInPrimary, onlyInOther } of mismatchBetweenLocales) {
    if (onlyInPrimary.length) {
      console.log(`\n  ${YELLOW}仅在 ${primary} 中存在（${other} 缺失）：${RESET}`)
      for (const k of onlyInPrimary) console.log(`    ${DIM}${k}${RESET}`)
    }
    if (onlyInOther.length) {
      console.log(`\n  ${YELLOW}仅在 ${other} 中存在（${primary} 缺失）：${RESET}`)
      for (const k of onlyInOther) console.log(`    ${DIM}${k}${RESET}`)
    }
  }
  console.log()
}

// ── unused keys ──
if (showUnused) {
  for (const [localeFile, unused] of Object.entries(unusedByLocale)) {
    if (unused.length === 0) {
      console.log(`${GREEN}✓ ${localeFile}：无冗余 key${RESET}`)
    } else {
      console.log(
        `\n${CYAN}${BOLD}● ${localeFile} 中定义了但代码未使用的 key：${unused.length} 个${RESET}`
      )
      for (const k of unused) {
        console.log(`  ${DIM}${k}${RESET}`)
      }
      console.log()
    }
  }
}

// ── 统计摘要 ──
console.log(`${DIM}─────────────────────────────────────${RESET}`)
console.log(`${DIM}扫描文件：${sourceFiles.length} 个${RESET}`)
console.log(`${DIM}发现 key 用法：${usedKeys.size} 个唯一 key${RESET}`)
console.log(`${DIM}已定义 key：${definedKeys.size} 个（所有 locale 合并）${RESET}`)

if (hasError) {
  process.exit(1)
} else {
  process.exit(0)
}
