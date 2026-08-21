/**
 * 内置常见模型上下文大小表（按厂商分组）：
 * 与 `guessModelType`（类型猜测）同思路，根据模型 ID 猜测 `context`（总上下文）、`output`（最大输出）
 * 与 `support`（能力位，如识图）。精确表覆盖主流裸 ID，家族正则表兜底带日期 / 变体后缀的 ID，
 * 未知模型返回空。家族正则不区分大小写、不锚定开头（子串匹配），兼容 `provider/model` 形式的前缀 ID
 * （如 `deepseek-ai/deepseek-v4-flash`）。
 *
 * 数据来源：@earendil-works/pi-ai@0.84.1（pi.dev 同源权威数据，dist/providers/data/*.json）
 * 核对日期：2026-08-13。表中数值以该包官方厂商条目为准，聚合商（bedrock / groq 等）数值仅作参考。
 * support 能力位来源：各厂商官方文档（如 DeepSeek 视觉指南 api-docs.deepseek.com/guides/vision），
 * 核对日期：2026-08-21；仅标有把握的型号，拿不准的宁缺毋滥。
 */
import type { AiModelSupport } from '@/entity'

export interface AiModelParams {
  context?: number
  output?: number
  /** 模型能力位（识图等），随参数自动填充到模型表单 */
  support?: AiModelSupport[]
}

/** 单个厂商的模型参数预设：精确表 + 家族正则兜底（正则忽略大小写、子串匹配，组内按优先级从上到下，越具体越靠前） */
export interface AiModelProviderPreset {
  name: string
  source: string
  checkedAt: string
  models: Record<string, AiModelParams>
  rules: Array<[RegExp, AiModelParams]>
}

export const AI_MODEL_PROVIDER_PRESETS: AiModelProviderPreset[] = [
  // ==================== OpenAI ====================
  {
    name: 'OpenAI',
    source: '@earendil-works/pi-ai@0.84.1 → providers/data/openai.json',
    checkedAt: '2026-08-13',
    models: {
      // GPT-5 系列（含变体 / pro / 编号版），全系支持视觉
      'gpt-5': { context: 400000, output: 128000, support: ['image'] },
      'gpt-5-mini': { context: 400000, output: 128000, support: ['image'] },
      'gpt-5-nano': { context: 400000, output: 128000, support: ['image'] },
      'gpt-5-pro': { context: 400000, output: 128000, support: ['image'] },
      'gpt-5.1': { context: 400000, output: 128000, support: ['image'] },
      'gpt-5.2': { context: 400000, output: 128000, support: ['image'] },
      'gpt-5.4': { context: 272000, output: 128000, support: ['image'] },
      'gpt-5.4-pro': { context: 1050000, output: 128000, support: ['image'] },
      'gpt-5.5': { context: 272000, output: 128000, support: ['image'] },
      'gpt-5.5-pro': { context: 1050000, output: 128000, support: ['image'] },
      // GPT-4.x / GPT-4o 系列（4o 起支持视觉；gpt-4-turbo 支持视觉，gpt-4 / 32k 不支持）
      'gpt-4o': { context: 128000, output: 16384, support: ['image'] },
      'gpt-4o-mini': { context: 128000, output: 16384, support: ['image'] },
      'chatgpt-4o-latest': { context: 128000, output: 16384, support: ['image'] },
      'gpt-4.1': { context: 1047576, output: 32768, support: ['image'] },
      'gpt-4.1-mini': { context: 1047576, output: 32768, support: ['image'] },
      'gpt-4.1-nano': { context: 1047576, output: 32768, support: ['image'] },
      'gpt-4-turbo': { context: 128000, output: 4096, support: ['image'] },
      'gpt-4': { context: 8192, output: 8192 },
      'gpt-4-32k': { context: 32768, output: 8192 },
      'gpt-3.5-turbo': { context: 16385, output: 4096 },
      // o 系列推理模型（o1 系列纯文本；o3 / o3-pro / o4-mini 支持视觉）
      o1: { context: 200000, output: 100000 },
      'o1-mini': { context: 128000, output: 65536 },
      'o1-preview': { context: 128000, output: 32768 },
      'o1-pro': { context: 200000, output: 100000 },
      o3: { context: 200000, output: 100000, support: ['image'] },
      'o3-mini': { context: 200000, output: 100000 },
      'o3-pro': { context: 200000, output: 100000, support: ['image'] },
      'o4-mini': { context: 200000, output: 100000, support: ['image'] }
    },
    rules: [
      [/gpt-5/i, { context: 400000, output: 128000, support: ['image'] }],
      [/gpt-4\.1/i, { context: 1047576, output: 32768, support: ['image'] }],
      [/gpt-4o/i, { context: 128000, output: 16384, support: ['image'] }],
      [/gpt-4-turbo/i, { context: 128000, output: 4096, support: ['image'] }],
      [/gpt-4-32k/i, { context: 32768, output: 8192 }],
      [/gpt-4/i, { context: 8192, output: 8192 }],
      [/gpt-3\.5-turbo/i, { context: 16385, output: 4096 }],
      [/o4/i, { context: 200000, output: 100000, support: ['image'] }],
      [/o3-mini/i, { context: 200000, output: 100000 }],
      [/o3/i, { context: 200000, output: 100000, support: ['image'] }],
      [/o1/i, { context: 200000, output: 100000 }]
    ]
  },

  // ==================== Anthropic Claude ====================
  {
    name: 'Anthropic',
    source: '@earendil-works/pi-ai@0.84.1 → providers/data/anthropic.json',
    checkedAt: '2026-08-13',
    models: {
      // Claude 5 / 4.x 系列（1M 上下文），Claude 3 起全系支持视觉
      'claude-fable-5': { context: 1000000, output: 128000, support: ['image'] },
      'claude-sonnet-5': { context: 1000000, output: 128000, support: ['image'] },
      'claude-opus-5': { context: 1000000, output: 128000, support: ['image'] },
      'claude-sonnet-4-6': { context: 1000000, output: 128000, support: ['image'] },
      'claude-opus-4-6': { context: 1000000, output: 128000, support: ['image'] },
      'claude-sonnet-4-5': { context: 1000000, output: 64000, support: ['image'] },
      'claude-opus-4-5': { context: 200000, output: 64000, support: ['image'] },
      'claude-haiku-4-5': { context: 200000, output: 64000, support: ['image'] },
      // 旧命名（claude-4-5-sonnet 形式）与早期 4.x
      'claude-4-5-sonnet': { context: 1000000, output: 64000, support: ['image'] },
      'claude-4-5-opus': { context: 200000, output: 64000, support: ['image'] },
      'claude-4-sonnet': { context: 200000, output: 64000, support: ['image'] },
      'claude-4-opus': { context: 200000, output: 64000, support: ['image'] },
      'claude-sonnet-4': { context: 200000, output: 64000, support: ['image'] },
      'claude-opus-4': { context: 200000, output: 32000, support: ['image'] },
      // Claude 3.x 系列
      'claude-3-7-sonnet': { context: 200000, output: 64000, support: ['image'] },
      'claude-3-5-haiku': { context: 200000, output: 8192, support: ['image'] },
      'claude-3-5-sonnet': { context: 200000, output: 8192, support: ['image'] },
      'claude-3-haiku': { context: 200000, output: 4096, support: ['image'] },
      'claude-3-sonnet': { context: 200000, output: 4096, support: ['image'] },
      'claude-3-opus': { context: 200000, output: 4096, support: ['image'] }
    },
    rules: [
      [/claude-4-5/i, { context: 1000000, output: 64000, support: ['image'] }],
      [/claude-4/i, { context: 1000000, output: 128000, support: ['image'] }],
      [/claude-3-7-sonnet/i, { context: 200000, output: 64000, support: ['image'] }],
      [/claude-3-5/i, { context: 200000, output: 8192, support: ['image'] }],
      [/claude-3-/i, { context: 200000, output: 4096, support: ['image'] }],
      [/claude-/i, { context: 1000000, output: 128000, support: ['image'] }]
    ]
  },

  // ==================== Google Gemini ====================
  {
    name: 'Google',
    source: '@earendil-works/pi-ai@0.84.1 → providers/data/google.json',
    checkedAt: '2026-08-13',
    models: {
      // Gemini 1.5 起全系原生多模态（识图）
      'gemini-3.5-flash': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-3.1-pro-preview': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-3-pro': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-3-flash': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-2.5-pro': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-2.5-flash': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-2.5-flash-lite': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-2.0-pro': { context: 1048576, output: 8192, support: ['image'] },
      'gemini-2.0-flash': { context: 1048576, output: 8192, support: ['image'] },
      'gemini-1.5-pro': { context: 1048576, output: 8192, support: ['image'] },
      'gemini-1.5-flash': { context: 1048576, output: 8192, support: ['image'] },
      'gemini-flash-latest': { context: 1048576, output: 65536, support: ['image'] },
      'gemini-pro': { context: 32768, support: ['image'] },
      'gemini-flash': { context: 32768, support: ['image'] }
    },
    rules: [
      [/gemini-3/i, { context: 1048576, output: 65536, support: ['image'] }],
      [/gemini-2\.5/i, { context: 1048576, output: 65536, support: ['image'] }],
      [/gemini-2\.0/i, { context: 1048576, output: 8192, support: ['image'] }],
      [/gemini-1\.5/i, { context: 1048576, output: 8192, support: ['image'] }],
      [/gemini-/i, { context: 1048576, output: 65536, support: ['image'] }]
    ]
  },

  // ==================== DeepSeek ====================
  {
    name: 'DeepSeek',
    source:
      '@earendil-works/pi-ai@0.84.1 → providers/data/deepseek.json；support 依据官方视觉指南 api-docs.deepseek.com/zh-cn/guides/vision',
    checkedAt: '2026-08-21',
    models: {
      // 官方文档：仅 deepseek-v4-flash-vision-exp 支持图像理解，其余模型收图返回 400
      'deepseek-v4-flash': { context: 1000000, output: 384000 },
      'deepseek-v4-pro': { context: 1000000, output: 384000 },
      'deepseek-v4-flash-vision-exp': { context: 1000000, output: 384000, support: ['image'] },
      'deepseek-v3.2': { context: 131072, output: 65536 },
      'deepseek-v3': { context: 128000, output: 8192 },
      'deepseek-chat': { context: 128000, output: 8192 },
      'deepseek-reasoner': { context: 128000, output: 8192 },
      'deepseek-coder': { context: 128000, output: 8192 },
      'deepseek-r1': { context: 128000, output: 8192 }
    },
    rules: [
      [/deepseek-v[\d.]+.*vision/i, { context: 1000000, output: 384000, support: ['image'] }],
      [/deepseek-vision/i, { support: ['image'] }],
      [/deepseek-v4/i, { context: 1000000, output: 384000 }],
      [/deepseek-v3/i, { context: 131072, output: 65536 }],
      [/deepseek-/i, { context: 128000, output: 8192 }]
    ]
  },

  // ==================== Meta Llama ====================
  {
    name: 'Meta Llama',
    source: 'pi-ai@0.84.1 无官方 meta 条目（参考 amazon-bedrock / groq 托管值）',
    checkedAt: '2026-08-13',
    models: {
      // Llama 4 系列与 llama-3.2-11b 为多模态（识图），其余纯文本
      'llama-4-scout': { context: 10000000, support: ['image'] },
      'llama-4-maverick': { context: 1048576, support: ['image'] },
      'llama-3.3-70b': { context: 128000 },
      'llama-3.2-11b': { context: 128000, support: ['image'] },
      'llama-3.2-3b': { context: 128000 },
      'llama-3.2-1b': { context: 128000 },
      'llama-3.1-405b': { context: 128000 },
      'llama-3.1-70b': { context: 128000 },
      'llama-3.1-8b': { context: 128000 },
      'llama-3-70b': { context: 8192 },
      'llama-3-8b': { context: 8192 },
      'llama-2-70b': { context: 4096 },
      'llama-2-13b': { context: 4096 },
      'llama-2-7b': { context: 4096 }
    },
    rules: [
      [/llama-4/i, { context: 1048576, support: ['image'] }],
      [/llama-3\.3/i, { context: 128000 }],
      [/llama-3\.2-11b|llama-3\.2-90b/i, { context: 128000, support: ['image'] }],
      [/llama-3\.2/i, { context: 128000 }],
      [/llama-3\.1/i, { context: 128000 }],
      [/llama-3/i, { context: 8192 }],
      [/llama-2/i, { context: 4096 }]
    ]
  },

  // ==================== 阿里通义千问 Qwen ====================
  {
    name: 'Qwen',
    source: 'pi-ai@0.84.1 → providers/data/qwen-token-plan.json（阿里国际）',
    checkedAt: '2026-08-13',
    models: {
      'qwen3.8-max': { context: 1000000, output: 131072 },
      'qwen3.7-max': { context: 1000000, output: 131072 },
      'qwen3.7-plus': { context: 1000000, output: 65536 },
      'qwen3.6-flash': { context: 1000000, output: 65536 },
      'qwen3.6-plus': { context: 1000000, output: 65536 },
      'qwen3-coder': { context: 131072, output: 32768 },
      'qwen3-235b': { context: 131072, output: 32768 },
      'qwen3-32b': { context: 131072, output: 32768 },
      'qwen3-30b': { context: 131072, output: 32768 },
      'qwen3-14b': { context: 131072, output: 32768 },
      'qwen3-8b': { context: 131072, output: 32768 },
      'qwen2.5-72b': { context: 131072, output: 8192 },
      'qwen2.5-32b': { context: 32768, output: 8192 },
      'qwen2.5-14b': { context: 32768, output: 8192 },
      'qwen2.5-7b': { context: 32768, output: 8192 },
      'qwen2.5-coder': { context: 131072, output: 8192 },
      'qwen-max': { context: 131072, output: 8192 },
      'qwen-plus': { context: 131072, output: 8192 },
      'qwen-turbo': { context: 131072, output: 8192 }
    },
    rules: [
      // VL / QVQ 视觉家族（上下文未收录，仅标能力位）
      [/qwen[\d.-]*-vl/i, { support: ['image'] }],
      [/qvq/i, { support: ['image'] }],
      [/qwen3-coder/i, { context: 131072, output: 32768 }],
      [/qwen3/i, { context: 131072, output: 32768 }],
      [/qwen2\.5-72b/i, { context: 131072, output: 8192 }],
      [/qwen2\.5/i, { context: 32768, output: 8192 }],
      [/qwen2/i, { context: 32768, output: 8192 }],
      [/qwen-/i, { context: 131072, output: 8192 }]
    ]
  },

  // ==================== Mistral ====================
  {
    name: 'Mistral',
    source: '@earendil-works/pi-ai@0.84.1 → providers/data/mistral.json',
    checkedAt: '2026-08-13',
    models: {
      'mistral-large-latest': { context: 262144, output: 262144 },
      'mistral-medium-latest': { context: 262144, output: 262144 },
      'mistral-small-latest': { context: 256000, output: 256000 },
      'mistral-large': { context: 131072, output: 16384 },
      'mistral-medium': { context: 131072, output: 131072 },
      'mistral-small': { context: 128000, output: 16384 },
      'mistral-tiny': { context: 32000 },
      'mistral-7b': { context: 32768 },
      'mistral-8x7b': { context: 32768 },
      'open-mixtral-8x7b': { context: 32000, output: 32000 },
      'open-mixtral-8x22b': { context: 64000, output: 64000 },
      'codestral-latest': { context: 256000, output: 4096 },
      codestral: { context: 32000 },
      'ministral-3b': { context: 128000, output: 128000 },
      'ministral-8b': { context: 128000, output: 128000 },
      'devstral-latest': { context: 262144, output: 262144 },
      'pixtral-12b': { context: 128000, output: 128000, support: ['image'] }
    },
    rules: [
      [/pixtral/i, { context: 128000, output: 128000, support: ['image'] }],
      [/mistral-large/i, { context: 262144, output: 262144 }],
      [/ministral/i, { context: 128000, output: 128000 }],
      [/open-mixtral-8x22b/i, { context: 64000, output: 64000 }],
      [/open-mixtral/i, { context: 32000, output: 32000 }],
      [/mistral-8x7b/i, { context: 32768 }],
      [/mistral-7b/i, { context: 32768 }],
      [/codestral/i, { context: 256000, output: 4096 }],
      [/mistral-tiny/i, { context: 32000 }],
      [/mistral-small/i, { context: 128000, output: 16384 }],
      [/mistral-medium/i, { context: 131072, output: 131072 }],
      [/mistral-/i, { context: 128000, output: 128000 }]
    ]
  },

  // ==================== 月之暗面 Moonshot ====================
  {
    name: 'Moonshot',
    source: '@earendil-works/pi-ai@0.84.1 → providers/data/moonshotai.json',
    checkedAt: '2026-08-13',
    models: {
      'kimi-k3': { context: 1048576, output: 131072 },
      'kimi-k2.7-code': { context: 262144, output: 262144 },
      'kimi-k2.6': { context: 262144, output: 262144 },
      'kimi-k2.5': { context: 262144, output: 262144 },
      'kimi-k2-thinking': { context: 262144, output: 262144 },
      'kimi-k2-turbo': { context: 262144, output: 262144 },
      'kimi-k2': { context: 131072 },
      'kimi-latest': { context: 131072 },
      'moonshot-v1-128k': { context: 131072 },
      'moonshot-v1-32k': { context: 32768 },
      'moonshot-v1-8k': { context: 8192 }
    },
    rules: [
      [/kimi-vl/i, { support: ['image'] }],
      [/moonshot-v[\d.k]+-vision/i, { support: ['image'] }],
      [/moonshot-v1/i, { context: 131072 }],
      [/kimi-/i, { context: 262144, output: 262144 }]
    ]
  },

  // ==================== 其他（Grok / GLM / Command / Yi 等） ====================
  {
    name: 'Others',
    source: 'pi-ai@0.84.1 → providers/data/xai.json / zai.json 等',
    checkedAt: '2026-08-13',
    models: {
      // grok-4 起支持视觉；glm-4v 系列为视觉专用
      'grok-4.3': { context: 1000000, output: 30000, support: ['image'] },
      'grok-3': { context: 131072 },
      'grok-2': { context: 131072 },
      'grok-beta': { context: 8192 },
      'glm-5.2': { context: 1000000, output: 131072 },
      'glm-5-turbo': { context: 200000, output: 131072 },
      'glm-4.7': { context: 204800, output: 131072 },
      'glm-4': { context: 131072 },
      'glm-4-plus': { context: 131072 },
      'glm-4-air': { context: 131072 },
      'glm-4-flash': { context: 131072 },
      'glm-4v': { context: 8192, support: ['image'] },
      'yi-large': { context: 32768 },
      'command-a': { context: 256000, output: 64000 },
      'command-r-plus': { context: 128000 },
      'command-r': { context: 128000 }
    },
    rules: [
      [/glm-\d+v/i, { support: ['image'] }],
      [/glm-5/i, { context: 1000000, output: 131072 }],
      [/glm-4/i, { context: 131072 }],
      [/grok-4/i, { context: 1000000, output: 30000, support: ['image'] }],
      [/grok-/i, { context: 131072 }],
      [/command-a/i, { context: 256000, output: 64000 }],
      [/command-r/i, { context: 128000 }],
      [/command-/i, { context: 128000 }],
      [/yi-/i, { context: 32768 }]
    ]
  }
]

/** 聚合精确表：model id → 参数（id 需小写） */
export const MODEL_PARAMS_TABLE: Record<string, AiModelParams> = Object.assign(
  {},
  ...AI_MODEL_PROVIDER_PRESETS.map((p) => p.models)
)

/** 聚合家族兜底表：按优先级从上到下匹配（正则忽略大小写、子串匹配），命中即返回（组内具体规则在前，组间前缀互不冲突） */
export const FAMILY_PARAMS_RULES: Array<[RegExp, AiModelParams]> =
  AI_MODEL_PROVIDER_PRESETS.flatMap((p) => p.rules)
