import {
  AiDesignStyle,
  AiDesignStyleColorPalette,
  buildAiDesignStyleTokens,
  normalizeWhitespaceRatio
} from '@/entity'

/**
 * 设计风格 → 提示词段落。
 * 供 design / ppt 类型聊天将锁定的设计风格注入稳定 system 前缀，让模型按该风格完成设计。
 * - withVisualPrompt（默认 true）：正向/反向提示词段是**生图专用**（design 接生图保留）；
 *   ppt 不接生图，传 false 跳过该段，只保留配色 / 字体 / 布局约束等普适规范。
 * 仅输出非空字段，避免无意义的空段落污染上下文。
 */
export const buildDesignStylePrompt = (
  style: AiDesignStyle,
  options: { withVisualPrompt?: boolean } = {}
): string => {
  const withVisual = options.withVisualPrompt ?? true
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

  // 细节规范（tokens）：用默认值兜底合并，兼容旧数据缺字段；PPT 也注入，不随 withVisualPrompt 跳过
  const t = buildAiDesignStyleTokens(style.tokens)
  const tokenLines = [
    `- 间距：页面边距 ${t.spacing.pageMargin}px，区块间距 ${t.spacing.sectionGap}px，卡片内边距 ${t.spacing.cardPadding}px，基准单位 ${t.spacing.baseUnit}px`,
    `- 圆角：小 ${t.radius.small}px / 中 ${t.radius.medium}px / 大 ${t.radius.large}px${t.radius.pill ? '，按钮使用胶囊圆角' : ''}`,
    t.border.style === 'none'
      ? '- 边框：无边框'
      : `- 边框：${t.border.width}px ${t.border.style} ${t.border.color}`,
    t.shadow.enabled
      ? `- 阴影：${t.shadow.offsetX}px ${t.shadow.offsetY}px ${t.shadow.blur}px ${t.shadow.color}`
      : '- 阴影：不启用',
    `- 动效：${t.motion.duration}ms ${t.motion.easing}，范围 ${t.motion.scope}`
  ]

  const whitespace = normalizeWhitespaceRatio(style.whitespaceRatio)
  const aliases = style.aliases ?? []
  const preferredFormats = style.preferredFormats ?? []

  const parts: string[] = []
  parts.push('## 设计风格')
  parts.push(`本次设计采用风格「${style.name}」，${style.description}`.trim())
  if (aliases.length > 0) {
    parts.push(`别名：${aliases.join(' / ')}`)
  }
  if (style.signature) {
    parts.push(
      '',
      '### 签名手法（必须落地，只换色板不算换风格）',
      style.signature
    )
  }
  parts.push(
    '',
    '### 留白与画幅',
    `- 留白目标：约 ${whitespace}%`,
    preferredFormats.length > 0
      ? `- 常用画幅：${preferredFormats.join(' / ')}（用户未指定尺寸时优先）`
      : '- 常用画幅：未指定'
  )
  if (style.suitableFor || style.unsuitableFor) {
    parts.push('', '### 适用与禁忌')
    if (style.suitableFor) parts.push(`- 适合：${style.suitableFor}`)
    if (style.unsuitableFor) parts.push(`- 不适合：${style.unsuitableFor}`)
  }
  if (withVisual && style.visualPrompt) parts.push('', '### 正向提示词', style.visualPrompt)
  if (withVisual && style.negativePrompt) parts.push('', '### 反向排除词', style.negativePrompt)
  parts.push('', '### 配色方案', ...paletteLines)
  parts.push('', '### 字体规范', ...typoLines)
  parts.push('', '### 细节规范', ...tokenLines)
  if (style.layoutRules.length > 0) {
    parts.push('', '### 布局约束', ...style.layoutRules.map((rule) => `- ${rule}`))
  }
  return parts.join('\n')
}
