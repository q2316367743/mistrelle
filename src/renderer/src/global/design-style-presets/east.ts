import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 东方：侘寂 / 水墨 / 国潮 */
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
  },
  {
    id: 'preset-ink',
    name: '中式水墨',
    description: '写意、有文气。宣纸墨晕、竖排标题、朱红方印。',
    category: 'east',
    tags: ['水墨', '国风', '宣纸', '书法'],
    visualPrompt:
      'Chinese ink wash composition, rice paper tone, irregular ink blot washes, vertical title top-right, vermilion seal bottom-left, serif calligraphy mood, no neon',
    negativePrompt: 'cyberpunk neon, 3D chrome, western comic bubbles, glass cards',
    colorPalette: {
      primary: '#8c1f1f',
      secondary: 'rgba(26,26,24,0.16)',
      background: '#f5f1e8',
      surface: '#ebe6da',
      text_primary: '#1a1a18',
      text_secondary: '#5a5850'
    },
    typography: {
      heading: { font: 'Source Han Serif SC, KaiTi, serif', weight: 700, size: 48, lineHeight: 1.15 },
      body: { font: 'Source Han Serif SC, Songti SC, serif', weight: 400, size: 16, lineHeight: 1.7 },
      caption: { font: 'Source Han Serif SC, Songti SC, serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '背景放不规则半透明墨晕色块（可用模糊椭圆 / 不规则 path）',
      '标题竖排在右上',
      '朱红方印落左下',
      '极细噪点模拟宣纸纤维'
    ],
    tokens: graphicFlatTokens('#d5cfc0', 56),
    aliases: ['水墨', '国风', '宣纸', '书法'],
    signature: '不规则墨晕背景 + 竖排标题右上 + 朱红方印左下 + 宣纸噪点',
    whitespaceRatio: 55,
    preferredFormats: ['3:4', '9:16'],
    suitableFor: '文化内容、节气、诗词、茶酒、中式品牌',
    unsuitableFor: '西式 SaaS 功能发布图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-guochao',
    name: '国潮',
    description: '热闹、有仪式感。红底金线、竖排书法、如意云。',
    category: 'east',
    tags: ['国潮', '新中式', '中国红', '年味'],
    visualPrompt:
      'Neo-Chinese guochao poster, vermilion red field, gold double border with L-corner brackets, vertical calligraphy title, ruyi cloud line motif, square seal',
    negativePrompt: 'pastel Japanese minimal, cyber neon, flat Material cards',
    colorPalette: {
      primary: '#e0b76a',
      secondary: '#f7e9c8',
      background: '#b81c22',
      surface: '#9e181e',
      text_primary: '#f7e9c8',
      text_secondary: '#e0b76a'
    },
    typography: {
      heading: { font: 'STKaiti, KaiTi, Source Han Serif SC, serif', weight: 700, size: 52, lineHeight: 1.1 },
      body: { font: 'Source Han Serif SC, Songti SC, serif', weight: 400, size: 16, lineHeight: 1.5 },
      caption: { font: 'Source Han Serif SC, Songti SC, serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '双线金边框 + 四角 L 形直角包边',
      '竖排书法标题压右',
      '如意云线条压左下',
      '金色只用在线条与小字，大面积保持红底金字'
    ],
    tokens: graphicFlatTokens('#e0b76a', 40),
    aliases: ['国风', '新中式', '中国红', '节庆', '年味'],
    signature: '红底 + 双线金边与四角包边 + 竖排标题 + 如意云 + 方印；金不铺大面',
    whitespaceRatio: 35,
    preferredFormats: ['9:16', '3:4'],
    suitableFor: '春节/中秋、国风品牌、茶酒、中式餐饮、文创',
    unsuitableFor: '冷淡北欧极简场景',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
