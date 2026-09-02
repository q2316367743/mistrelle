import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 流行文化：本地内置仅美漫波普（其余走在线库） */
export const POP_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-comic',
    name: '美漫波普',
    description: '吵、有冲击力。半调网点、爆炸星、粗黑描边字。',
    category: 'pop-culture',
    tags: ['漫画', '波普', '半调', 'Pop'],
    visualPrompt:
      'Pop art comic poster, yellow field, halftone dots, white title with thick black stroke and hard offset shadow, explosion starburst, speech bubble',
    negativePrompt: 'soft watercolor, Swiss quiet grid, luxury thin serif',
    colorPalette: {
      primary: '#ff2e4c',
      secondary: '#111111',
      background: '#ffd93d',
      surface: '#ffffff',
      text_primary: '#111111',
      text_secondary: '#333333'
    },
    typography: {
      heading: { font: 'Impact, Arial Black, sans-serif', weight: 900, size: 64, lineHeight: 0.95 },
      body: { font: 'Comic Sans MS, Arial, sans-serif', weight: 700, size: 18, lineHeight: 1.3 },
      caption: { font: 'Arial Black, sans-serif', weight: 700, size: 14, lineHeight: 1.2 }
    },
    layoutRules: [
      '半调网点铺底',
      '标题白字 + 粗黑描边 + 硬偏移投影（非模糊）',
      '多角爆炸星放拟声词',
      '底部尖角对话框'
    ],
    tokens: {
      ...graphicFlatTokens('#111111', 32),
      border: { width: 4, style: 'solid', color: '#111111' }
    },
    aliases: ['漫画', '波普', '半调网点', 'Lichtenstein'],
    signature: '半调网点底 + 粗描边硬投影标题 + 爆炸星 + 尖角对话框',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', '3:4'],
    suitableFor: '强冲击标题、活动、玩梗、促销',
    unsuitableFor: '安静阅读类内容',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
