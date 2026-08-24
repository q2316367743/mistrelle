import { AiDesignStyle } from '@/entity'
import { PRODUCT_STYLE_PRESETS } from './design-style-presets/product'
import { PRINT_STYLE_PRESETS } from './design-style-presets/print'
import { ART_STYLE_PRESETS } from './design-style-presets/art'
import { EAST_STYLE_PRESETS } from './design-style-presets/east'
import { HANDMADE_STYLE_PRESETS } from './design-style-presets/handmade'
import { POP_STYLE_PRESETS } from './design-style-presets/pop'
import { COMMERCIAL_STYLE_PRESETS } from './design-style-presets/commercial'

/**
 * 内置设计风格预设（系统预设，isSystem = true 不可编辑 / 删除）：
 * - 6 套产品 UI 语言（Apple / xAI / Notion / Meta / Material / Fluent）
 * - 32 套平面图形配方（瑞士 / 杂志 / 包豪斯 / 侘寂 / 终端…）
 * 字段完整（正向 / 反向提示词、配色、字体、布局约束、签名手法），
 * 供 AI 生图 / 设计生成直接消费。预设以代码常量维护、不落盘，
 * 由 DesignStyleStore 与用户自建风格合并展示。
 */
export const DESIGN_STYLE_PRESETS: Array<AiDesignStyle> = [
  ...PRODUCT_STYLE_PRESETS,
  ...PRINT_STYLE_PRESETS,
  ...ART_STYLE_PRESETS,
  ...EAST_STYLE_PRESETS,
  ...HANDMADE_STYLE_PRESETS,
  ...POP_STYLE_PRESETS,
  ...COMMERCIAL_STYLE_PRESETS
]
