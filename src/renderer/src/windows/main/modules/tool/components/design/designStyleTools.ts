// ==========================================
//  设计风格管理工具：供内置「设计风格创建助手」通过 tool call 增 / 改 / 查设计风格
//  全部标记 internal：仅注册供该 agent 调用，不对外展示、不可分配给其他 agent
// ==========================================

import { ToolFunction, ToolProperty } from '@/domain'
import {
  AiDesignStyle,
  AiDesignStyleCategory,
  AiDesignStyleForm,
  AiDesignStyleItem,
  DESIGN_STYLE_BORDER_STYLES,
  DESIGN_STYLE_CATEGORY_OPTIONS,
  buildAiDesignStyleForm,
  buildAiDesignStyleTokens,
  normalizeWhitespaceRatio,
  toAiDesignStyleForm
} from '@/entity/ai'
import { useAuthStore, useDesignStyleStore } from '@/windows/main/store'

const CATEGORY_VALUES = DESIGN_STYLE_CATEGORY_OPTIONS.map((e) => e.value)

/** create/update 共用的表单入参（不含 name 的必填约束，由各工具自行声明 required） */
const FORM_PROPERTIES: Record<string, ToolProperty> = {
  name: { type: 'string', description: '风格名称' },
  description: { type: 'string', description: '一句话简介，展示在卡片下方' },
  category: {
    type: 'string',
    description:
      '风格分组（可选值：product-ui=产品 UI / print-tradition=印刷传统 / art-movement=艺术运动 / east=东方 / handmade=手作纸感 / pop-culture=流行文化 / commercial=影像商业）',
    enum: CATEGORY_VALUES
  },
  tags: {
    type: 'array',
    description: '用户自定义标签',
    items: { type: 'string', description: '标签文本' }
  },
  visualPrompt: { type: 'string', description: '正向风格描述词：描述构图、光影、材质、氛围' },
  negativePrompt: { type: 'string', description: '反向排除词：告诉 AI 不要出现什么' },
  colorPalette: {
    type: 'object',
    description: '配色方案（6 个颜色字段均为色值，如 #1677ff）',
    properties: {
      primary: { type: 'string', description: '主色' },
      secondary: { type: 'string', description: '次色' },
      background: { type: 'string', description: '背景色' },
      surface: { type: 'string', description: '表面 / 卡片色' },
      text_primary: { type: 'string', description: '主文本色' },
      text_secondary: { type: 'string', description: '次要文本色' }
    }
  },
  typography: {
    type: 'object',
    description: '字体规范（heading / body / caption 三级，每级含 font/weight/size/lineHeight）',
    properties: {
      heading: {
        type: 'object',
        description: '标题层级',
        properties: {
          font: { type: 'string', description: '字体族，空表示继承默认' },
          weight: { type: 'number', description: '字重' },
          size: { type: 'number', description: '字号（px）' },
          lineHeight: { type: 'number', description: '行高倍率' }
        }
      },
      body: {
        type: 'object',
        description: '正文层级',
        properties: {
          font: { type: 'string', description: '字体族，空表示继承默认' },
          weight: { type: 'number', description: '字重' },
          size: { type: 'number', description: '字号（px）' },
          lineHeight: { type: 'number', description: '行高倍率' }
        }
      },
      caption: {
        type: 'object',
        description: '辅助说明层级',
        properties: {
          font: { type: 'string', description: '字体族，空表示继承默认' },
          weight: { type: 'number', description: '字重' },
          size: { type: 'number', description: '字号（px）' },
          lineHeight: { type: 'number', description: '行高倍率' }
        }
      }
    }
  },
  layoutRules: {
    type: 'array',
    description: '布局硬约束（针对生图模型 / 画布图层动作，如贯穿线、强调色只出现一次）',
    items: { type: 'string', description: '一条布局规则' }
  },
  aliases: {
    type: 'array',
    description: '口头别名（点名匹配，如「瑞士」「国际主义」）',
    items: { type: 'string', description: '别名' }
  },
  signature: {
    type: 'string',
    description: '签名手法：本风格独有的那一招；只换色板不算换风格，必须写清可执行的图层动作'
  },
  whitespaceRatio: {
    type: 'number',
    description: '留白目标档位：35 / 55 / 70（短边占比约值）',
    enum: [35, 55, 70]
  },
  preferredFormats: {
    type: 'array',
    description: "常用画幅比例，如 '3:4' / '1.91:1' / '1:1'",
    items: { type: 'string', description: '比例字符串' }
  },
  suitableFor: { type: 'string', description: '适用场景简述' },
  unsuitableFor: { type: 'string', description: '不适用场景简述' },
  tokens: {
    type: 'object',
    description: '全局样式细节规范（tokens）：间距 / 圆角 / 边框 / 阴影 / 动效，可整体或部分传入',
    properties: {
      spacing: {
        type: 'object',
        description: '间距规范',
        properties: {
          pageMargin: { type: 'number', description: '页面安全边距（px）' },
          sectionGap: { type: 'number', description: '区块 / 卡片间距（px）' },
          cardPadding: { type: 'number', description: '卡片 / 容器内边距（px）' },
          baseUnit: { type: 'number', description: '间距基准单位（px）' }
        }
      },
      radius: {
        type: 'object',
        description: '圆角规范',
        properties: {
          small: { type: 'number', description: '小圆角：按钮 / 输入框（px）' },
          medium: { type: 'number', description: '常规圆角：卡片（px）' },
          large: { type: 'number', description: '大圆角：弹窗 / 横幅（px）' },
          pill: { type: 'boolean', description: '是否胶囊圆角（按钮全圆角）' }
        }
      },
      border: {
        type: 'object',
        description: '边框规范',
        properties: {
          width: { type: 'number', description: '边框宽度（px）' },
          style: {
            type: 'string',
            description: '边框样式',
            enum: [...DESIGN_STYLE_BORDER_STYLES]
          },
          color: { type: 'string', description: '边框颜色（色值，如 #e0e0e0）' }
        }
      },
      shadow: {
        type: 'object',
        description: '阴影规范',
        properties: {
          enabled: { type: 'boolean', description: '是否启用阴影' },
          offsetX: { type: 'number', description: '水平偏移（px）' },
          offsetY: { type: 'number', description: '垂直偏移（px）' },
          blur: { type: 'number', description: '模糊半径（px）' },
          color: { type: 'string', description: '阴影颜色（支持透明度，如 rgba(0,0,0,0.08)）' }
        }
      },
      motion: {
        type: 'object',
        description: '动效规范',
        properties: {
          duration: { type: 'number', description: '过渡基础时长（ms）' },
          easing: { type: 'string', description: '缓动曲线（如 ease / cubic-bezier(0.2,0,0,1)）' },
          scope: { type: 'string', description: '动效范围（如 hover / 切换 / 入场）' }
        }
      }
    }
  }
}

/** 模型可能传入的表单字段（全部可选，具体必填由 parameters.required 声明） */
type DesignStyleFormArgs = Partial<AiDesignStyleForm>

/** 校验 category 合法性；返回非法值（undefined 即未传，视为合法） */
const invalidCategory = (category?: AiDesignStyleCategory): boolean =>
  category !== undefined && !CATEGORY_VALUES.includes(category)

const categoryError = (category: string) => ({
  error: `分类 "${category}" 不合法，可选值：${CATEGORY_VALUES.join(' / ')}`
})

/** 风格概要信息（列表用，含色板与签名手法供模型参考） */
const toSummary = (style: AiDesignStyleItem | AiDesignStyle) => ({
  id: style.id,
  name: style.name,
  description: style.description,
  category: style.category,
  tags: style.tags,
  isSystem: 'isSystem' in style && style.isSystem,
  colorPalette: style.colorPalette,
  aliases: 'aliases' in style ? style.aliases : undefined,
  signature: 'signature' in style ? style.signature : undefined,
  preferredFormats: 'preferredFormats' in style ? style.preferredFormats : undefined,
  suitableFor: 'suitableFor' in style ? style.suitableFor : undefined
})

/** AI 生成设计风格为会员权益：非会员 Agent 面不可见、工具写入兜底拒绝（手动表单新增不受限） */
const stylesLocked = () => !useAuthStore().features.extendedDesignStyles

const STYLES_LOCKED_ERROR = 'AI 生成设计风格为会员功能，请引导用户到 设置 → 账户 开通会员，或手动新建'

export const designStyleTools: ToolFunction[] = [
  {
    name: 'list_design_styles',
    label: '查询设计风格列表',
    description:
      '列出系统中全部设计风格的概要信息（id、名称、简介、分类、标签、是否系统预设、配色方案）。创建新风格前可先查询已有风格与系统预设，避免重复；修改风格前用于定位目标 id。',
    parameters: { type: 'object', properties: {} },
    risk: 'safe',
    internal: true,
    handler: async () => {
      const store = useDesignStyleStore()
      const styles = stylesLocked()
        ? store.all.filter((s) => 'isSystem' in s && s.isSystem)
        : store.all
      return { styles: styles.map(toSummary) }
    }
  },
  {
    name: 'get_design_style',
    label: '查询设计风格详情',
    description:
      '按 id 查询某个设计风格的完整信息（含正向 / 反向提示词、配色、字体规范、布局约束等全部字段）。修改风格前必须先调用此工具获取当前配置，再基于现状产出修改。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '风格 id（可通过 list_design_styles 获取）' }
      },
      required: ['id']
    },
    risk: 'safe',
    internal: true,
    handler: async (...params: unknown[]) => {
      const { id } = params[0] as { id: string }
      const style = await useDesignStyleStore().getDetail(id)
      if (!style) return { error: `未找到 id 为 "${id}" 的设计风格` }
      return { style }
    }
  },
  {
    name: 'create_design_style',
    label: '创建设计风格',
    description:
      '创建一个新的设计风格并立即保存。需提供名称（name），其余字段可选；配色、字体等复杂字段若不传会使用默认值。创建成功后返回新风格的 id。',
    parameters: {
      type: 'object',
      properties: FORM_PROPERTIES,
      required: ['name']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const args = params[0] as DesignStyleFormArgs
      if (stylesLocked()) return { error: STYLES_LOCKED_ERROR }
      const name = args.name?.trim()
      if (!name) return { error: '风格名称（name）不能为空' }
      if (invalidCategory(args.category)) return categoryError(args.category as string)
      const form: AiDesignStyleForm = {
        ...buildAiDesignStyleForm(),
        ...args,
        name,
        whitespaceRatio: normalizeWhitespaceRatio(args.whitespaceRatio),
        // 模型可能只传 tokens 的部分分组，用默认值兜底合并
        tokens: buildAiDesignStyleTokens(args.tokens)
      }
      const id = await useDesignStyleStore().put(form)
      if (!id) return { error: '设计风格创建失败，未生成 id' }
      return { id, name, message: '设计风格创建成功，已出现在「设计风格」列表中' }
    }
  },
  {
    name: 'update_design_style',
    label: '修改设计风格',
    description:
      '按 id 修改已有设计风格的配置并立即保存。仅需传入要变更的字段，未传字段保持原值；系统预设（isSystem）只读，不可修改。建议先调用 get_design_style 获取当前配置。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '要修改的风格 id（可通过 list_design_styles 获取）' },
        ...FORM_PROPERTIES
      },
      required: ['id']
    },
    risk: 'sensitive',
    internal: true,
    handler: async (...params: unknown[]) => {
      const { id, ...rest } = params[0] as { id: string } & DesignStyleFormArgs
      const store = useDesignStyleStore()
      if (stylesLocked()) return { error: STYLES_LOCKED_ERROR }
      if (store.isSystem(id)) return { error: '系统预设只读，不允许修改' }
      const old = await store.getDetail(id)
      if (!old) return { error: `未找到 id 为 "${id}" 的设计风格` }
      if (invalidCategory(rest.category)) return categoryError(rest.category as string)
      // 先取出 tokens（保留精确类型），避免被 Object.fromEntries 抹成宽联合类型
      const { tokens, ...restFields } = rest
      // 仅覆盖显式传入的字段，undefined 不参与合并
      const patch = Object.fromEntries(Object.entries(restFields).filter(([, v]) => v !== undefined))
      const form: AiDesignStyleForm = {
        ...toAiDesignStyleForm(old),
        ...patch,
        whitespaceRatio: normalizeWhitespaceRatio(
          (patch.whitespaceRatio as number | undefined) ?? old.whitespaceRatio
        ),
        // tokens 支持部分分组更新，与旧值（已归一化）合并
        tokens: buildAiDesignStyleTokens(tokens ?? old.tokens)
      }
      if (!form.name.trim()) return { error: '风格名称（name）不能为空' }
      await store.put(form, id)
      return { id, name: form.name, message: '设计风格修改成功' }
    }
  }
]
