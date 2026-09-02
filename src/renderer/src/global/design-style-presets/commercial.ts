import { AiDesignStyle } from '@/entity'
import { PRESET_TS } from './shared'

/** 影像商业：本地内置仅 xAI / Grok（其余商业风格走在线库） */
export const COMMERCIAL_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-xai',
    name: 'xAI / Grok',
    description: '黑白高反差 · 力量感排版 · 戏剧化海报风',
    category: 'commercial',
    tags: ['海报', '黑白', '高反差', '大胆'],
    visualPrompt:
      'Bold dramatic poster design in xAI style, stark black and white contrast, oversized condensed typography, high-impact editorial layout, subtle film grain noise texture, sharp geometric shapes, cinematic lighting, strictly monochrome palette, powerful negative space, avant-garde composition',
    negativePrompt:
      'soft pastel colors, cute cartoon style, low contrast, flat dull gray, ornate decorations, vintage sepia, multi-color gradients, playful rounded fonts',
    colorPalette: {
      primary: '#FFFFFF',
      secondary: '#B7B7B7',
      background: '#000000',
      surface: '#161616',
      text_primary: '#FFFFFF',
      text_secondary: '#9CA3AF'
    },
    typography: {
      heading: { font: 'Inter, system-ui', weight: 800, size: 72, lineHeight: 1.05 },
      body: { font: 'Inter, system-ui', weight: 500, size: 20, lineHeight: 1.5 },
      caption: { font: 'Inter, system-ui', weight: 400, size: 14, lineHeight: 1.4 }
    },
    layoutRules: [
      '黑白灰三色为主，禁止彩色',
      '标题字号 ≥ 48px，视觉冲击优先',
      '允许超出血排版与大量负空间',
      '元素对齐遵循网格，边缘对齐保持锋利'
    ],
    tokens: {
      spacing: { pageMargin: 24, sectionGap: 12, cardPadding: 8, baseUnit: 8 },
      radius: { small: 0, medium: 0, large: 0, pill: false },
      border: { width: 2, style: 'solid', color: '#FFFFFF' },
      shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
      motion: { duration: 100, easing: 'ease-out', scope: '切换' }
    },
    aliases: ['xAI', 'Grok', '黑白海报', '高反差'],
    signature:
      '严格黑白灰；超大浓缩标题压一侧或出血；锋利几何切边 + 大量负空间；禁止彩色与圆角',
    whitespaceRatio: 55,
    preferredFormats: ['3:4', '2:3', '1.91:1'],
    suitableFor: '戏剧化海报、宣言、品牌大片、科技态度图',
    unsuitableFor: '需要温暖亲和力的生活方式内容',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
