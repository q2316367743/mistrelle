import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 手作纸感：本地内置仅手绘（其余走在线库） */
export const HANDMADE_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-sketch',
    name: '手绘',
    description: '亲切、没有距离感。像白板笔记：抖动线框、荧光笔、批注。',
    category: 'handmade',
    tags: ['手绘', '涂鸦', '白板', '笔记'],
    visualPrompt:
      'Hand-drawn whiteboard sketch, cream paper, shaky ink lines, highlighter strips under words, sticky notes, handwritten annotations, filled dense layout',
    negativePrompt: 'perfect grids, luxury gold, photoreal 3D, neon cyberpunk',
    colorPalette: {
      primary: '#ff7b6b',
      secondary: '#ffe066',
      background: '#fdfcf8',
      surface: '#f5f2e8',
      text_primary: '#2b3a55',
      text_secondary: '#8493ab'
    },
    typography: {
      heading: { font: 'Hanzipen SC, Marker Felt, sans-serif', weight: 700, size: 40, lineHeight: 1.15 },
      body: { font: 'Hannotate SC, PingFang SC, sans-serif', weight: 400, size: 16, lineHeight: 1.5 },
      caption: { font: 'Hannotate SC, PingFang SC, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '线框与箭头边缘略不规则（可用折线 path 或微旋转 rect）',
      '荧光笔是歪约 1.5° 的色带压在文字下层',
      '配手绘小方块、批注、便签',
      '画面要填得满，空荡荡像没画完'
    ],
    tokens: graphicFlatTokens('#2b3a55', 28),
    aliases: ['涂鸦', '白板', '笔记', '草图', '马克笔'],
    signature: '抖动线框 + 歪斜荧光笔色带 + 批注便签；信息密度偏高，不要空旷',
    whitespaceRatio: 35,
    preferredFormats: ['1.91:1', '16:9', '3:4'],
    suitableFor: '教程、科普、产品讲解、脑图、亲和力优先',
    unsuitableFor: '奢侈品极简广告',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
