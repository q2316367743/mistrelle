import { AiDesignStyle, AiDesignStyleColorPalette } from '@/entity'

/**
 * 设计风格 → 提示词段落。
 * 供 design 类型聊天将锁定的设计风格注入稳定 system 前缀，让模型按该风格完成设计 / 生图。
 * 仅输出非空字段，避免无意义的空段落污染上下文。
 */
export const buildDesignStylePrompt = (style: AiDesignStyle): string => {
  const paletteLabel: Record<keyof AiDesignStyleColorPalette, string> = {
    primary: '主色',
    secondary: '辅助色',
    background: '背景色',
    surface: '表面色',
    text_primary: '主文字色',
    text_secondary: '次文字色'
  }

  const typoLabel = {
    heading: '标题',
    body: '正文',
    caption: '辅助文字'
  } as const

  const paletteLines = (Object.keys(paletteLabel) as Array<keyof AiDesignStyleColorPalette>).map(
    (key) => `- ${paletteLabel[key]}：${style.colorPalette[key]}`
  )

  const typoLines = Object.entries(style.typography).map(([key, item]) => {
    const label = typoLabel[key as keyof typeof typoLabel] ?? key
    return `- ${label}：${item.font}，字重 ${item.weight}，字号 ${item.size}px，行高 ${item.lineHeight}`
  })

  const parts: string[] = []
  parts.push('## 设计风格')
  parts.push(`本次设计采用风格「${style.name}」，${style.description}`.trim())
  if (style.visualPrompt) parts.push('', '### 正向提示词', style.visualPrompt)
  if (style.negativePrompt) parts.push('', '### 反向排除词', style.negativePrompt)
  parts.push('', '### 配色方案', ...paletteLines)
  parts.push('', '### 字体规范', ...typoLines)
  if (style.layoutRules.length > 0) {
    parts.push('', '### 布局约束', ...style.layoutRules.map((rule) => `- ${rule}`))
  }
  return parts.join('\n')
}
