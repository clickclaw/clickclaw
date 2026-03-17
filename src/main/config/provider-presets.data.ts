/**
 * Provider 预设数据
 *
 * 数据结构：Provider → Platform（子平台）→ Models
 *
 * 字段说明：
 * - color: 品牌主色，用于 UI Monogram 头像背景（无图标时显示）
 * - initials: 2 字母缩写，Monogram 头像文字
 * - tagline: 品牌简短描述，显示在品牌选择器
 * - platforms[0]: 默认平台（ModelPage 品牌选择时使用）
 * - platforms[].apiKeyUrl: 获取 API Key 的页面地址
 * - platforms[].envKey: 写入 .env 时使用的环境变量名
 * - platforms[].models[].input: 支持的输入类型 ["text"] 或 ["text", "image"]
 *
 * 品牌图标：
 *   将 SVG/PNG 放到 src/renderer/src/assets/providers/<key>.svg 即可自动生效
 *   命名规则：文件名 = 此处的 Record key（如 openai.svg、deepseek.png）
 */

import type { ProviderPreset } from './provider-presets'

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  // ==================== 国内 ====================

  volcengine: {
    name: '火山引擎',
    tagline: '字节跳动旗下的云服务与 AI 开放平台。',
    group: 'china',
    color: '#00357F',
    initials: 'VL',
    platforms: [
      {
        key: 'volcengine',
        name: '火山引擎 API',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        api: 'openai-completions',
        apiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
        envKey: 'VOLCENGINE_API_KEY',
        models: [
          {
            id: 'doubao-seed-2-0-pro-260215',
            name: 'doubao-seed-2-0-pro-260215',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-2-0-lite-260215',
            name: 'doubao-seed-2-0-lite-260215',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-2-0-mini-260215',
            name: 'doubao-seed-2-0-mini-260215',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-2-0-code-preview-260215',
            name: 'doubao-seed-2-0-code-preview-260215',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-1-8-251228',
            name: 'doubao-seed-1-8-251228',
            contextWindow: 256000,
            maxTokens: 32000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-code-preview-251028',
            name: 'doubao-seed-code-preview-251028',
            contextWindow: 256000,
            maxTokens: 32000,
            input: ['text', 'image'],
          },
        ],
      },
      {
        key: 'volcengine-plan',
        name: '火山引擎Code Plan',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
        api: 'openai-completions',
        apiKeyUrl:
          'https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&advancedActiveKey=subscribe',
        envKey: 'VOLCENGINE_CODE_API_KEY',
        models: [
          {
            id: 'ark-code-latest',
            name: 'ark-code-latest',
            contextWindow: 256000,
            maxTokens: 32000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-code',
            name: 'doubao-seed-code',
            contextWindow: 256000,
            maxTokens: 32000,
            input: ['text', 'image'],
          },
          {
            id: 'glm-4.7',
            name: 'glm-4.7',
            contextWindow: 200000,
            maxTokens: 128000,
            input: ['text'],
          },
          {
            id: 'deepseek-v3.2',
            name: 'deepseek-v3.2',
            contextWindow: 128000,
            maxTokens: 32000,
            input: ['text'],
          },
          {
            id: 'doubao-seed-2.0-code',
            name: 'doubao-seed-2.0-code',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-2.0-pro',
            name: 'doubao-seed-2.0-pro',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'doubao-seed-2.0-lite',
            name: 'doubao-seed-2.0-lite',
            contextWindow: 256000,
            maxTokens: 128000,
            input: ['text', 'image'],
          },
          {
            id: 'minimax-m2.5',
            name: 'minimax-m2.5',
            contextWindow: 200000,
            maxTokens: 128000,
            input: ['text'],
          },
          {
            id: 'kimi-k2.5',
            name: 'kimi-k2.5',
            contextWindow: 256000,
            maxTokens: 32000,
            input: ['text', 'image'],
          },
        ],
      },
    ],
  },

  moonshot: {
    name: 'Moonshot AI(月之暗面)',
    group: 'china',
    color: '#5b21b6',
    initials: 'MS',
    tagline: '专注大模型研发的中国 AI 公司，代表产品是 Kimi。',
    platforms: [
      {
        key: 'moonshot',
        name: '国内站',
        baseUrl: 'https://api.moonshot.cn/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
        envKey: 'MOONSHOT_API_KEY',
        models: [
          { id: 'kimi-k2.5', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 256000 },
          {
            id: 'kimi-k2-0905-preview',
            name: 'kimi k2 最新版本',
            input: ['text'],
            contextWindow: 256000,
          },
          {
            id: 'kimi-k2-turbo-preview',
            name: 'Kimi k2 高速模型',
            input: ['text'],
            contextWindow: 256000,
          },
          {
            id: 'kimi-k2-thinking',
            name: 'Kimi k2 思考模型',
            input: ['text'],
            contextWindow: 256000,
          },
        ],
      },
      {
        key: 'moonshot-intl',
        name: '国际站',
        baseUrl: 'https://api.moonshot.ai/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://platform.moonshot.ai/console/api-keys',
        envKey: 'MOONSHOT_API_KEY',
        models: [
          { id: 'kimi-k2.5', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 256000 },
          {
            id: 'kimi-k2-0905-preview',
            name: 'kimi k2 最新版本',
            input: ['text'],
            contextWindow: 256000,
          },
          {
            id: 'kimi-k2-turbo-preview',
            name: 'Kimi k2 高速模型',
            input: ['text'],
            contextWindow: 256000,
          },
          {
            id: 'kimi-k2-thinking',
            name: 'Kimi k2 思考模型',
            input: ['text'],
            contextWindow: 256000,
          },
        ],
      },
    ],
  },

  deepseek: {
    name: 'DeepSeek',
    group: 'china',
    color: '#0369a1',
    initials: 'DS',
    tagline: '国内的大模型研发团队，以通用模型和推理模型闻名。',
    platforms: [
      {
        key: 'deepseek',
        name: 'DeepSeek API',
        baseUrl: 'https://api.deepseek.com/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        envKey: 'DEEPSEEK_API_KEY',
        models: [
          {
            id: 'deepseek-chat',
            name: 'DeepSeek Chat',
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 32000,
          },
          {
            id: 'deepseek-reasoner',
            name: 'DeepSeek Reasoner',
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 64000,
          },
        ],
      },
    ],
  },

  minimax: {
    name: 'MiniMax',
    group: 'china',
    color: '#0b7285',
    initials: 'MM',
    tagline: '国内一家做多模态大模型与 AI 应用的公司。',
    platforms: [
      {
        key: 'minimax-cn',
        name: 'MiniMax 国内',
        baseUrl: 'https://api.minimaxi.com/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
        envKey: 'MINIMAX_CN_API_KEY',
        models: [
          { id: 'minimax-m2.5', name: 'minimax-m2.5', input: ['text'] },
          { id: 'minimax-m2.5-highspeed', name: 'minimax-m2.5-highspeed', input: ['text'] },
          { id: 'minimax-m2.1', name: 'minimax-m2.1', input: ['text'] },
        ],
      },
      {
        key: 'minimax-cn-plan',
        name: 'MiniMax 国内 Coding Plan',
        baseUrl: 'https://api.minimaxi.com/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://platform.minimaxi.com/user-center/payment/coding-plan',
        envKey: 'MINIMAX_CN_CODE_API_KEY',
        models: [
          { id: 'minimax-m2.5', name: 'minimax-m2.5', input: ['text'] },
          { id: 'minimax-m2.5-highspeed', name: 'minimax-m2.5-highspeed', input: ['text'] },
          { id: 'minimax-m2.1', name: 'minimax-m2.1', input: ['text'] },
        ],
      },
      {
        key: 'minimax-intl',
        name: 'MiniMax 国际',
        baseUrl: 'https://api.minimax.io/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
        envKey: 'MINIMAX_INTL_API_KEY',
        models: [
          { id: 'minimax-m2.5', name: 'minimax-m2.5', input: ['text'] },
          { id: 'minimax-m2.5-highspeed', name: 'minimax-m2.5-highspeed', input: ['text'] },
          { id: 'minimax-m2.1', name: 'minimax-m2.1', input: ['text'] },
        ],
      },
      {
        key: 'minimax-intl-plan',
        name: 'MiniMax 国际 Coding Plan',
        baseUrl: 'https://api.minimax.io/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://platform.minimaxi.io/user-center/payment/coding-planan',
        envKey: 'MINIMAX_INTL_CODE_API_KEY',
        models: [
          { id: 'minimax-m2.5', name: 'minimax-m2.5', input: ['text'] },
          { id: 'minimax-m2.5-highspeed', name: 'minimax-m2.5-highspeed', input: ['text'] },
          { id: 'minimax-m2.1', name: 'minimax-m2.1', input: ['text'] },
        ],
      },
    ],
  },

  zai: {
    name: 'Z.AI',
    group: 'china',
    color: '#b45309',
    initials: 'ZAI',
    tagline: '国内大模型厂商，核心是 GLM 系列模型与开放平台',
    platforms: [
      {
        key: 'zai-cn',
        name: 'Z.AI 国内基础',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        api: 'openai-completions',
        apiKeyUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
        envKey: 'ZAI_CN_API_KEY',
        models: [
          { id: 'glm-5', name: 'GLM-5', input: ['text'], contextWindow: 200000, maxTokens: 128000 },
          {
            id: 'glm-5-turbo',
            name: 'GLM-5 Turbo(龙虾增强模型)',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7',
            name: 'GLM-4.7',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7-flashx',
            name: 'GLM-4.7 Code',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
        ],
      },
      {
        key: 'zai-cn-plan',
        name: 'Z.AI 国内 Coding Plan',
        baseUrl: 'https://open.bigmodel.cn/api/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
        envKey: 'ZAI_CN_CODE_API_KEY',
        models: [
          { id: 'glm-5', name: 'GLM-5', input: ['text'], contextWindow: 200000, maxTokens: 128000 },
          {
            id: 'glm-5-turbo',
            name: 'GLM-5 Turbo(龙虾增强模型)',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7',
            name: 'GLM-4.7',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7-flashx',
            name: 'GLM-4.7 Code',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
        ],
      },
      {
        key: 'zai-intl',
        name: 'Z.AI 国际基础',
        baseUrl: 'https://api.z.ai/api/paas/v4',
        api: 'openai-completions',
        apiKeyUrl: 'https://z.ai/manage-apikey/apikey-list',
        envKey: 'ZAI_INTL_API_KEY',
        models: [
          { id: 'glm-5', name: 'GLM-5', input: ['text'], contextWindow: 200000, maxTokens: 128000 },
          {
            id: 'glm-5-turbo',
            name: 'GLM-5 Turbo(龙虾增强模型)',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7',
            name: 'GLM-4.7',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7-flashx',
            name: 'GLM-4.7 Code',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
        ],
      },
      {
        key: 'zai-intl-plan',
        name: 'Z.AI 国际 Coding Plan',
        baseUrl: 'https://api.z.ai/api/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://z.ai/model-api',
        envKey: 'ZAI_INTL_CODE_API_KEY',
        models: [
          { id: 'glm-5', name: 'GLM-5', input: ['text'], contextWindow: 200000, maxTokens: 128000 },
          {
            id: 'glm-5-turbo',
            name: 'GLM-5 Turbo(龙虾增强模型)',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7',
            name: 'GLM-4.7',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
          {
            id: 'glm-4.7-flashx',
            name: 'GLM-4.7 Code',
            input: ['text'],
            contextWindow: 200000,
            maxTokens: 128000,
          },
        ],
      },
    ],
  },

  qwen: {
    name: '阿里千问',
    group: 'china',
    color: '#0f766e',
    initials: 'QW',
    tagline: '阿里云旗下的大模型开发与调用平台',
    platforms: [
      {
        key: 'qwen',
        name: '阿里云百炼',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
        envKey: 'DASHSCOPE_API_KEY',
        models: [
          {
            id: 'qwen3-max',
            name: 'qwen3-max',
            contextWindow: 262144,
            maxTokens: 65536,
            input: ['text', 'image'],
          },
          {
            id: 'qwen3-max-2026-01-23',
            name: 'qwen3-max-2026-01-23',
            contextWindow: 262144,
            maxTokens: 65536,
            input: ['text', 'image'],
          },
          {
            id: 'qwen3-max-2025-09-23',
            name: 'qwen3-max-2025-09-23',
            contextWindow: 262144,
            maxTokens: 65536,
            input: ['text'],
          },
          {
            id: 'qwen3-max-preview',
            name: 'qwen3-max-preview',
            contextWindow: 262144,
            maxTokens: 65536,
            input: ['text'],
          },
          {
            id: 'qwen3.5-plus',
            name: 'qwen3.5-plus',
            contextWindow: 1000000,
            maxTokens: 65536,
            input: ['text', 'image'],
          },
          {
            id: 'qwen3.5-plus-2026-02-15',
            name: 'qwen3.5-plus-2026-02-15',
            contextWindow: 1000000,
            maxTokens: 65536,
            input: ['text', 'image'],
          },
          {
            id: 'qwen-plus',
            name: 'qwen-plus',
            contextWindow: 995904,
            maxTokens: 32768,
            input: ['text'],
          },
          {
            id: 'qwen-plus-latest',
            name: 'qwen-plus-latest',
            contextWindow: 995904,
            maxTokens: 32768,
            input: ['text'],
          },
          {
            id: 'qwen-plus-2025-12-01',
            name: 'qwen-plus-2025-12-01',
            contextWindow: 995904,
            maxTokens: 32768,
            input: ['text'],
          },
          {
            id: 'qwen3.5-flash',
            name: 'qwen3.5-flash',
            contextWindow: 1000000,
            maxTokens: 65536,
            input: ['text'],
          },
          {
            id: 'qwen3.5-flash-2026-02-23',
            name: 'qwen3.5-flash-2026-02-23',
            contextWindow: 1000000,
            maxTokens: 65536,
            input: ['text'],
          },
          {
            id: 'qwen-flash',
            name: 'qwen-flash',
            contextWindow: 995904,
            maxTokens: 32768,
            input: ['text'],
          },
          {
            id: 'qwen-flash-2025-07-28',
            name: 'qwen-flash-2025-07-28',
            contextWindow: 995904,
            maxTokens: 32768,
            input: ['text'],
          },
        ],
      },
      {
        key: 'qwen-plan',
        name: '阿里云百炼 Coding Plan',
        baseUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
        envKey: 'DASHSCOPE_CODE_API_KEY',
        models: [
          {
            id: 'qwen3.5-plus',
            name: 'qwen3.5-plus',
            input: ['text', 'image'],
          },
          {
            id: 'qwen3-max-2026-01-23',
            name: 'qwen3-max-2026-01-23',
            input: ['text'],
          },
          {
            id: 'qwen3-coder-next',
            name: 'qwen3-coder-next',
            input: ['text'],
          },
          {
            id: 'qwen3-coder-plus',
            name: 'qwen3-coder-plus',
            input: ['text'],
          },
          {
            id: 'glm-5',
            name: 'glm-5',
            input: ['text'],
          },
          {
            id: 'glm-4.7',
            name: 'glm-4.7',
            input: ['text'],
          },
          {
            id: 'kimi-k2.5',
            name: 'kimi-k2.5',
            input: ['text', 'image'],
          },
          {
            id: 'minimax-m2.5',
            name: 'minimax-m2.5',
            input: ['text'],
          },
        ],
      },
    ],
  },

  qianfan: {
    name: '百度千帆',
    group: 'china',
    color: '#1d4ed8',
    initials: 'QF',
    tagline: '百度智能云推出的大模型平台与应用开发平台',
    platforms: [
      {
        key: 'qianfan',
        name: '千帆 ModelBuilder',
        baseUrl: 'https://qianfan.baidubce.com/v2',
        api: 'openai-completions',
        apiKeyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/key',
        envKey: 'QIANFAN_API_KEY',
        models: [
          {
            id: 'deepseek-v3.2',
            name: 'deepseek-v3.2',
            contextWindow: 98304,
            maxTokens: 32768,
            input: ['text'],
          },
          {
            id: 'ernie-5.0-thinking-preview',
            name: 'ernie-5.0-thinking-preview',
            contextWindow: 119000,
            maxTokens: 64000,
            input: ['text', 'image'],
          },
        ],
      },
    ],
  },

  tencent: {
    name: '腾讯云',
    group: 'china',
    color: '#0078D4',
    initials: 'TC',
    tagline: '腾讯提供云计算、AI 能力和企业服务的平台',
    platforms: [
      {
        key: 'tencent-coding-plan',
        name: '腾讯云 Coding Plan',
        baseUrl: 'https://api.lkeap.cloud.tencent.com/coding/v3',
        api: 'openai-completions',
        apiKeyUrl: 'https://console.cloud.tencent.com/lkeap/api',
        envKey: 'TENCENT_CODE_API_KEY',
        models: [
          {
            id: 'tc-code-latest',
            name: 'Auto',
            input: ['text'],
            contextWindow: 196608,
            maxTokens: 32768,
          },
          {
            id: 'hunyuan-2.0-instruct',
            name: 'Tencent HY 2.0 Instruct',
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 16000,
          },
          {
            id: 'hunyuan-2.0-thinking',
            name: 'Tencent HY 2.0 Think',
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 32000,
          },
          {
            id: 'hunyuan-t1',
            name: 'Hunyuan-T1',
            input: ['text'],
            contextWindow: 64000,
            maxTokens: 32000,
          },
          {
            id: 'hunyuan-turbos',
            name: 'hunyuan-turbos',
            input: ['text'],
            contextWindow: 32000,
            maxTokens: 16000,
          },
          {
            id: 'minimax-m2.5',
            name: 'MiniMax-M2.5',
            input: ['text'],
            contextWindow: 196608,
            maxTokens: 32768,
          },
          {
            id: 'kimi-k2.5',
            name: 'Kimi-K2.5',
            input: ['text', 'image'],
            contextWindow: 262144,
            maxTokens: 32768,
          },
          {
            id: 'glm-5',
            name: 'GLM-5',
            input: ['text'],
            contextWindow: 202752,
            maxTokens: 16384,
          },
        ],
      },
      {
        key: 'tencent',
        name: '腾讯云 Anthropic',
        baseUrl: 'https://api.lkeap.cloud.tencent.com/anthropic',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://console.cloud.tencent.com/lkeap/api',
        envKey: 'TENCENT_API_KEY',
        models: [
          {
            id: 'tc-code-latest',
            name: 'Auto',
            input: ['text'],
            contextWindow: 196608,
            maxTokens: 32768,
          },
          {
            id: 'hunyuan-2.0-instruct',
            name: 'Tencent HY 2.0 Instruct',
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 16000,
          },
          {
            id: 'hunyuan-2.0-thinking',
            name: 'Tencent HY 2.0 Think',
            input: ['text'],
            contextWindow: 128000,
            maxTokens: 32000,
          },
          {
            id: 'hunyuan-t1',
            name: 'Hunyuan-T1',
            input: ['text'],
            contextWindow: 64000,
            maxTokens: 32000,
          },
          {
            id: 'hunyuan-turbos',
            name: 'hunyuan-turbos',
            input: ['text'],
            contextWindow: 32000,
            maxTokens: 16000,
          },
          {
            id: 'minimax-m2.5',
            name: 'MiniMax-M2.5',
            input: ['text'],
            contextWindow: 196608,
            maxTokens: 32768,
          },
          {
            id: 'kimi-k2.5',
            name: 'Kimi-K2.5',
            input: ['text'],
            contextWindow: 262144,
            maxTokens: 32768,
          },
          {
            id: 'glm-5',
            name: 'GLM-5',
            input: ['text'],
            contextWindow: 202752,
            maxTokens: 16384,
          },
        ],
      },
    ],
  },

  // ==================== 国际 ====================

  anthropic: {
    name: 'Anthropic',
    group: 'international',
    color: '#c2410c',
    initials: 'AN',
    tagline: '美国 AI 公司，主要推出 Claude 系列大模型。',
    platforms: [
      {
        key: 'anthropic',
        name: 'Anthropic API',
        baseUrl: 'https://api.anthropic.com',
        api: 'anthropic-messages',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        envKey: 'ANTHROPIC_API_KEY',
        models: [
          { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', input: ['text', 'image'] },
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', input: ['text', 'image'] },
          { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', input: ['text', 'image'] },
          { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', input: ['text', 'image'] },
          { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', input: ['text', 'image'] },
        ],
      },
    ],
  },

  openai: {
    name: 'OpenAI',
    group: 'international',
    color: '#334155',
    initials: 'OA',
    tagline: '开发 GPT 和 ChatGPT 的人工智能公司。',
    platforms: [
      {
        key: 'openai',
        name: 'OpenAI API',
        baseUrl: 'https://api.openai.com/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        envKey: 'OPENAI_API_KEY',
        models: [
          //gpt-5.4
          { id: 'gpt-5.4', name: 'GPT-5.4', input: ['text', 'image'] },
          {
            id: 'gpt-5.4-pro',
            name: 'gpt-5.4-pro',
            input: ['text', 'image'],
          },
          { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', input: ['text', 'image'] },
          { id: 'gpt-5.3', name: 'GPT-5.3 Chat', input: ['text', 'image'] },
          { id: 'gpt-5.2', name: 'GPT-5.2', input: ['text', 'image'] },
          { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', input: ['text', 'image'] },
        ],
      },
    ],
  },

  openrouter: {
    name: 'OpenRouter',
    group: 'international',
    color: '#f97316',
    initials: 'OR',
    tagline: '聚合多个大模型 API 的统一接入平台。',
    platforms: [
      {
        key: 'openrouter',
        name: 'OpenRouter API',
        baseUrl: 'https://openrouter.ai/api/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://openrouter.ai/settings/keys',
        envKey: 'OPENROUTER_API_KEY',
        models: [
          {
            id: 'auto',
            name: 'OpenRouter Auto',
            contextWindow: 200000,
            maxTokens: 8192,
            input: ['text', 'image'],
          },
          {
            id: 'openrouter/hunter-alpha',
            name: 'openrouter/hunter-alpha',
            contextWindow: 1048576,
            maxTokens: 65536,
            input: ['text'],
          },
          {
            id: 'openrouter/healer-alpha',
            name: 'openrouter/healer-alpha',
            contextWindow: 262144,
            maxTokens: 65536,
            input: ['text', 'image'],
          },
          {
            id: 'anthropic/claude-sonnet-4.6',
            name: 'anthropic/claude-sonnet-4.6',
            input: ['text', 'image'],
          },
          {
            id: 'anthropic/claude-opus-4.6',
            name: 'anthropic/claude-opus-4.6',
            input: ['text', 'image'],
          },
          {
            id: 'anthropic/claude-sonnet-4.5',
            name: 'anthropic/claude-sonnet-4.5',
            input: ['text', 'image'],
          },
          {
            id: 'anthropic/claude-haiku-4.5',
            name: 'anthropic/claude-haiku-4.5',
            input: ['text', 'image'],
          },
          {
            id: 'anthropic/claude-opus-4.5',
            name: 'anthropic/claude-opus-4.5',
            input: ['text', 'image'],
          },
          {
            id: 'openai/gpt-5.4',
            name: 'openai/gpt-5.4',
            input: ['text', 'image'],
          },
          {
            id: 'openai/gpt-5-mini',
            name: 'openai/gpt-5-mini',
            input: ['text', 'image'],
          },
          {
            id: 'openai/gpt-5.3-codex',
            name: 'openai/gpt-5.3-codex',
            input: ['text', 'image'],
          },
          {
            id: 'openai/gpt-5.2',
            name: 'openai/gpt-5.2',
            input: ['text', 'image'],
          },
          {
            id: 'openai/gpt-5.2-codex',
            name: 'openai/gpt-5.2-codex',
            input: ['text', 'image'],
          },
          {
            id: 'x-ai/grok-4.1-fast',
            name: 'x-ai/grok-4.1-fast',
            input: ['text', 'image'],
          },
          {
            id: 'x-ai/grok-4-fast',
            name: 'x-ai/grok-4-fast',
            input: ['text', 'image'],
          },
        ],
      },
    ],
  },

  grok: {
    name: 'xAI Grok',
    group: 'international',
    color: '#111827',
    initials: 'GK',
    tagline: 'xAI 推出的 AI 模型与平台，Grok 是其代表产品',
    platforms: [
      {
        key: 'grok',
        name: 'xAI API',
        baseUrl: 'https://api.x.ai/v1',
        api: 'openai-completions',
        apiKeyUrl: 'https://console.x.ai/',
        envKey: 'XAI_API_KEY',
        models: [
          {
            id: 'grok-4.1-fast',
            name: 'grok-4.1-fast',
            input: ['text', 'image'],
          },
          {
            id: 'grok-4-fast',
            name: 'grok-4-fast',
            input: ['text', 'image'],
          },
        ],
      },
    ],
  },

  google: {
    name: 'Google Gemini',
    group: 'international',
    color: '#1d4ed8',
    initials: 'GG',
    tagline: '谷歌推出的 Gemini 大模型及其相关 AI 平台',
    platforms: [
      {
        key: 'google',
        name: 'Google AI Studio',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        api: 'google-generative-ai',
        apiKeyUrl: 'https://aistudio.google.com/apikey',
        envKey: 'GOOGLE_API_KEY',
        models: [
          {
            id: 'gemini-3-flash-preview',
            name: 'Gemini 3 Flash Preview',
            input: ['text', 'image'],
          },
          {
            id: 'gemini-3.1-pro-preview',
            name: 'Gemini 3.1 Pro Preview',
            input: ['text', 'image'],
          },
          {
            id: 'gemini-3.1-flash-lite-preview',
            name: 'Gemini 3.1 Flash Lite Preview',
            input: ['text', 'image'],
          },
          {
            id: 'gemini-3-pro-preview',
            name: 'Gemini 3 Pro Preview',
            input: ['text', 'image'],
          },
        ],
      },
    ],
  },
}
