import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 东方：本地内置仅日式侘寂（其余走在线库） */
export const EAST_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-wabi',
    name: '日式侘寂',
    description: '安静、克制、有呼吸。留白七成、一枚朱红印章。',
    category: 'east',
    tags: ['侘寂', '日式', '无印', '留白'],
    visualPrompt:
      'Wabi-sabi Japanese aesthetic, warm sand paper, vast empty space, subject in lower third, vertical small type, vermilion square seal, incomplete thin lines',
    negativePrompt: 'busy collage, neon, thick borders, centered everything, glassmorphism',
    colorPalette: {
      primary: '#b3402f',
      secondary: '#cfc7b6',
      background: '#e9e3d6',
      surface: '#dfd7c8',
      text_primary: '#2b2723',
      text_secondary: '#8b8375'
    },
    typography: {
      heading: { font: 'Source Han Serif SC, Songti SC, serif', weight: 400, size: 40, lineHeight: 1.2 },
      body: { font: 'Noto Sans SC, PingFang SC, sans-serif', weight: 300, size: 14, lineHeight: 1.7 },
      caption: { font: 'Noto Sans SC, PingFang SC, sans-serif', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '留白 65% 以上，主体压下三分之一或右侧',
      '一列竖排小字',
      '一枚约 60px 朱红方印',
      '线条 1px 且故意不到头；不要填满任何区域'
    ],
    tokens: graphicFlatTokens('#cfc7b6', 64),
    aliases: ['日式', '极简日系', '无印感', 'wabi-sabi'],
    signature: '留白 ≥65%；主体压下三分或右侧；竖排小字 + 朱红方印；细线故意不到头',
    whitespaceRatio: 70,
    preferredFormats: ['1.91:1', '3:4'],
    suitableFor: '生活方式、茶/器物、读书、慢内容、展览',
    unsuitableFor: '信息轰炸清单、促销爆款图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
