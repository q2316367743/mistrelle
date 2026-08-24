import { AiDesignStyle } from '@/entity'
import { PRESET_TS } from './shared'

/**
 * 产品 UI 语言预设（6 套）：Apple / xAI / Notion / Meta / Material / Fluent。
 * 已回填签名手法、留白、画幅等配方字段。
 */
export const PRODUCT_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-apple',
    name: 'Apple 苹果',
    description: '极简克制 · 大标题 · 大量留白，源自 Apple 的设计语言',
    category: 'product-ui',
    tags: ['极简', '留白', '高端', 'iOS'],
    visualPrompt:
      'Clean minimal design in Apple style, generous white space, large bold sans-serif headlines (SF Pro), subtle translucency and glassmorphism, soft gradients, precise alignment, high contrast between text and background, premium product feel, rounded corners, restrained single accent color',
    negativePrompt:
      'cluttered layout, excessive decorations, bright saturated neon colors, skeuomorphic textures, heavy hard-edged shadows, text over busy backgrounds, ornate borders',
    colorPalette: {
      primary: '#007AFF',
      secondary: '#5856D6',
      background: '#F5F5F7',
      surface: '#FFFFFF',
      text_primary: '#1D1D1F',
      text_secondary: '#86868B'
    },
    typography: {
      heading: { font: 'SF Pro Display, -apple-system', weight: 700, size: 34, lineHeight: 1.2 },
      body: { font: 'SF Pro Text, -apple-system', weight: 400, size: 17, lineHeight: 1.5 },
      caption: { font: 'SF Pro Text, -apple-system', weight: 400, size: 13, lineHeight: 1.4 }
    },
    layoutRules: [
      '页面四周保留 16pt 及以上安全留白',
      '大标题优先，正文层级分明，避免信息堆叠',
      '卡片圆角 12pt-16pt，阴影柔和',
      '主色仅用于交互强调，占比不超过 10%'
    ],
    tokens: {
      spacing: { pageMargin: 20, sectionGap: 32, cardPadding: 20, baseUnit: 8 },
      radius: { small: 8, medium: 12, large: 20, pill: true },
      border: { width: 1, style: 'solid', color: '#E5E5EA' },
      shadow: { enabled: true, offsetX: 0, offsetY: 4, blur: 16, color: 'rgba(0,0,0,0.06)' },
      motion: {
        duration: 300,
        easing: 'cubic-bezier(0.25,0.1,0.25,1)',
        scope: 'hover / 切换 / 转场'
      }
    },
    aliases: ['苹果', 'Apple', 'iOS', '极简产品'],
    signature:
      '大面积留白 + SF 系粗标题压一侧；单一系统蓝仅出现在一个交互点；卡片轻阴影与 12–16pt 圆角，其余全靠对齐与层级',
    whitespaceRatio: 70,
    preferredFormats: ['1:1', '9:16', '16:9'],
    suitableFor: '产品发布、落地页、高端消费电子、App 营销图',
    unsuitableFor: '信息密度极高的清单卡、吵闹促销',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-xai',
    name: 'xAI / Grok',
    description: '黑白高反差 · 力量感排版 · 戏剧化海报风',
    category: 'commercial',
    tags: ['海报', '黑白', '高反差', '大胆'],
    visualPrompt:
      'Bold dramatic poster design in xAI style, stark black and white contrast, oversized condensed typography, high-impact editorial layout, subtle film grain noise texture, sharp geometric shapes, cinematic lighting, strictly monochrome palette, powerful negative space, avant-garde composition',
    negativePrompt:
      'soft pastel colors, cute cartoon style, low contrast, flat dull gray, ornate decorations, vintage sepia, multi-color gradients, playful rounded fonts',
    colorPalette: {
      primary: '#FFFFFF',
      secondary: '#B7B7B7',
      background: '#000000',
      surface: '#161616',
      text_primary: '#FFFFFF',
      text_secondary: '#9CA3AF'
    },
    typography: {
      heading: { font: 'Inter, system-ui', weight: 800, size: 72, lineHeight: 1.05 },
      body: { font: 'Inter, system-ui', weight: 500, size: 20, lineHeight: 1.5 },
      caption: { font: 'Inter, system-ui', weight: 400, size: 14, lineHeight: 1.4 }
    },
    layoutRules: [
      '黑白灰三色为主，禁止彩色',
      '标题字号 ≥ 48px，视觉冲击优先',
      '允许超出血排版与大量负空间',
      '元素对齐遵循网格，边缘对齐保持锋利'
    ],
    tokens: {
      spacing: { pageMargin: 24, sectionGap: 12, cardPadding: 8, baseUnit: 8 },
      radius: { small: 0, medium: 0, large: 0, pill: false },
      border: { width: 2, style: 'solid', color: '#FFFFFF' },
      shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
      motion: { duration: 100, easing: 'ease-out', scope: '切换' }
    },
    aliases: ['xAI', 'Grok', '黑白海报', '高反差'],
    signature:
      '严格黑白灰；超大浓缩标题压一侧或出血；锋利几何切边 + 大量负空间；禁止彩色与圆角',
    whitespaceRatio: 55,
    preferredFormats: ['3:4', '2:3', '1.91:1'],
    suitableFor: '戏剧化海报、宣言、品牌大片、科技态度图',
    unsuitableFor: '需要温暖亲和力的生活方式内容',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-notion',
    name: 'Notion',
    description: '文字优先 · 无装饰 · 灰阶界面，源自 Notion 的文档气质',
    category: 'product-ui',
    tags: ['文字优先', '极简', '灰阶', '文档'],
    visualPrompt:
      'Text-first minimal web design in Notion style, plain typography with no decorative flourishes, clean gray palette on white background, thin 1px divider lines, simple bullet lists and tables, flat design without shadows, generous line spacing, quiet and functional interface, subtle hover states',
    negativePrompt:
      'colorful gradient backgrounds, heavy drop shadows, glossy 3D buttons, glassmorphism cards, decorative illustrations, bold accent colors, dark mode, excessive border radius',
    colorPalette: {
      primary: '#2383E2',
      secondary: '#37352F',
      background: '#FFFFFF',
      surface: '#F7F7F5',
      text_primary: '#37352F',
      text_secondary: '#787774'
    },
    typography: {
      heading: {
        font: 'ui-sans-serif, -apple-system, Segoe UI',
        weight: 600,
        size: 24,
        lineHeight: 1.3
      },
      body: {
        font: 'ui-sans-serif, -apple-system, Segoe UI',
        weight: 400,
        size: 16,
        lineHeight: 1.6
      },
      caption: {
        font: 'ui-sans-serif, -apple-system, Segoe UI',
        weight: 400,
        size: 13,
        lineHeight: 1.4
      }
    },
    layoutRules: [
      '禁止渐变、重阴影与装饰性元素',
      '分割线统一 1px 浅灰',
      '内容区最大宽度 ≤ 900px 居中排布',
      '文字层级用字重与字号区分，不用颜色'
    ],
    tokens: {
      spacing: { pageMargin: 16, sectionGap: 12, cardPadding: 16, baseUnit: 4 },
      radius: { small: 3, medium: 4, large: 6, pill: false },
      border: { width: 1, style: 'solid', color: '#E9E9E7' },
      shadow: { enabled: false, offsetX: 0, offsetY: 0, blur: 0, color: 'rgba(0,0,0,0)' },
      motion: { duration: 120, easing: 'ease', scope: 'hover' }
    },
    aliases: ['Notion', '文档风', '灰阶极简'],
    signature: '白底灰字 + 1px 浅灰分割线贯穿；零阴影零渐变；层级只靠字重与字号，主色几乎不出现',
    whitespaceRatio: 55,
    preferredFormats: ['1.91:1', '16:9', '3:4'],
    suitableFor: '文档配图、知识卡片、产品说明、安静的网页封面',
    unsuitableFor: '需要强视觉冲击的活动海报',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-meta',
    name: 'Meta',
    description: '品牌蓝 · 圆角友好 · 社交氛围，源自 Meta 应用家族',
    category: 'product-ui',
    tags: ['社交', '圆角', '品牌蓝', '移动端'],
    visualPrompt:
      'Friendly social app design in Meta style, vivid Meta blue accents, large rounded corner cards, soft light gray backgrounds, centered circular avatars, clean sans-serif typography, subtle elevation shadows, approachable and energetic mood, balanced grid layout, minimal ornament',
    negativePrompt:
      'dark gloomy theme, neon cyberpunk, ornate luxury style, dense cluttered layouts, harsh red color scheme, heavy gradients, corporate formal tone',
    colorPalette: {
      primary: '#0866FF',
      secondary: '#4D8DFF',
      background: '#FFFFFF',
      surface: '#F0F2F5',
      text_primary: '#1C1E21',
      text_secondary: '#65676B'
    },
    typography: {
      heading: {
        font: 'system-ui, -apple-system, Segoe UI',
        weight: 700,
        size: 22,
        lineHeight: 1.3
      },
      body: { font: 'system-ui, -apple-system, Segoe UI', weight: 400, size: 15, lineHeight: 1.5 },
      caption: {
        font: 'system-ui, -apple-system, Segoe UI',
        weight: 400,
        size: 12,
        lineHeight: 1.4
      }
    },
    layoutRules: [
      '圆角 8-16px，操作按钮采用胶囊圆角',
      '主色仅用于强调与交互，面积占比 ≤ 15%',
      '卡片阴影轻且柔和，避免硬边缘',
      '列表行高 ≥ 48px，保证触控友好'
    ],
    tokens: {
      spacing: { pageMargin: 12, sectionGap: 8, cardPadding: 12, baseUnit: 4 },
      radius: { small: 8, medium: 12, large: 20, pill: true },
      border: { width: 1, style: 'solid', color: '#DADDE1' },
      shadow: { enabled: true, offsetX: 0, offsetY: 1, blur: 2, color: 'rgba(0,0,0,0.1)' },
      motion: { duration: 200, easing: 'ease', scope: 'hover / 切换' }
    },
    aliases: ['Meta', 'Facebook', '社交蓝'],
    signature: '品牌蓝只出现在头像环 / 按钮等一处交互；大圆角卡片 + 浅灰底；触控行高友好',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', '9:16', '1.91:1'],
    suitableFor: '社交产品图、社区活动、移动端营销',
    unsuitableFor: '暗黑赛博或奢侈品极简',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-material',
    name: 'Material Design',
    description: 'Material 3 · 动态配色 · 层级高度，Google 的设计体系',
    category: 'product-ui',
    tags: ['Google', 'Material3', '动态配色', '层级'],
    visualPrompt:
      'Modern app design in Material Design 3 style, dynamic color system with purple baseline, elevated surfaces with tonal overlays, large rounded corners, ripple feedback, floating action buttons, bold typography with strong hierarchy, grid-based layouts, soft ambient shadows conveying elevation levels',
    negativePrompt:
      'flat 2D design without any elevation, sharp corners, thin light fonts, dark fantasy theme, retro 90s web design, heavy borders, skeuomorphic textures',
    colorPalette: {
      primary: '#6750A4',
      secondary: '#625B71',
      background: '#FEF7FF',
      surface: '#F7F2FA',
      text_primary: '#1D1B20',
      text_secondary: '#49454F'
    },
    typography: {
      heading: { font: 'Roboto, system-ui', weight: 700, size: 28, lineHeight: 1.2 },
      body: { font: 'Roboto, system-ui', weight: 400, size: 16, lineHeight: 1.5 },
      caption: { font: 'Roboto, system-ui', weight: 500, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '圆角遵循 4 / 8 / 12 / 16 / 28 阶梯体系',
      '用阴影与表面色调区分 0-5 级高度',
      '主色面积 ≤ 30%，其余使用表面色与色调层',
      '所有可点击元素必须提供涟漪反馈'
    ],
    tokens: {
      spacing: { pageMargin: 16, sectionGap: 8, cardPadding: 16, baseUnit: 4 },
      radius: { small: 4, medium: 12, large: 28, pill: true },
      border: { width: 0, style: 'none', color: '#000000' },
      shadow: { enabled: true, offsetX: 0, offsetY: 2, blur: 8, color: 'rgba(0,0,0,0.3)' },
      motion: { duration: 300, easing: 'cubic-bezier(0.2,0,0,1)', scope: 'hover / 切换 / 入场' }
    },
    aliases: ['Material', 'Material3', 'Google'],
    signature: '色调层表面叠高差；圆角阶梯 4/12/28；主色块面积克制，靠 elevation 阴影分层而非描边',
    whitespaceRatio: 35,
    preferredFormats: ['9:16', '1:1', '16:9'],
    suitableFor: 'Android / 跨端 App 配图、功能介绍、动态色主题演示',
    unsuitableFor: '扁平零高度的印刷海报',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-fluent',
    name: 'Fluent Design',
    description: 'Fluent 2 · 亚克力质感 · 层级与动效，微软的设计语言',
    category: 'product-ui',
    tags: ['微软', 'Fluent2', '亚克力', 'Win11'],
    visualPrompt:
      'Modern web interface in Microsoft Fluent Design 2 style, acrylic and mica translucent materials with subtle blur, rounded corners, soft depth with gentle shadows, Segoe UI Variable typography, fluent motion with natural easing curves, single accent color highlights, clean grid layout, subtle border strokes, calm and productive atmosphere',
    negativePrompt:
      'heavy glassmorphism with strong blur and neon borders, skeuomorphic 3D buttons, dark gothic theme, overly colorful gradients, sharp brutalist edges, playful comic style',
    colorPalette: {
      primary: '#0067C0',
      secondary: '#4CC2FF',
      background: '#F3F3F3',
      surface: '#FFFFFF',
      text_primary: '#1B1B1B',
      text_secondary: '#616161'
    },
    typography: {
      heading: { font: 'Segoe UI Variable, Segoe UI', weight: 600, size: 24, lineHeight: 1.25 },
      body: { font: 'Segoe UI Variable, Segoe UI', weight: 400, size: 14, lineHeight: 1.5 },
      caption: { font: 'Segoe UI Variable, Segoe UI', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '圆角以 4px 为主，控件级 8px',
      '背景可叠加亚克力 / 云母半透明，模糊 ≤ 30px',
      '交互切换使用 150-300ms 自然缓动',
      '用 1px 描边（Stroke）区分层级，避免重阴影'
    ],
    tokens: {
      spacing: { pageMargin: 16, sectionGap: 12, cardPadding: 12, baseUnit: 4 },
      radius: { small: 4, medium: 8, large: 12, pill: false },
      border: { width: 1, style: 'solid', color: '#E5E5E5' },
      shadow: { enabled: true, offsetX: 0, offsetY: 4, blur: 16, color: 'rgba(0,0,0,0.14)' },
      motion: { duration: 200, easing: 'cubic-bezier(0.2,0,0,1)', scope: 'hover / 切换 / 转场' }
    },
    aliases: ['Fluent', 'Fluent2', 'Win11', '微软'],
    signature: '1px Stroke 分层 + 轻阴影；Segoe 系字重克制；强调色只点一次；圆角 4/8 阶梯',
    whitespaceRatio: 55,
    preferredFormats: ['16:9', '1.91:1', '5:2'],
    suitableFor: '桌面端产品图、生产力工具、Windows 生态营销',
    unsuitableFor: '粗野主义或强霓虹夜店风',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
