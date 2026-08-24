import { AiDesignStyle } from '@/entity'
import { PRESET_TS, graphicFlatTokens } from './shared'

/** 印刷传统：瑞士 / 杂志 / 报纸 / 蓝图 / 档案 */
export const PRINT_STYLE_PRESETS: Array<AiDesignStyle> = [
  {
    id: 'preset-swiss',
    name: '瑞士国际主义',
    description: '理性、克制、专业。白底红黑网格，看起来像一份「正确」的东西。',
    category: 'print-tradition',
    tags: ['瑞士', '网格', '国际主义', 'Helvetica'],
    visualPrompt:
      'Swiss International Style poster, white background, strict 12-column grid, bold sans-serif typography, single red accent used once, 1px horizontal rule cutting title from body, numbered corners 01/04, rational and precise',
    negativePrompt: 'gradients, soft shadows, rounded cards, neon colors, cluttered decoration',
    colorPalette: {
      primary: '#e4002b',
      secondary: '#dcdcdc',
      background: '#ffffff',
      surface: '#f7f7f7',
      text_primary: '#111111',
      text_secondary: '#6b6b6b'
    },
    typography: {
      heading: { font: 'Helvetica Neue, Arial, sans-serif', weight: 700, size: 64, lineHeight: 1.05 },
      body: { font: 'Helvetica Neue, Arial, sans-serif', weight: 400, size: 18, lineHeight: 1.5 },
      caption: { font: 'Helvetica Neue, Arial, sans-serif', weight: 400, size: 12, lineHeight: 1.4 }
    },
    layoutRules: [
      '一条贯穿画板的 1px 横线切开标题与内容',
      '元素严格对齐到 12 栏网格',
      '角落放 01 / 04 形式编号',
      '红色强调色整张图只出现一次'
    ],
    tokens: graphicFlatTokens('#dcdcdc', 56),
    aliases: ['瑞士', '国际主义', '网格设计', 'Helvetica 风'],
    signature: '贯穿 1px 横线切开标题与内容；12 栏严格对齐；角落 01/04 编号；红色只出现一次',
    whitespaceRatio: 55,
    preferredFormats: ['1.91:1', '5:2', 'A4'],
    suitableFor: '产品发布、作品集、B 端、数据、打印稿',
    unsuitableFor: '需要温度与人情味的生活方式内容',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-editorial',
    name: '杂志编辑部',
    description: '有观点、有分量。米白纸、衬线大标题、首字下沉，像一本值得读的刊物。',
    category: 'print-tradition',
    tags: ['杂志', '编辑', '衬线', '刊物'],
    visualPrompt:
      'Editorial magazine cover, warm off-white paper, large serif headline with drop cap, thin rules framing section name, hairline column divider, restrained burgundy accent',
    negativePrompt: 'neon gradients, app UI cards, playful stickers, cyberpunk glow',
    colorPalette: {
      primary: '#a8331f',
      secondary: '#d5d0c3',
      background: '#f4f1ea',
      surface: '#ebe6dc',
      text_primary: '#16160f',
      text_secondary: '#6a675c'
    },
    typography: {
      heading: { font: 'Source Han Serif SC, Songti SC, Georgia, serif', weight: 700, size: 56, lineHeight: 1.1 },
      body: { font: 'Noto Sans SC, PingFang SC, sans-serif', weight: 400, size: 16, lineHeight: 1.65 },
      caption: { font: 'SF Mono, Menlo, monospace', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '主标题用衬线，眉标/落款用等宽或小型大写',
      '顶部细线夹栏目名（字距放开）',
      '可做首字下沉（3 行高衬线大字）',
      '竖向 hairline 分栏，不要堆卡片阴影'
    ],
    tokens: graphicFlatTokens('#d5d0c3', 48),
    aliases: ['杂志风', '刊物风', '长文封面', '编辑部'],
    signature: '首字下沉 + 顶部细线夹栏目名 + 竖向 hairline 分栏；标题衬线、其余无衬线拉开反差',
    whitespaceRatio: 55,
    preferredFormats: ['3:4', '1.91:1'],
    suitableFor: '长文封面、观点输出、书单、简报、专栏',
    unsuitableFor: '强促销喊麦风',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-newsprint',
    name: '报纸',
    description: '紧迫、权威、信息密度高。报头三层横线 + 分栏 + 网点纹理。',
    category: 'print-tradition',
    tags: ['报纸', '报刊', '号外', '单色'],
    visualPrompt:
      'Vintage newspaper layout, cream newsprint, bold serif masthead, triple horizontal rules, multi-column body, subtle halftone dots, monochrome ink only',
    negativePrompt: 'color gradients, glassmorphism, soft pastel UI, neon',
    colorPalette: {
      primary: '#14140f',
      secondary: '#585448',
      background: '#f0ede6',
      surface: '#e8e4db',
      text_primary: '#14140f',
      text_secondary: '#585448'
    },
    typography: {
      heading: { font: 'Source Han Serif SC, Georgia, serif', weight: 900, size: 48, lineHeight: 1.05 },
      body: { font: 'Source Han Serif SC, Georgia, serif', weight: 400, size: 14, lineHeight: 1.5 },
      caption: { font: 'Courier New, monospace', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '报头式三层横线（粗/空/细）',
      '日期与期号分列报头两端',
      '正文 2~3 栏，栏间 1px 竖线',
      '叠一层极淡点阵模拟印刷网点；全部单色靠字号字重分层'
    ],
    tokens: graphicFlatTokens('#14140f', 40),
    aliases: ['报刊', '老报纸', '号外', 'newsprint'],
    signature: '报头三层横线 + 两端期号日期；2~3 栏正文；点阵纹理；单色分层',
    whitespaceRatio: 35,
    preferredFormats: ['1.91:1', 'A4'],
    suitableFor: '宣言、盘点、年终总结、复古活动',
    unsuitableFor: '需要彩色品牌系统的产品图',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-blueprint',
    name: '工程蓝图',
    description: '精密、可信、工程感。深蓝网格 + 尺寸标注 + 图框标题栏。',
    category: 'print-tradition',
    tags: ['蓝图', '技术', 'CAD', '等宽'],
    visualPrompt:
      'Engineering blueprint aesthetic, deep navy background, dual grid lines, dimension callouts with arrows, title block table in corner, all monospace type, cyan accents',
    negativePrompt: 'pastel lifestyle, soft blur photos, luxury gold, cute icons',
    colorPalette: {
      primary: '#4da3ff',
      secondary: '#7fb0dc',
      background: '#0d2b4d',
      surface: '#123a63',
      text_primary: '#e8f2fc',
      text_secondary: '#7fb0dc'
    },
    typography: {
      heading: { font: 'SF Mono, JetBrains Mono, monospace', weight: 700, size: 40, lineHeight: 1.1 },
      body: { font: 'SF Mono, JetBrains Mono, monospace', weight: 400, size: 14, lineHeight: 1.55 },
      caption: { font: 'SF Mono, JetBrains Mono, monospace', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '双层网格铺满（细格 + 粗格）',
      '用带箭头的尺寸标注线标住主标题宽度',
      '右下角图框标题栏（比例/日期/编号）',
      '关键位置打十字定位标记；全部等宽字'
    ],
    tokens: {
      ...graphicFlatTokens('rgba(160,205,245,0.22)', 40),
      border: { width: 1, style: 'solid', color: 'rgba(160,205,245,0.22)' }
    },
    aliases: ['蓝图', '图纸', '技术图', 'CAD 风'],
    signature: '双层网格 + 尺寸标注线 + 右下角图框标题栏 + 十字定位；全等宽字',
    whitespaceRatio: 35,
    preferredFormats: ['5:2', '1.91:1', '16:9'],
    suitableFor: '技术内容、架构图、规格说明、开发者向',
    unsuitableFor: '情感向生活方式海报',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  },
  {
    id: 'preset-archive',
    name: '档案手稿',
    description: '人味、时间感、一手材料。打字机等宽 + 旋转印章 + 装订孔。',
    category: 'print-tradition',
    tags: ['档案', '手稿', '打字机', '复古'],
    visualPrompt:
      'Archive manuscript aesthetic, aged paper, typewriter monospace, rotated rectangular stamp, binder holes on left, form-like underline fields, paper grain',
    negativePrompt: 'glossy UI, neon glow, modern SaaS cards, purple gradients',
    colorPalette: {
      primary: '#9b3227',
      secondary: '#c4b99f',
      background: '#e7dfcd',
      surface: '#ddd4be',
      text_primary: '#33302a',
      text_secondary: '#7d7562'
    },
    typography: {
      heading: { font: 'Courier New, SF Mono, monospace', weight: 700, size: 36, lineHeight: 1.15 },
      body: { font: 'Courier New, SF Mono, monospace', weight: 400, size: 15, lineHeight: 1.6 },
      caption: { font: 'Courier New, SF Mono, monospace', weight: 400, size: 11, lineHeight: 1.4 }
    },
    layoutRules: [
      '一枚旋转约 -8° 的双线方框印章（大写宽字距）',
      '左侧一列等距装订孔（小圆点）',
      '表单式字段行：标签 + 下划线',
      '纸张噪点偏重；打字机等宽为主'
    ],
    tokens: graphicFlatTokens('#c4b99f', 48),
    aliases: ['手稿', '卷宗', '打字机', '旧文件'],
    signature: '旋转双线印章 + 左侧装订孔 + 下划线表单字段 + 纸感噪点',
    whitespaceRatio: 35,
    preferredFormats: ['1:1', 'A4', '3:4'],
    suitableFor: '复盘、记录、个人项目、年度总结、复古主题',
    unsuitableFor: '高光泽科技产品发布',
    isSystem: true,
    createdAt: PRESET_TS,
    updatedAt: PRESET_TS
  }
]
