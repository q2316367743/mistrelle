import type { ZhuqueDetectResult } from '@/windows/main/modules/tool/components/article/articleTypes'

/**
 * 长文创作侧边栏的外部接口预留（去 AI 味流式改写 + 朱雀 AIGC 检测）。
 * 两个能力均未接入：接入时实现对应 request 函数并把开关置 true，
 * UI 编排（版本条按钮 → 产出新版本 / 结果落版本）已就绪，无需再改。
 */

/** 去 AI 味流式接口是否已接入 */
export const HUMANIZE_ENABLED = false

export interface HumanizeStreamRequest {
  /** 原文全文 */
  text: string
  /** 流式增量回调（编辑器经 watch content 实时跟随渲染） */
  onDelta: (delta: string) => void
  /** 中止信号 */
  signal?: AbortSignal
}

/**
 * 去 AI 味流式改写：输入正文，流式输出去 AI 味内容。
 * 接入时实现：增量经 onDelta 输出，resolve 完整改写文本。
 */
export async function requestHumanizeStream(_req: HumanizeStreamRequest): Promise<string> {
  throw new Error('去 AI 味流式接口暂未开放')
}

/** 朱雀检测是否已接入 */
export const ZHUQUE_ENABLED = false

/** 朱雀 AIGC 检测：输入正文，返回 ai / 疑似 ai / 人工 三个占比（百分比，和为 100） */
export async function requestZhuqueDetect(_text: string): Promise<ZhuqueDetectResult> {
  throw new Error('朱雀检测暂未开放，需企业认证接入')
}
