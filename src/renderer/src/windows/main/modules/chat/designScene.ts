import type { Component } from 'vue'
import { Html5Icon, LayersIcon } from 'tdesign-icons-vue-next'

/**
 * 设计子场景（design 聊天类型内的渲染引擎分层，新建对话时选定，创建后锁定）：
 * - canvas：画布引擎（leafer 图层树 + 节点级批量编辑，design 类型默认引擎）
 * - html：HTML 引擎（AI 生成固定尺寸自包含 HTML 设计稿，iframe 实时预览 + snapdom 导出 PNG）
 * 仅 design 聊天类型使用；子 Agent 不参与设计引擎分层。
 */
export type DesignScene = 'canvas' | 'html'

/** 设计子场景选项（供新建对话页等 UI 消费，单一数据源） */
export interface DesignSceneOption {
  value: DesignScene
  label: string
  description: string
  icon: Component
}

export const DESIGN_SCENE_OPTIONS: DesignSceneOption[] = [
  {
    value: 'canvas',
    label: '画布引擎',
    description: 'Leafer 画布，节点级精准编辑，可应对各种场景',
    icon: LayersIcon
  },
  {
    value: 'html',
    label: 'HTML 引擎',
    description: 'AI 生成 HTML 设计稿，适合文字内容较多的场景',
    icon: Html5Icon
  }
]
