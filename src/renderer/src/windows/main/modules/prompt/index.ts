import divination from './divination.txt?raw'

interface PromptOption {
  label: string
  desc: string
  prompt: string
  depends: Array<string>
}

export const prompts: Array<PromptOption> = [
  {
    label: '八字排盘',
    desc: '八字排盘工具',
    prompt: divination,
    // 取决于哪些工具
    depends: []
  }
]
