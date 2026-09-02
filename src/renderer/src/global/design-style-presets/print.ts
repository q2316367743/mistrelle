import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 印刷传统：本地内置仅瑞士国际主义（其余走在线库） */
export const PRINT_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-swiss',
    name: '瑞士国际主义',
    description: '理性、克制、专业。白底红黑网格，看起来像一份「正确」的东西。',
    category: 'print-tradition',
    tags: ['瑞士', '网格', '国际主义', 'Helvetica'],
    visualPrompt:
      'Swiss International Style poster, white background, strict 12-column grid, bold sans-serif typography, single red accent used once, 1px horizontal rule cutting title from body, numbered corners 01/04, rational and precise',
    negativePrompt: 'gradients, soft shadows, rounded cards, neon colors, cluttered decoration',
    colorPalette: {
      primary: '#e4002b',
      secondary: '#dcdcdc',
      background: '#ffffff',
      surface: '#f7f7f7',
      text_primary: '#111111',
      text_secondary: '#6b6b6b'
    },
    typography: {
      heading: { font: 'Helvetica Neue, Arial, sans-serif', weight: 700, size: 64, lineHeight: 1.05 },
      body: { font: 'Helvetica Neue, Arial, sans-serif', weight: 400, size: 18, lineHeight: 1.5 },
      caption: { font: 'Helvetica Neue, Arial, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '一条贯穿画板的 1px 横线切开标题与内容',
      '元素严格对齐到 12 栏网格',
      '角落放 01 / 04 形式编号',
      '红色强调色整张图只出现一次'
    ],
    tokens: graphicFlatTokens('#dcdcdc', 56),
    aliases: ['瑞士', '国际主义', '网格设计', 'Helvetica 风'],
    signature: '贯穿 1px 横线切开标题与内容；12 栏严格对齐；角落 01/04 编号；红色只出现一次',
    whitespaceRatio: 55,
    preferredFormats: ['1.91:1', '5:2', 'A4'],
    suitableFor: '产品发布、作品集、B 端、数据、打印稿',
    unsuitableFor: '需要温度与人情味的生活方式内容',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
