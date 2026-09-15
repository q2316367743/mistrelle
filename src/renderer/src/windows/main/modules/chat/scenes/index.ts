import type { Component } from 'vue'
import {
  EditIcon,
  PaletteIcon,
  WorkIcon,
  FileMarkdownIcon,
  BookOpenIcon,
  LayersIcon,
  Html5Icon
} from 'tdesign-icons-vue-next'
import type { ToolFunction } from '@/domain'
import type { ChatType } from '../chatType'
import type { DesignScene } from '../designScene'
import type { WritingScene } from '../writingScene'
import type { SubAgentType } from '@/windows/main/modules/subagent/types'
import { createImageSubAgentTools } from '@/windows/main/modules/tool/components/design/imageSubAgent'
import type { BuiltInSkill, SceneContext, SceneDefinition } from './types'
import { officeScene } from './office'
import { articleScene, novelShortScene } from './writing'
import { canvasScene, htmlScene } from './design'

export * from './types'

/**
 * 场景注册表（单一数据源）：家族（ChatType，存储 type 列）→ 子场景（存储 writingScene /
 * designScene 字段）→ 叶子场景定义。Record 嵌套 + resolveScene 不带 default 分支，
 * 新增家族 / 子场景漏注册都会在编译期报错（穷尽性约束）。
 */
export const SCENES: {
  office: SceneDefinition
  writing: Record<WritingScene, SceneDefinition>
  design: Record<DesignScene, SceneDefinition>
} = {
  office: officeScene,
  writing: { article: articleScene, novelShort: novelShortScene },
  design: { canvas: canvasScene, html: htmlScene }
}

/**
 * 存储字段 → 叶子场景定义。switch 刻意不带 default：新增 ChatType 联合成员时
 * 函数存在不返回路径，编译期即报错，杜绝静默回退错场景。
 */
export const resolveScene = (
  type: ChatType,
  writingScene?: WritingScene,
  designScene?: DesignScene
): SceneDefinition => {
  switch (type) {
    case 'office':
      return SCENES.office
    case 'writing':
      return SCENES.writing[writingScene ?? 'article']
    case 'design':
      return SCENES.design[designScene ?? 'canvas']
  }
}

/** 子场景选项（新建页二级选择器消费，label / description / icon 与叶子场景配套展示） */
export interface SceneVariantOption {
  value: WritingScene | DesignScene
  /** 存储字段名（writingScene / designScene），与 ChatRequestParams 对应 */
  field: 'writingScene' | 'designScene'
  label: string
  description: string
  icon: Component
}

/** 家族元数据（新建页一级选择器 / 聊天列表图标消费）：显示信息按家族聚合，叶子能力在 SceneDefinition */
export interface SceneFamilyMeta {
  type: ChatType
  label: string
  description: string
  icon: Component
  /** 子场景维度（有子场景的家族才有）：新建页据是否存在 variants 渲染二级选择器 */
  variants?: { field: 'writingScene' | 'designScene'; options: SceneVariantOption[] }
  /** 家族默认子场景（无子场景的家族不需要） */
  defaultVariant?: WritingScene | DesignScene
}

/** 家族元数据单一数据源：Record<ChatType, …> 穷尽约束，新增家族漏登记编译期报错 */
export const SCENE_FAMILY_META: Record<ChatType, SceneFamilyMeta> = {
  writing: {
    type: 'writing',
    label: '写作',
    description: '文档创作，侧边栏实时编辑与预览',
    icon: EditIcon,
    variants: {
      field: 'writingScene',
      options: [
        {
          value: 'article',
          field: 'writingScene',
          label: '文章创作',
          description: '自媒体文章项目管理，含配图（设计子 Agent）',
          icon: FileMarkdownIcon
        },
        {
          value: 'novelShort',
          field: 'writingScene',
          label: '短篇小说',
          description: '短篇创作：角色 / 大纲 / 设定 / 文风管理',
          icon: BookOpenIcon
        }
      ]
    },
    defaultVariant: 'article'
  },
  design: {
    type: 'design',
    label: '设计创意',
    description: '画布 / HTML 双引擎，AI 直接绘制设计稿',
    icon: PaletteIcon,
    variants: {
      field: 'designScene',
      options: [
        {
          value: 'canvas',
          field: 'designScene',
          label: '画布引擎',
          description: 'Leafer 画布，节点级精准编辑，可应对各种场景',
          icon: LayersIcon
        },
        {
          value: 'html',
          field: 'designScene',
          label: 'HTML 引擎',
          description: 'AI 生成 HTML 设计稿，适合文字内容较多的场景',
          icon: Html5Icon
        }
      ]
    },
    defaultVariant: 'canvas'
  },
  office: {
    type: 'office',
    label: '日常办公',
    description: '文档、表格、任务管理，全能助手',
    icon: WorkIcon
  }
}

/** 展示顺序（新建页）：office 置末。Record 穷尽约束——新增家族必须在此给序号 */
const FAMILY_ORDER: Record<ChatType, number> = { writing: 0, design: 1, office: 2 }

/** 家族元数据有序列表（顺序即新建页展示顺序），由 META 按序派生 */
export const SCENE_FAMILIES: SceneFamilyMeta[] = (Object.keys(SCENE_FAMILY_META) as ChatType[])
  .sort((a, b) => FAMILY_ORDER[a] - FAMILY_ORDER[b])
  .map((type) => SCENE_FAMILY_META[type])

/** 按家族取元数据（聊天列表图标等只有 type 信息的场景使用；Record 索引恒有值） */
export const getSceneFamily = (type: ChatType): SceneFamilyMeta => SCENE_FAMILY_META[type]

/**
 * 子 Agent 能力类型 → 专用工具工厂（仅用于「仅场景工具」型子 Agent，见 isSceneToolsOnlyAgent）。
 * 未登记的能力类型走常规路径（主 Agent 工具面 + 场景工具 + 默认常驻工具）。
 * 生图型：image_generate + 图片处理，能力面完全封闭，不注入任何默认常驻工具。
 */
export const SUB_AGENT_TOOL_CONFIG: Partial<
  Record<SubAgentType, (ctx: SceneContext) => ToolFunction[]>
> = {
  image: (ctx) => createImageSubAgentTools(ctx)
}

/** 全部叶子场景（内置 skill 全局查找用） */
const ALL_SCENES: SceneDefinition[] = [
  SCENES.office,
  ...Object.values(SCENES.writing),
  ...Object.values(SCENES.design)
]

/**
 * 场景内置 skill 全局查找（load_skill 解析链兜底，用户目录 skills 优先）：
 * 目录注入按当前场景限定，但加载不做场景强约束——内置 skill 名称是全局约定
 * （建议带场景前缀避免撞名），被用户目录同名 skill 遮蔽属预期行为。
 */
export const findBuiltInSkill = (name: string): BuiltInSkill | undefined => {
  const key = name.trim().toLowerCase()
  if (!key) return undefined
  return ALL_SCENES.flatMap((scene) => scene.skills ?? []).find(
    (skill) => skill.name.toLowerCase() === key
  )
}
