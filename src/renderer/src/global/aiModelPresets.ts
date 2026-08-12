/**
 * 内置常见模型上下文大小表：
 * 与 `guessModelType`（类型猜测）同思路，根据模型 ID 猜测 `context`（总上下文 / output（最大输出）。
 * 精确表覆盖主流裸 ID，家族正则表兜底带日期 / 变体后缀的 ID，未知模型返回空。
 * 数据为各官方文档公开的 token 数值（单位：token）。
 */
export interface AiModelParams {
  context?: number
  output?: number
}

/** 精确匹配表：model id → 参数（id 需小写） */
export const MODEL_PARAMS_TABLE: Record<string, AiModelParams> = {
  // ---------- OpenAI ----------
  'gpt-4o': { context: 128000, output: 16384 },
  'gpt-4o-mini': { context: 128000, output: 16384 },
  'chatgpt-4o-latest': { context: 128000, output: 16384 },
  'gpt-4.1': { context: 1047576, output: 32768 },
  'gpt-4.1-mini': { context: 1047576, output: 32768 },
  'gpt-4.1-nano': { context: 1047576, output: 32768 },
  'gpt-4-turbo': { context: 128000, output: 4096 },
  'gpt-4': { context: 8192, output: 8192 },
  'gpt-4-32k': { context: 32768, output: 8192 },
  'gpt-3.5-turbo': { context: 16385, output: 4096 },
  'o1': { context: 200000, output: 100000 },
  'o1-mini': { context: 128000, output: 65536 },
  'o1-preview': { context: 128000, output: 32768 },
  'o3': { context: 200000, output: 100000 },
  'o3-mini': { context: 200000, output: 100000 },
  'o4-mini': { context: 200000, output: 100000 },
  'gpt-5': { context: 400000, output: 128000 },
  'gpt-5-mini': { context: 400000, output: 128000 },
  'gpt-5-nano': { context: 400000, output: 128000 },

  // ---------- Anthropic Claude ----------
  'claude-3-haiku': { context: 200000, output: 4096 },
  'claude-3-sonnet': { context: 200000, output: 4096 },
  'claude-3-opus': { context: 200000, output: 4096 },
  'claude-3-5-haiku': { context: 200000, output: 8192 },
  'claude-3-5-sonnet': { context: 200000, output: 8192 },
  'claude-3-7-sonnet': { context: 200000, output: 64000 },
  'claude-sonnet-4': { context: 200000, output: 64000 },
  'claude-opus-4': { context: 200000, output: 64000 },
  'claude-4-sonnet': { context: 200000, output: 64000 },
  'claude-4-opus': { context: 200000, output: 64000 },
  'claude-4-5-sonnet': { context: 200000, output: 64000 },
  'claude-4-5-opus': { context: 200000, output: 64000 },

  // ---------- Google Gemini ----------
  'gemini-pro': { context: 32768 },
  'gemini-flash': { context: 32768 },
  'gemini-1.5-pro': { context: 1048576, output: 8192 },
  'gemini-1.5-flash': { context: 1048576, output: 8192 },
  'gemini-2.0-flash': { context: 1048576, output: 8192 },
  'gemini-2.0-pro': { context: 1048576, output: 8192 },
  'gemini-2.5-pro': { context: 1048576, output: 65536 },
  'gemini-2.5-flash': { context: 1048576, output: 65536 },
  'gemini-2.5-flash-lite': { context: 1048576, output: 65536 },
  'gemini-3-pro': { context: 1048576, output: 65536 },
  'gemini-3-flash': { context: 1048576, output: 65536 },

  // ---------- DeepSeek ----------
  'deepseek-chat': { context: 128000, output: 8192 },
  'deepseek-reasoner': { context: 128000, output: 8192 },
  'deepseek-coder': { context: 128000, output: 8192 },
  'deepseek-v3': { context: 128000, output: 8192 },
  'deepseek-r1': { context: 128000, output: 8192 },

  // ---------- Meta Llama ----------
  'llama-2-7b': { context: 4096 },
  'llama-2-13b': { context: 4096 },
  'llama-2-70b': { context: 4096 },
  'llama-3-8b': { context: 8192 },
  'llama-3-70b': { context: 8192 },
  'llama-3.1-8b': { context: 128000 },
  'llama-3.1-70b': { context: 128000 },
  'llama-3.1-405b': { context: 128000 },
  'llama-3.2-1b': { context: 128000 },
  'llama-3.2-3b': { context: 128000 },
  'llama-3.2-11b': { context: 128000 },
  'llama-3.3-70b': { context: 128000 },
  'llama-4-scout': { context: 10000000 },
  'llama-4-maverick': { context: 1048576 },

  // ---------- 阿里通义千问 Qwen ----------
  'qwen-turbo': { context: 131072, output: 8192 },
  'qwen-plus': { context: 131072, output: 8192 },
  'qwen-max': { context: 131072, output: 8192 },
  'qwen2.5-7b': { context: 32768, output: 8192 },
  'qwen2.5-14b': { context: 32768, output: 8192 },
  'qwen2.5-32b': { context: 32768, output: 8192 },
  'qwen2.5-72b': { context: 131072, output: 8192 },
  'qwen2.5-coder': { context: 131072, output: 8192 },
  'qwen3-8b': { context: 131072, output: 32768 },
  'qwen3-14b': { context: 131072, output: 32768 },
  'qwen3-30b': { context: 131072, output: 32768 },
  'qwen3-32b': { context: 131072, output: 32768 },
  'qwen3-235b': { context: 131072, output: 32768 },
  'qwen3-coder': { context: 131072, output: 32768 },

  // ---------- Mistral ----------
  'mistral-tiny': { context: 32000 },
  'mistral-small': { context: 32000 },
  'mistral-medium': { context: 32000 },
  'mistral-large': { context: 128000, output: 8192 },
  'mistral-7b': { context: 32768 },
  'mistral-8x7b': { context: 32768 },
  'open-mixtral-8x7b': { context: 32768 },
  'open-mixtral-8x22b': { context: 65536 },
  'codestral': { context: 32000 },
  'ministral-3b': { context: 128000 },
  'ministral-8b': { context: 128000 },

  // ---------- 月之暗面 Moonshot ----------
  'moonshot-v1-8k': { context: 8192 },
  'moonshot-v1-32k': { context: 32768 },
  'moonshot-v1-128k': { context: 131072 },
  'kimi-latest': { context: 131072 },
  'kimi-k2': { context: 131072 },
  'kimi-k2-turbo': { context: 131072 },
  'kimi-k2-thinking': { context: 131072 },

  // ---------- 其他 ----------
  'grok-beta': { context: 8192 },
  'grok-2': { context: 131072 },
  'grok-3': { context: 131072 },
  'glm-4': { context: 131072 },
  'glm-4-plus': { context: 131072 },
  'glm-4-air': { context: 131072 },
  'glm-4-flash': { context: 131072 },
  'glm-4v': { context: 8192 },
  'yi-large': { context: 32768 },
  'command-r': { context: 128000 },
  'command-r-plus': { context: 128000 },
  'command-a': { context: 256000, output: 64000 }
}

/**
 * 家族级兜底表：按优先级从上到下匹配，命中即返回。
 * 用于覆盖精确表之外的变体 ID（带日期 / 版本 / instruct 等后缀），
 * 越具体的规则放越前面（如 `qwen3-coder` 在 `qwen3` 之前）。
 */
export const FAMILY_PARAMS_RULES: Array<[RegExp, AiModelParams]> = [
  [/^gpt-5/, { context: 400000, output: 128000 }],
  [/^gpt-4\.1/, { context: 1047576, output: 32768 }],
  [/^gpt-4o/, { context: 128000, output: 16384 }],
  [/^gpt-4-turbo/, { context: 128000, output: 4096 }],
  [/^gpt-4-32k/, { context: 32768, output: 8192 }],
  [/^gpt-4/, { context: 8192, output: 8192 }],
  [/^gpt-3\.5-turbo/, { context: 16385, output: 4096 }],
  [/^o4/, { context: 200000, output: 100000 }],
  [/^o3/, { context: 200000, output: 100000 }],
  [/^o1/, { context: 128000, output: 65536 }],
  [/^claude-4-5/, { context: 200000, output: 64000 }],
  [/^claude-4/, { context: 200000, output: 64000 }],
  [/^claude-3-7-sonnet/, { context: 200000, output: 64000 }],
  [/^claude-3-5/, { context: 200000, output: 8192 }],
  [/^claude-3-/, { context: 200000, output: 4096 }],
  [/^claude-/, { context: 200000, output: 64000 }],
  [/^gemini-3/, { context: 1048576, output: 65536 }],
  [/^gemini-2\.5/, { context: 1048576, output: 65536 }],
  [/^gemini-2\.0/, { context: 1048576, output: 8192 }],
  [/^gemini-1\.5/, { context: 1048576, output: 8192 }],
  [/^deepseek-/, { context: 128000, output: 8192 }],
  [/^llama-4/, { context: 1048576 }],
  [/^llama-3\.3/, { context: 128000 }],
  [/^llama-3\.2/, { context: 128000 }],
  [/^llama-3\.1/, { context: 128000 }],
  [/^llama-3/, { context: 8192 }],
  [/^llama-2/, { context: 4096 }],
  [/^qwen3-coder/, { context: 131072, output: 32768 }],
  [/^qwen3/, { context: 131072, output: 32768 }],
  [/^qwen2\.5-72b/, { context: 131072, output: 8192 }],
  [/^qwen2\.5/, { context: 32768, output: 8192 }],
  [/^qwen2/, { context: 32768, output: 8192 }],
  [/^qwen-/, { context: 131072, output: 8192 }],
  [/^moonshot-v1/, { context: 131072 }],
  [/^kimi-/, { context: 131072 }],
  [/^mistral-large/, { context: 128000, output: 8192 }],
  [/^ministral/, { context: 128000 }],
  [/^open-mixtral-8x22b/, { context: 65536 }],
  [/^open-mixtral/, { context: 32768 }],
  [/^mistral-8x7b/, { context: 32768 }],
  [/^mistral-7b/, { context: 32768 }],
  [/^codestral/, { context: 32000 }],
  [/^mistral-tiny/, { context: 32000 }],
  [/^mistral-small/, { context: 32000 }],
  [/^mistral-medium/, { context: 32000 }],
  [/^mistral-/, { context: 32000 }],
  [/^glm-4/, { context: 131072 }],
  [/^grok-/, { context: 131072 }],
  [/^command-a/, { context: 256000, output: 64000 }],
  [/^command-r/, { context: 128000 }],
  [/^command-/, { context: 128000 }],
  [/^yi-/, { context: 32768 }]
]
