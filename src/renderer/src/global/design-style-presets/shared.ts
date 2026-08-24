import type { AiDesignStyle, AiDesignStyleTokens } from '@/entity'

/** 内置预设固定时间戳（满足 BaseEntity，无展示意义） */
export const PRESET_TS = 0

/** 平面预设常用的「无阴影 / 细描边」细节规范 */
export const graphicFlatTokens = (
  borderColor: string,
  pageMargin = 48
): AiDesignStyleTokens => ({
  spacing: { pageMargin, sectionGap: 24, cardPadding: 20, baseUnit: 8 },
  radius: { small: 0, medium: 0, large: 0, pill: false },
  border: { width: 1, style: 'solid', color: borderColor },
  shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
  motion: { duration: 150, easing: 'ease-out', scope: '切换' }
})

export type GraphicPreset = AiDesignStyle
