import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 艺术运动：本地内置仅包豪斯（其余走在线库） */
export const ART_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-bauhaus',
    name: '包豪斯',
    description: '大胆、结构清晰。红黄蓝三原色几何构成，有历史重量。',
    category: 'art-movement',
    tags: ['包豪斯', '几何', '三原色', '构成'],
    visualPrompt:
      'Bauhaus poster, cream ground, primary red yellow blue geometric shapes circle triangle square overlapping, bold sans type at color junctions, no fourth color',
    negativePrompt: 'pastel gradients, soft photos, luxury gold, neon cyberpunk',
    colorPalette: {
      primary: '#e63329',
      secondary: '#1b4bd8',
      background: '#f2efe6',
      surface: '#f7c400',
      text_primary: '#141414',
      text_secondary: '#3a3a3a'
    },
    typography: {
      heading: { font: 'Arial Black, Helvetica, sans-serif', weight: 900, size: 56, lineHeight: 1.0 },
      body: { font: 'Arial, Helvetica, sans-serif', weight: 400, size: 16, lineHeight: 1.4 },
      caption: { font: 'Arial, Helvetica, sans-serif', weight: 700, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '圆 / 三角 / 方各占一色，尺寸差异极大',
      '文字压在色块交界处',
      '重叠处用半透明叠层模拟第四色',
      '三原色不能再加第四种实色'
    ],
    tokens: graphicFlatTokens('#141414', 40),
    aliases: ['构成主义', '几何', '三原色', 'Bauhaus'],
    signature: '三原色基本形（圆三角方）尺寸悬殊构成画面；文字压色块交界；禁止第四种颜色',
    whitespaceRatio: 35,
    preferredFormats: ['3:4', '9:16'],
    suitableFor: '活动海报、课程、艺术类、封面',
    unsuitableFor: '严肃 B 端信任向界面',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
