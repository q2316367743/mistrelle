import { AiDesignStyle } from '@/entity'
import { PRESET_TS } from './shared'

/**
 * 产品 UI 语言预设（2 套）：Apple / Notion。
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
  }
]
