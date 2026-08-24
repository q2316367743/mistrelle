import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 艺术运动：包豪斯 / 装饰艺术 / Riso / 粗野 / 孟菲斯 */
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
  },
  {
    id: 'preset-deco',
    name: '装饰艺术',
    description: '华丽、对称、盛大。墨绿配金线、放射扇形，二十年代的仪式感。',
    category: 'art-movement',
    tags: ['Art Deco', '复古奢华', '对称'],
    visualPrompt:
      'Art Deco invitation, dark green ground, gold thin lines, radiating fan motif at top, double-line border, centered tall serif all-caps with wide tracking',
    negativePrompt: 'casual doodles, neon pink, flat SaaS cards, comic stickers',
    colorPalette: {
      primary: '#d9b26a',
      secondary: 'rgba(217,178,106,0.45)',
      background: '#0f1c18',
      surface: '#152822',
      text_primary: '#f5efe3',
      text_secondary: '#c4b89a'
    },
    typography: {
      heading: { font: 'Didot, Source Han Serif SC, serif', weight: 300, size: 42, lineHeight: 1.15 },
      body: { font: 'Didot, Source Han Serif SC, serif', weight: 400, size: 14, lineHeight: 1.5 },
      caption: { font: 'Didot, Source Han Serif SC, serif', weight: 300, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '顶部放射状扇形（多条旋转细线或扇形色块）',
      '双线边框（外粗内细，间距约 6px）',
      '严格左右对称',
      '金色只用在线条与小字，不大面积铺色'
    ],
    tokens: graphicFlatTokens('rgba(217,178,106,0.45)', 56),
    aliases: ['Art Deco', '盖茨比', '二十年代', '装饰艺术'],
    signature: '顶部放射扇形 + 双线金边框 + 严格对称；细高衬线全大写宽字距；金色克制',
    whitespaceRatio: 55,
    preferredFormats: ['9:16', '3:4'],
    suitableFor: '活动邀请、周年、颁奖、高端餐饮/酒',
    unsuitableFor: '日常工具产品图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-riso',
    name: '双色印刷 Riso',
    description: '手作、年轻、独立出版。两荧光色故意错版叠印。',
    category: 'art-movement',
    tags: ['Riso', '叠印', '错版', '独立出版'],
    visualPrompt:
      'Risograph print look, cream paper, fluorescent red and blue misregistered overlays, grainy texture, only two ink colors plus overprint dark',
    negativePrompt: 'smooth gradients, clean UI chrome, photographic realism',
    colorPalette: {
      primary: '#ff4f38',
      secondary: '#2b4bff',
      background: '#f2efe6',
      surface: '#ebe6d8',
      text_primary: '#1a1a1a',
      text_secondary: '#5a5a5a'
    },
    typography: {
      heading: { font: 'Impact, Arial Black, sans-serif', weight: 900, size: 52, lineHeight: 1.0 },
      body: { font: 'Arial, sans-serif', weight: 400, size: 16, lineHeight: 1.4 },
      caption: { font: 'Arial, sans-serif', weight: 700, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '同一形状印两遍，两色故意错位 6~10px',
      '重叠区用半透明叠层变暗紫',
      '粗颗粒噪点',
      '只用两个强调色，第三色必须来自叠印'
    ],
    tokens: graphicFlatTokens('#1a1a1a', 40),
    aliases: ['Riso', '孔版印刷', '叠印', '错版'],
    signature: '双色故意错位 6~10px 叠印；粗颗粒；只用两色，第三色来自重叠',
    whitespaceRatio: 35,
    preferredFormats: ['3:4', '9:16'],
    suitableFor: '音乐/展览/市集海报、青年向、封面',
    unsuitableFor: '需要精准品牌色还原的企业稿',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-brutalist',
    name: '粗野主义',
    description: '直接、不装、有攻击性。粗黑边框、故意不对齐、零圆角零阴影。',
    category: 'art-movement',
    tags: ['粗野', '反设计', '裸露'],
    visualPrompt:
      'Web brutalism poster, pure white and black, thick black borders, slightly rotated overlapping boxes, underlined text, Times mixed with Courier, one orange accent',
    negativePrompt: 'soft shadows, rounded cards, pastel gradients, friendly illustrations',
    colorPalette: {
      primary: '#ff3b00',
      secondary: '#000000',
      background: '#ffffff',
      surface: '#f5f5f5',
      text_primary: '#000000',
      text_secondary: '#333333'
    },
    typography: {
      heading: { font: 'Times New Roman, serif', weight: 700, size: 56, lineHeight: 1.0 },
      body: { font: 'Courier New, monospace', weight: 400, size: 16, lineHeight: 1.4 },
      caption: { font: 'Courier New, monospace', weight: 400, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '3~4px 纯黑实边框方块，故意重叠错位',
      '文字加下划线；元素旋转 1~2°',
      '大字可顶到画板边缘出血',
      '零圆角、零阴影、零渐变'
    ],
    tokens: {
      spacing: { pageMargin: 24, sectionGap: 8, cardPadding: 12, baseUnit: 4 },
      radius: { small: 0, medium: 0, large: 0, pill: false },
      border: { width: 3, style: 'solid', color: '#000000' },
      shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
      motion: { duration: 80, easing: 'linear', scope: '切换' }
    },
    aliases: ['粗野', '反设计', 'brutalism', 'web brutalism'],
    signature: '粗黑边框方块故意错位重叠；文字下划线；1~2° 微旋转；大字出血；零圆角阴影渐变',
    whitespaceRatio: 35,
    preferredFormats: ['1.91:1', '1:1'],
    suitableFor: '宣言、观点、亚文化、开发者向',
    unsuitableFor: '需要信任感的商业场景',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-memphis',
    name: '孟菲斯',
    description: '吵闹、好玩、青春。撞色几何碎片从边缘切入。',
    category: 'art-movement',
    tags: ['孟菲斯', '八十年代', '撞色', '几何'],
    visualPrompt:
      'Memphis Milano style, cream ground, mint coral lemon grape geometric fragments cutting in from edges, wavy lines, scattered dots, bold black type on top',
    negativePrompt: 'monochrome minimalism, luxury black gold, photorealism',
    colorPalette: {
      primary: '#ff6b6b',
      secondary: '#4fd1c5',
      background: '#f7f3ea',
      surface: '#ffd93d',
      text_primary: '#141414',
      text_secondary: '#7c5cff'
    },
    typography: {
      heading: { font: 'Arial Black, sans-serif', weight: 900, size: 48, lineHeight: 1.0 },
      body: { font: 'Arial, sans-serif', weight: 400, size: 16, lineHeight: 1.4 },
      caption: { font: 'Arial, sans-serif', weight: 700, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '斜条纹色块、波浪线、散落实心圆点同时出现',
      '几何碎片从画板边缘切入，不完整摆在中间',
      '黑色粗字压在最上层',
      '撞色自由但保留一张主标题焦点'
    ],
    tokens: graphicFlatTokens('#141414', 32),
    aliases: ['八十年代', '撞色几何', 'Memphis'],
    signature: '斜条纹 + 波浪线 + 圆点碎片从边缘切入；黑粗字压顶层',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', '3:4'],
    suitableFor: '活动、潮流、年轻向、娱乐',
    unsuitableFor: '金融严肃报告',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
