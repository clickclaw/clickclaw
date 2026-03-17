/**
 * 品牌图标自动注册
 *
 * 使用 Vite import.meta.glob 批量导入资源目录下的所有图片。
 * 新增品牌图标只需将文件放入对应目录，命名规则：<preset-key>.<ext>
 *
 * 目录：
 *   assets/providers/  ← AI 模型提供商（openai.svg / deepseek.png / ...）
 *   assets/channels/   ← IM 渠道（feishu.svg / telegram.png / ...）
 *
 * 支持格式：SVG（优先）、PNG、WebP
 */

const providerLogos = import.meta.glob('./providers/*.{svg,png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const channelLogos = import.meta.glob('./channels/*.{svg,png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const brandsLogos = import.meta.glob('./brands/*.{svg,png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

/**
 * 获取 AI 模型提供商 logo URL
 * @param key  Provider preset key，如 "openai"、"deepseek"
 * @returns    打包后的资源 URL，未找到时返回 undefined（组件自动降级到 Monogram）
 */
export function getProviderLogo(key: string): string | undefined {
  return (
    providerLogos[`./providers/${key}.svg`] ??
    providerLogos[`./providers/${key}.png`] ??
    providerLogos[`./providers/${key}.webp`]
  )
}

/**
 * 获取 IM 渠道 logo URL
 * @param key  Channel preset key，如 "feishu"、"telegram"
 * @returns    打包后的资源 URL，未找到时返回 undefined（组件自动降级到 Monogram）
 */
export function getChannelLogo(key: string): string | undefined {
  return (
    channelLogos[`./channels/${key}.svg`] ??
    channelLogos[`./channels/${key}.png`] ??
    channelLogos[`./channels/${key}.webp`]
  )
}

/**
 * 获取品牌 logo URL
 * @param key  Brand key
 * @returns    打包后的资源 URL，未找到时返回 undefined
 */
export function getBrandLogo(key: string): string | undefined {
  const normalized = key
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
  return (
    brandsLogos[`./brands/${normalized}.svg`] ??
    brandsLogos[`./brands/${normalized}.png`] ??
    brandsLogos[`./brands/${normalized}.webp`]
  )
}
