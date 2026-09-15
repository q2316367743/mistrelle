/**
 * 设计子场景（design 家族内的渲染引擎分层，新建对话时选定，创建后锁定；存储于聊天 content JSON）：
 * - canvas：画布引擎（leafer 图层树 + 节点级批量编辑，design 家族默认引擎）
 * - html：HTML 引擎（AI 生成固定尺寸自包含 HTML 设计稿，iframe 实时预览 + snapdom 导出 PNG）
 * 仅 design 家族使用；子 Agent 不参与设计引擎分层。
 */
export type DesignScene = 'canvas' | 'html'
