import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 手作纸感：手绘 / 黑板 / 水彩 / 拼贴 / 博物图鉴 */
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
  },
  {
    id: 'preset-chalkboard',
    name: '黑板',
    description: '温暖、日常。墨绿底粉笔字 + 粉笔灰纹理。',
    category: 'handmade',
    tags: ['黑板', '粉笔', '教室', '菜单板'],
    visualPrompt:
      'Chalkboard menu aesthetic, deep green board, chalk white lettering with soft edge, dust grain overlay, hand-drawn underline',
    negativePrompt: 'glossy neon, glassmorphism, photographic UI screenshots',
    colorPalette: {
      primary: '#eef3ee',
      secondary: '#9dbfae',
      background: '#26332e',
      surface: '#1e2925',
      text_primary: '#eef3ee',
      text_secondary: '#9dbfae'
    },
    typography: {
      heading: { font: 'Hanzipen SC, Chalkboard SE, sans-serif', weight: 700, size: 44, lineHeight: 1.15 },
      body: { font: 'Hanzipen SC, Chalkboard SE, sans-serif', weight: 400, size: 18, lineHeight: 1.5 },
      caption: { font: 'Hanzipen SC, Chalkboard SE, sans-serif', weight: 400, size: 13, lineHeight: 1.4 }
    },
    layoutRules: [
      '整层极淡粉笔灰噪点',
      '标题下一条手绘抖动白线',
      '文字可带极轻浅色描边模拟粉笔松散边缘',
      '避免锐利几何卡片'
    ],
    tokens: graphicFlatTokens('#9dbfae', 40),
    aliases: ['黑板报', '粉笔', '教室', '菜单板'],
    signature: '深绿底 + 粉笔灰噪点 + 松散边缘字 + 手绘下划线',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', '3:4'],
    suitableFor: '课程、菜单、教学、社群公告、每日一句',
    unsuitableFor: '高精度科技产品渲染',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-watercolor',
    name: '水彩',
    description: '柔软、有呼吸。三色晕染小面积重叠，文字压在留白侧。',
    category: 'handmade',
    tags: ['水彩', '晕染', '疗愈'],
    visualPrompt:
      'Soft watercolor poster, warm paper, three translucent watercolor blobs partially overlapping, text on clear left area, gentle healing mood',
    negativePrompt: 'hard neon, brutalist borders, dense data dashboards',
    colorPalette: {
      primary: '#6fb0dc',
      secondary: '#f5a288',
      background: '#fbf8f2',
      surface: '#9ec98a',
      text_primary: '#2f2b26',
      text_secondary: '#6a645c'
    },
    typography: {
      heading: { font: 'Source Han Serif SC, Georgia, serif', weight: 600, size: 44, lineHeight: 1.15 },
      body: { font: 'Noto Sans SC, PingFang SC, sans-serif', weight: 400, size: 16, lineHeight: 1.6 },
      caption: { font: 'Noto Sans SC, PingFang SC, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '三块半透明色晕（椭圆/不规则形）只小部分重叠',
      '透明度约 0.35~0.45，避免三色大面积叠成脏灰',
      '文字压在左侧留白区，不压在色块上',
      '可加极轻纸感噪点'
    ],
    tokens: graphicFlatTokens('#d8d0c4', 48),
    aliases: ['晕染', '透明水色', '疗愈'],
    signature: '三色晕染仅小面积重叠；字在留白侧；禁止大面积三色叠脏',
    whitespaceRatio: 55,
    preferredFormats: ['3:4', '1:1'],
    suitableFor: '生活方式、疗愈、绘本、手作、季节、香氛',
    unsuitableFor: '硬核技术规格图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-collage',
    name: '拼贴',
    description: '手工感、随性。每个字单独色块贴上，胶带压角。',
    category: 'art-movement',
    tags: ['拼贴', '剪贴', '撕纸', '胶带'],
    visualPrompt:
      'Magazine collage cut-out poster, kraft paper, each title character on separate rotated scrap, torn edges, translucent tape strips',
    negativePrompt: 'perfect alignment grids, clean Swiss minimalism, neon cyber',
    colorPalette: {
      primary: '#e8503a',
      secondary: '#f0d678',
      background: '#e9e3d6',
      surface: '#fbf9f4',
      text_primary: '#1c1a17',
      text_secondary: '#5c564c'
    },
    typography: {
      heading: { font: 'Impact, Arial Black, sans-serif', weight: 900, size: 48, lineHeight: 1.0 },
      body: { font: 'Georgia, Source Han Serif SC, serif', weight: 400, size: 16, lineHeight: 1.5 },
      caption: { font: 'Courier New, monospace', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '标题每个字单独色块，各转 1~3°',
      '纸片可用不规则多边形模拟撕边',
      '半透明黄胶带压住纸角',
      '底色偏牛皮纸感'
    ],
    tokens: graphicFlatTokens('#1c1a17', 36),
    aliases: ['剪贴', '杂志拼贴', '撕纸', '胶带'],
    signature: '标题逐字独立色块微旋转 + 撕边纸片 + 胶带压角',
    whitespaceRatio: 35,
    preferredFormats: ['3:4', '1:1'],
    suitableFor: '杂志感封面、活动、播客、青年文化、手账',
    unsuitableFor: '严肃企业年报',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-naturalist',
    name: '博物图鉴',
    description: '体面、有学识。双层细线框 + 植物线描 + 拉丁学名标签。',
    category: 'handmade',
    tags: ['图鉴', '植物', '博物', '复古科学'],
    visualPrompt:
      '19th century botanical plate, cream paper, double thin border, fine line plant drawing, italic Latin name, specimen label card, FIG. numbering',
    negativePrompt: 'neon, comic bubbles, glassmorphism, loud Memphis shapes',
    colorPalette: {
      primary: '#5c6b4f',
      secondary: '#b9b49e',
      background: '#f4f1e6',
      surface: '#faf8f0',
      text_primary: '#2b3327',
      text_secondary: '#6a7264'
    },
    typography: {
      heading: { font: 'Source Han Serif SC, Georgia, serif', weight: 600, size: 36, lineHeight: 1.2 },
      body: { font: 'Source Han Serif SC, Georgia, serif', weight: 400, size: 15, lineHeight: 1.55 },
      caption: { font: 'Georgia, serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '双层细线内框（间距约 6px）裱全图',
      '右侧细线植物线描（茎叶，淡绿半透明填）',
      '右下角标本标签框 + 字段',
      '标题下斜体拉丁学名；角落 FIG. 编号'
    ],
    tokens: graphicFlatTokens('#b9b49e', 48),
    aliases: ['植物图鉴', '博物学', '标本', 'botanical'],
    signature: '双层细线裱框 + 植物线描 + 斜体拉丁学名 + FIG. 标签',
    whitespaceRatio: 55,
    preferredFormats: ['3:4', 'A4'],
    suitableFor: '自然、香氛、茶饮、科普、复古品牌、植物电商',
    unsuitableFor: '电竞霓虹活动',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
