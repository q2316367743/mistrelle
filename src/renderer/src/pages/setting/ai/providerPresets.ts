/** AI 设置页「提供方名称预设」：选名称自动带出 Base URL */
export const PROVIDER_PRESETS: Array<{ label: string; baseUrl: string }> = [
  { label: 'V3 API', baseUrl: 'https://api.vveai.com/v1' },
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { label: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1' },
  { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { label: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1' },
  { label: 'Perplexity', baseUrl: 'https://api.perplexity.ai' },
  { label: '零一万物 (Yi)', baseUrl: 'https://api.lingyiwanwu.com/v1' },
  { label: 'Moonshot (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1' },
  {
    label: '阿里云 (通义千问)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  { label: '百度千帆', baseUrl: 'https://qianfan.baobao.baidu.com/v2' },
  { label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { label: '小米', baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1' }
]

export const PROVIDER_NAME_PRESETS = PROVIDER_PRESETS.map((p) => ({
  label: p.label,
  value: p.label
}))
