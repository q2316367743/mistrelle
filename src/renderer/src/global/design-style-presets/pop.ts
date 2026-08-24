import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 流行文化：美漫 / 像素 / Y2K / 蒸汽波 / 霓虹 / 街头 */
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
  },
  {
    id: 'preset-pixel',
    name: '像素 8-bit',
    description: '极客、怀旧。像素切角、四向硬描边、血条与对话框。',
    category: 'pop-culture',
    tags: ['像素', '8bit', '复古游戏'],
    visualPrompt:
      '8-bit pixel game UI poster, dark navy, stepped corner blocks, hard four-direction text outline, crisp pixel icons, HP bar, dialogue box with triangle',
    negativePrompt: 'soft blur shadows, photoreal, watercolor washes',
    colorPalette: {
      primary: '#ffcd75',
      secondary: '#41a6f6',
      background: '#1a1c2c',
      surface: '#262a40',
      text_primary: '#f4f4f4',
      text_secondary: '#38b764'
    },
    typography: {
      heading: { font: 'Press Start 2P, monospace', weight: 400, size: 28, lineHeight: 1.2 },
      body: { font: 'SF Mono, monospace', weight: 400, size: 14, lineHeight: 1.5 },
      caption: { font: 'SF Mono, monospace', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '方块用阶梯切角（四角砍掉小方块）',
      '标题四向硬描边 + 硬投影，禁用模糊阴影',
      '配血条式进度条、带 ▼ 的对话框',
      '中文像素感靠边框与描边做，不靠像素字体'
    ],
    tokens: graphicFlatTokens('#ef7d57', 32),
    aliases: ['像素风', '8bit', '红白机', '复古游戏'],
    signature: '阶梯切角块 + 四向硬描边字 + 血条/对话框；无模糊阴影',
    whitespaceRatio: 35,
    preferredFormats: ['16:9', '1:1'],
    suitableFor: '游戏、独立开发、复古数码、社群活动',
    unsuitableFor: '高端时尚大片',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-y2k',
    name: '千禧 Y2K',
    description: '闪、甜、怀旧未来感。Chrome 金属字 + 星闪果冻。',
    category: 'pop-culture',
    tags: ['Y2K', '千禧', 'chrome', '金属'],
    visualPrompt:
      'Y2K aesthetic, pastel gradient sky, chrome metallic headline with high-contrast stops, sparkle stars, jelly orbs, fine grid',
    negativePrompt: 'brutalist black borders, ink wash, blueprint grids',
    colorPalette: {
      primary: '#ffffff',
      secondary: '#bcd2ff',
      background: '#e3ccff',
      surface: '#ffc9e8',
      text_primary: '#3a3f66',
      text_secondary: '#6a70a0'
    },
    typography: {
      heading: { font: 'Arial Black, sans-serif', weight: 900, size: 52, lineHeight: 1.0 },
      body: { font: 'Trebuchet MS, sans-serif', weight: 400, size: 16, lineHeight: 1.45 },
      caption: { font: 'Trebuchet MS, sans-serif', weight: 400, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '标题用高对比多段银蓝渐变字（可用渐变 fill）',
      '四角星闪装饰',
      '果冻半球与细网格',
      '整体粉紫蓝甜感，避免暗黑赛博'
    ],
    tokens: {
      spacing: { pageMargin: 40, sectionGap: 16, cardPadding: 16, baseUnit: 8 },
      radius: { small: 12, medium: 20, large: 40, pill: true },
      border: { width: 1, style: 'solid', color: '#ffffff' },
      shadow: { enabled: true, offsetX: 0, offsetY: 4, blur: 12, color: 'rgba(100,80,160,0.2)' },
      motion: { duration: 200, easing: 'ease', scope: '切换' }
    },
    aliases: ['千禧风', '2000年代', '辣妹', 'chrome'],
    signature: 'Chrome 多段金属渐变标题 + 星闪 + 果冻球；粉紫蓝渐变底',
    whitespaceRatio: 35,
    preferredFormats: ['3:4', '1:1'],
    suitableFor: '潮流、美妆、音乐、怀旧、Z 世代',
    unsuitableFor: '企业合规白皮书',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-vaporwave',
    name: '蒸汽波',
    description: '迷幻、怀旧。日落圆 + 透视网格 + 全角宽字距三件套。',
    category: 'pop-culture',
    tags: ['蒸汽波', '复古电子', '赛博落日'],
    visualPrompt:
      'Vaporwave album cover, purple to pink sunset gradient, sliced sun disk, perspective grid horizon, wide letter-spacing title with cyan-magenta hard shadow',
    negativePrompt: 'clean Swiss white, Notion gray, photoreal product shot',
    colorPalette: {
      primary: '#ff6ec7',
      secondary: '#00f0ff',
      background: '#2b1055',
      surface: '#6d2bd9',
      text_primary: '#ffffff',
      text_secondary: '#ffc36e'
    },
    typography: {
      heading: { font: 'Arial, sans-serif', weight: 700, size: 40, lineHeight: 1.2 },
      body: { font: 'Arial, sans-serif', weight: 400, size: 16, lineHeight: 1.5 },
      caption: { font: 'Courier New, monospace', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '日落圆被底色横条切开',
      '透视网格地平线',
      '标题 letterSpacing 很大（全角字距感）+ 青品双色硬投影',
      '三件套缺一不可'
    ],
    tokens: graphicFlatTokens('#ff6ec7', 40),
    aliases: ['蒸汽波', 'синтвейв', '复古电子', 'vaporwave'],
    signature: '切开的日落圆 + 透视网格 + 超宽字距双色硬投影标题',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', '9:16'],
    suitableFor: '音乐、播客封面、复古电子、亚文化',
    unsuitableFor: '政务公文风',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-neon',
    name: '霓虹赛博',
    description: '夜、锐利、都市。四层递进发光字 + 透视网格淡出。',
    category: 'pop-culture',
    tags: ['霓虹', '赛博朋克', '夜店'],
    visualPrompt:
      'Neon cyberpunk night poster, near-black ground, cyan and magenta neon type with multi-layer glow, perspective grid fading into darkness',
    negativePrompt: 'daylight pastel, kraft paper collage, botanical plates',
    colorPalette: {
      primary: '#00fff0',
      secondary: '#ff2d95',
      background: '#08060f',
      surface: '#12101c',
      text_primary: '#e8faff',
      text_secondary: '#8a90a8'
    },
    typography: {
      heading: { font: 'Orbitron, Arial Black, sans-serif', weight: 700, size: 48, lineHeight: 1.05 },
      body: { font: 'Rajdhani, Arial, sans-serif', weight: 500, size: 16, lineHeight: 1.45 },
      caption: { font: 'Rajdhani, Arial, sans-serif', weight: 400, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '霓虹字用多层递进阴影/描边模拟灯管（近亮远淡）',
      '底部透视网格，向上用底色渐隐',
      '青品双色可分工：标题一色、装饰一色',
      '避免整页紫→蓝万能渐变字'
    ],
    tokens: graphicFlatTokens('#00fff0', 40),
    aliases: ['霓虹', '赛博朋克', '夜店', '发光'],
    signature: '四层递进霓虹发光字 + 底部透视网格淡出；青品双色分工',
    whitespaceRatio: 35,
    preferredFormats: ['16:9', '1.91:1'],
    suitableFor: '夜生活、游戏、直播、科技感强的活动',
    unsuitableFor: '日间清新生活方式',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-street',
    name: '街头海报',
    description: '粗粝、有态度。撕边纸片错位堆叠、喷漆噪点、微旋转。',
    category: 'pop-culture',
    tags: ['街头', '喷漆', '贴纸', 'punk'],
    visualPrompt:
      'Street flyposting poster, concrete paper stack, torn irregular scraps overlapping, spray paint grain, slightly rotated type blocks, acid green reverse keyword',
    negativePrompt: 'clean Apple UI, luxury thin gold lines, soft watercolor only',
    colorPalette: {
      primary: '#d6ff3d',
      secondary: '#141414',
      background: '#dcd8ce',
      surface: '#f2efe7',
      text_primary: '#141414',
      text_secondary: '#4a4a4a'
    },
    typography: {
      heading: { font: 'Impact, Arial Black, sans-serif', weight: 900, size: 56, lineHeight: 0.95 },
      body: { font: 'Arial, sans-serif', weight: 700, size: 16, lineHeight: 1.35 },
      caption: { font: 'Courier New, monospace', weight: 400, size: 12, lineHeight: 1.3 }
    },
    layoutRules: [
      '多层不规则撕边纸片错位堆叠',
      '整层喷漆噪点',
      '文字块各转 -2°~-1°',
      '关键词整块反白成荧光绿；粗边框模板喷字标记'
    ],
    tokens: {
      ...graphicFlatTokens('#141414', 32),
      border: { width: 3, style: 'solid', color: '#141414' }
    },
    aliases: ['街头', '贴纸', '喷漆', '地下', 'punk'],
    signature: '撕边纸片错位堆 + 喷漆噪点 + 微旋转字块 + 荧光绿反白关键词',
    whitespaceRatio: 35,
    preferredFormats: ['9:16', '3:4'],
    suitableFor: '演出、滑板、潮牌、地下活动、宣言',
    unsuitableFor: '银行理财产品图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
