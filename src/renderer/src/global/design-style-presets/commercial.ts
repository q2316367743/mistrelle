import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 影像商业 + 数字原生：电影 / 70s / 线条 / 玻璃 / 终端 / 极光 / 奢侈 / 极简产品 */
export const COMMERCIAL_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-cinematic',
    name: '电影海报',
    description: '庄重、有分量。底部密集 credits 才是辨识度。',
    category: 'commercial',
    tags: ['电影', '大片', 'A24', '纪录片'],
    visualPrompt:
      'Cinematic movie poster, near-black field, centered serif title with wide tracking, tagline on top, dense all-caps credits block at bottom, subtle warm vignette',
    negativePrompt: 'busy Memphis shapes, comic bubbles, bright UI chrome',
    colorPalette: {
      primary: '#f2f0ec',
      secondary: '#8d867a',
      background: '#08080a',
      surface: '#121214',
      text_primary: '#f2f0ec',
      text_secondary: '#8d867a'
    },
    typography: {
      heading: { font: 'Didot, Source Han Serif SC, serif', weight: 400, size: 44, lineHeight: 1.15 },
      body: { font: 'Helvetica Neue, sans-serif', weight: 400, size: 12, lineHeight: 1.35 },
      caption: { font: 'Helvetica Neue, sans-serif', weight: 400, size: 10, lineHeight: 1.25 }
    },
    layoutRules: [
      '底部一整块密集 credits 小字（全大写、行距紧、居中）',
      '标题衬线 + 宽字距居中',
      '顶部一句 tagline',
      '中间大面积留空，可有一处极淡暖光晕'
    ],
    tokens: graphicFlatTokens('#8d867a', 56),
    aliases: ['电影感', '大片', 'A24', '纪录片'],
    signature: '底部密集 credits 小字块 + 居中宽字距衬线标题 + 中间大留空',
    whitespaceRatio: 55,
    preferredFormats: ['9:16', '1.91:1', '2:3'],
    suitableFor: '纪录片、活动预告、年度总结、品牌大片',
    unsuitableFor: '信息清单干货卡',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-retrofuturism',
    name: '复古未来 70s',
    description: '温暖、乐观。橙棕彩虹带 + 半椭圆切口 + 圆体粗字。',
    category: 'commercial',
    tags: ['七十年代', '复古', '橙棕', '彩虹条'],
    visualPrompt:
      '1970s retro-futurism poster, warm cream ground, three-color vertical rainbow stripe with half-ellipse bite, rounded heavy display type',
    negativePrompt: 'cold cyan neon, Swiss red black, ink wash seals',
    colorPalette: {
      primary: '#e0672f',
      secondary: '#d9a441',
      background: '#f3e3c3',
      surface: '#8c4a2f',
      text_primary: '#5a2f1c',
      text_secondary: '#8c4a2f'
    },
    typography: {
      heading: { font: 'Yuanti SC, PingFang SC, sans-serif', weight: 900, size: 52, lineHeight: 1.05 },
      body: { font: 'Yuanti SC, PingFang SC, sans-serif', weight: 400, size: 16, lineHeight: 1.5 },
      caption: { font: 'PingFang SC, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '右侧三色竖向彩虹带',
      '用底色半椭圆咬进彩虹带形成弧形切口',
      '标题必须圆体、字重 900',
      '暖橙棕配色，避免冷霓虹'
    ],
    tokens: graphicFlatTokens('#8c4a2f', 40),
    aliases: ['七十年代', '复古', '橙棕', '彩虹条'],
    signature: '右侧三色彩虹带被半椭圆咬出切口；圆体超粗标题',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', '3:4'],
    suitableFor: '咖啡/餐饮、市集、复古品牌、播客',
    unsuitableFor: '冷淡科技蓝图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-line',
    name: '极简线条',
    description: '冷静、克制。右半一张细线几何，中心一个色点。',
    category: 'commercial',
    tags: ['线描', '单线', '极简插画'],
    visualPrompt:
      'Minimal line art poster, off-white, left text with light weight, right continuous 1.2px geometric figure with single solid accent dot at center',
    negativePrompt: 'thick fills, neon glow, collage scraps, comic strokes',
    colorPalette: {
      primary: '#c2482f',
      secondary: '#7d786e',
      background: '#fcfbf8',
      surface: '#f5f3ee',
      text_primary: '#1e1e1c',
      text_secondary: '#7d786e'
    },
    typography: {
      heading: { font: 'Helvetica Neue, Arial, sans-serif', weight: 300, size: 40, lineHeight: 1.2 },
      body: { font: 'Helvetica Neue, Arial, sans-serif', weight: 300, size: 16, lineHeight: 1.6 },
      caption: { font: 'Helvetica Neue, Arial, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '右半板一个 1.2px 细线几何（圆+曲线+十字轴）',
      '图形中心一个实心强调色点（整图唯一强调色）',
      '文字全部压左，字重偏细',
      '留白 55% 以上'
    ],
    tokens: graphicFlatTokens('#7d786e', 56),
    aliases: ['线描', '单线', '极简插画', '几何线'],
    signature: '右侧连续细线几何 + 中心唯一色点；左侧细字；大留白',
    whitespaceRatio: 55,
    preferredFormats: ['5:2', '1.91:1'],
    suitableFor: '咨询、金融、建筑、高端服务、年报',
    unsuitableFor: '吵闹促销',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-glass',
    name: '玻璃拟态',
    description: '轻、通透。半透明卡片 + 描边高光 + 背后模糊色光（不靠 backdrop-filter）。',
    category: 'commercial',
    tags: ['玻璃', '毛玻璃', 'glassmorphism'],
    visualPrompt:
      'Glassmorphism product card on deep blue gradient, frosted translucent panel with light border and top highlight, soft colored orbs behind the card',
    negativePrompt: 'kraft collage, newsprint columns, brutalist thick black',
    colorPalette: {
      primary: '#6ea8ff',
      secondary: '#a78bfa',
      background: '#101a2e',
      surface: 'rgba(255,255,255,0.12)',
      text_primary: '#eef3fa',
      text_secondary: '#a8b4c8'
    },
    typography: {
      heading: { font: 'SF Pro Display, Inter, sans-serif', weight: 600, size: 36, lineHeight: 1.2 },
      body: { font: 'SF Pro Text, Inter, sans-serif', weight: 400, size: 15, lineHeight: 1.5 },
      caption: { font: 'SF Pro Text, Inter, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '卡片下先放模糊彩色圆作为折射光',
      '卡片半透明白/浅色底 + 1px 浅描边',
      '顶部内侧高光线',
      '不要依赖真实毛玻璃滤镜；用叠层模拟'
    ],
    tokens: {
      spacing: { pageMargin: 40, sectionGap: 20, cardPadding: 24, baseUnit: 8 },
      radius: { small: 12, medium: 20, large: 28, pill: false },
      border: { width: 1, style: 'solid', color: 'rgba(255,255,255,0.22)' },
      shadow: { enabled: true, offsetX: 0, offsetY: 12, blur: 32, color: 'rgba(0,0,0,0.25)' },
      motion: { duration: 250, easing: 'ease-out', scope: '切换' }
    },
    aliases: ['毛玻璃', 'glassmorphism', '透明卡片'],
    signature: '背后模糊色光 + 半透明卡片 + 浅描边 + 顶部高光三件套',
    whitespaceRatio: 55,
    preferredFormats: ['1.91:1', '16:9'],
    suitableFor: 'SaaS、App 落地页、暗色产品图、发布公告',
    unsuitableFor: '印刷报纸风',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-terminal',
    name: '终端 CLI',
    description: '技术、锐利。近黑配荧光绿等宽字，左侧荧光色带。',
    category: 'commercial',
    tags: ['命令行', 'CLI', '极客', '黑客'],
    visualPrompt:
      'Neo-terminal aesthetic, near-black, neon green monospace, left accent bar, prompt prefix, reverse highlight keyword, block cursor',
    negativePrompt: 'pastel lifestyle, serif editorial, gold luxury lines',
    colorPalette: {
      primary: '#4ade80',
      secondary: '#5f6b62',
      background: '#0b0d0c',
      surface: '#121512',
      text_primary: '#e8ffe9',
      text_secondary: '#5f6b62'
    },
    typography: {
      heading: { font: 'SF Mono, JetBrains Mono, monospace', weight: 700, size: 32, lineHeight: 1.2 },
      body: { font: 'SF Mono, JetBrains Mono, monospace', weight: 400, size: 14, lineHeight: 1.55 },
      caption: { font: 'SF Mono, JetBrains Mono, monospace', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '左侧约 10px 荧光绿带贯穿全高',
      '眉标用 ▸ 或 $ 起头、全大写、宽字距',
      '关键词整块反白（荧光绿底近黑字）',
      '末尾实心方块光标；可选极淡扫描线；全等宽'
    ],
    tokens: graphicFlatTokens('#4ade80', 40),
    aliases: ['命令行', 'CLI', '极客', '黑客', '终端'],
    signature: '左侧荧光色带 + 等宽提示符眉标 + 反白关键词 + 方块光标',
    whitespaceRatio: 35,
    preferredFormats: ['2.35:1', '1.91:1', '16:9'],
    suitableFor: '技术内容、changelog、代码图、开发者向',
    unsuitableFor: '婚礼请柬、亲子内容',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-aurora',
    name: '极光',
    description: '当代、柔和。整图仅一处被裁切的光晕，必须叠噪点，禁紫蓝渐变。',
    category: 'commercial',
    tags: ['渐变', '光晕', '氛围', '深色'],
    visualPrompt:
      'Aurora dark UI poster, deep navy, single cropped teal-to-amber glow, grain overlay, thin white translucent borders, generous empty space, no purple-blue AI gradient',
    negativePrompt: 'purple to blue 45 degree gradient, neon text glow, three equal cards',
    colorPalette: {
      primary: '#2dd4bf',
      secondary: '#fbbf24',
      background: '#0a0d12',
      surface: '#12171f',
      text_primary: '#eef1f6',
      text_secondary: '#8a93a6'
    },
    typography: {
      heading: { font: 'Inter, SF Pro Display, sans-serif', weight: 600, size: 40, lineHeight: 1.15 },
      body: { font: 'Inter, SF Pro Text, sans-serif', weight: 400, size: 15, lineHeight: 1.55 },
      caption: { font: 'Inter, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '整张图只有一处光晕，且被画板边缘裁掉一半',
      '光晕上叠噪点消除色带',
      '分区用 1px rgba 白描边而非大阴影',
      '禁用紫→蓝渐变；渐变不做大标题文字；留白 50%+'
    ],
    tokens: {
      spacing: { pageMargin: 48, sectionGap: 24, cardPadding: 20, baseUnit: 8 },
      radius: { small: 8, medium: 12, large: 16, pill: false },
      border: { width: 1, style: 'solid', color: 'rgba(255,255,255,0.08)' },
      shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
      motion: { duration: 220, easing: 'ease-out', scope: '切换' }
    },
    aliases: ['渐变', '光晕', '氛围感', '深色渐变'],
    signature: '仅一处被边缘裁切的光晕 + 噪点；1px 浅描边分区；禁紫蓝渐变字',
    whitespaceRatio: 55,
    preferredFormats: ['1.91:1', '5:2'],
    suitableFor: 'SaaS、AI 产品、OG 图、暗色主题',
    unsuitableFor: '印刷报纸、国潮红金',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-luxe',
    name: '奢侈品黑金',
    description: '贵、安静。细衬线全大写宽字距，上下金线，画面几乎什么都没有。',
    category: 'commercial',
    tags: ['高奢', '黑金', '时尚', '极简奢华'],
    visualPrompt:
      'Luxury fashion poster, pure black, thin serif all-caps with extreme letter-spacing, two gold hairlines above and below title, vast emptiness',
    negativePrompt: 'busy icons, bright neon, comic stars, Memphis fragments',
    colorPalette: {
      primary: '#b08d57',
      secondary: 'rgba(240,236,228,0.22)',
      background: '#0a0a0a',
      surface: '#141414',
      text_primary: '#f0ece4',
      text_secondary: '#b08d57'
    },
    typography: {
      heading: { font: 'Didot, Times New Roman, serif', weight: 300, size: 36, lineHeight: 1.3 },
      body: { font: 'Didot, Times New Roman, serif', weight: 300, size: 14, lineHeight: 1.6 },
      caption: { font: 'Didot, Times New Roman, serif', weight: 300, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '主标题细衬线全大写 + letterSpacing 极大，居中，字号不必最大',
      '上下各一根 1px 金属色线，线与字间距 ≥40px',
      '除此之外画面尽量什么都没有',
      '留白约 70%'
    ],
    tokens: graphicFlatTokens('rgba(240,236,228,0.22)', 72),
    aliases: ['高奢', '黑金', '时尚', '极简奢华'],
    signature: '细衬线全大写超宽字距 + 上下金线 + 几乎空白；克制即内容',
    whitespaceRatio: 70,
    preferredFormats: ['3:4', '9:16'],
    suitableFor: '品牌、时尚、香氛、高端活动、周年',
    unsuitableFor: '信息量大的图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-product-minimal',
    name: '极简产品',
    description: '清楚、可信。大留白 + 明度分层，界面示意用几何块不贴真截图。',
    category: 'commercial',
    tags: ['SaaS', '干净', '现代', 'Apple 风'],
    visualPrompt:
      'Product minimal SaaS marketing visual, near-white ground, soft tonal cards, single blue accent on one control, UI sketched with rectangles and lines, no real screenshots',
    negativePrompt: 'neon cyber, collage tape, ink seals, purple AI gradients',
    colorPalette: {
      primary: '#2f5cff',
      secondary: '#5b6070',
      background: '#fbfbfd',
      surface: '#ffffff',
      text_primary: '#14151a',
      text_secondary: '#5b6070'
    },
    typography: {
      heading: { font: 'Inter, SF Pro Display, sans-serif', weight: 600, size: 36, lineHeight: 1.2 },
      body: { font: 'Inter, SF Pro Text, sans-serif', weight: 400, size: 15, lineHeight: 1.55 },
      caption: { font: 'Inter, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '留白 55%+',
      '层次靠明度差 4~8% 的色块，少用阴影',
      '需要阴影时用轻柔多层扩散',
      '界面示意用方块线条，不贴真截图；强调色只用在一个交互元素'
    ],
    tokens: {
      spacing: { pageMargin: 48, sectionGap: 28, cardPadding: 24, baseUnit: 8 },
      radius: { small: 8, medium: 12, large: 16, pill: false },
      border: { width: 1, style: 'solid', color: '#e6e8ef' },
      shadow: { enabled: true, offsetX: 0, offsetY: 4, blur: 16, color: 'rgba(0,0,0,0.04)' },
      motion: { duration: 200, easing: 'ease-out', scope: '切换' }
    },
    aliases: ['SaaS', '干净', '现代', '产品极简'],
    signature: '大留白 + 明度色块分层 + 单点强调色；界面用几何示意不贴截图',
    whitespaceRatio: 55,
    preferredFormats: ['1.91:1', '16:9'],
    suitableFor: '功能发布、B 端、文档配图、数据卡',
    unsuitableFor: '街头潮牌、国潮节庆',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
