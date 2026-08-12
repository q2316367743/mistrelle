import { AiDesignStyle } from '@/entity'

/**
 * 内置设计风格预设（系统预设，isSystem = true 不可编辑 / 删除）：
 * 覆盖主流设计语言，字段完整（正向 / 反向提示词、配色、字体、布局约束），
 * 供 AI 生图 / 设计生成直接消费。预设以代码常量维护、不落盘，
 * 由 DesignStyleStore 与用户自建风格合并展示。
 */

/** 内置预设固定时间戳（无实际展示意义，仅满足 BaseEntity） */
const PRESET_TS = 0

export const DESIGN_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-apple',
    name: 'Apple 苹果',
    description: '极简克制 · 大标题 · 大量留白，源自 Apple 的设计语言',
    category: '移动端',
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
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-xai',
    name: 'xAI / Grok',
    description: '黑白高反差 · 力量感排版 · 戏剧化海报风',
    category: 'poster',
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
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-notion',
    name: 'Notion',
    description: '文字优先 · 无装饰 · 灰阶界面，源自 Notion 的文档气质',
    category: '网页端',
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
      heading: { font: 'ui-sans-serif, -apple-system, Segoe UI', weight: 600, size: 24, lineHeight: 1.3 },
      body: { font: 'ui-sans-serif, -apple-system, Segoe UI', weight: 400, size: 16, lineHeight: 1.6 },
      caption: { font: 'ui-sans-serif, -apple-system, Segoe UI', weight: 400, size: 13, lineHeight: 1.4 }
    },
    layoutRules: [
      '禁止渐变、重阴影与装饰性元素',
      '分割线统一 1px 浅灰',
      '内容区最大宽度 ≤ 900px 居中排布',
      '文字层级用字重与字号区分，不用颜色'
    ],
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-meta',
    name: 'Meta',
    description: '品牌蓝 · 圆角友好 · 社交氛围，源自 Meta 应用家族',
    category: '移动端',
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
      heading: { font: 'system-ui, -apple-system, Segoe UI', weight: 700, size: 22, lineHeight: 1.3 },
      body: { font: 'system-ui, -apple-system, Segoe UI', weight: 400, size: 15, lineHeight: 1.5 },
      caption: { font: 'system-ui, -apple-system, Segoe UI', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '圆角 8-16px，操作按钮采用胶囊圆角',
      '主色仅用于强调与交互，面积占比 ≤ 15%',
      '卡片阴影轻且柔和，避免硬边缘',
      '列表行高 ≥ 48px，保证触控友好'
    ],
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-material',
    name: 'Material Design',
    description: 'Material 3 · 动态配色 · 层级高度，Google 的设计体系',
    category: '移动端',
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
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-fluent',
    name: 'Fluent Design',
    description: 'Fluent 2 · 亚克力质感 · 层级与动效，微软的设计语言',
    category: '网页端',
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
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
