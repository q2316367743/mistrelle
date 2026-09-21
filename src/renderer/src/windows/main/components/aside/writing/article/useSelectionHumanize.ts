import { onBeforeUnmount, ref } from 'vue'
import type { Editor } from '@tiptap/core'
import { MessageUtil } from '@/utils/modal'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import {
  HUMANIZE_ENABLED,
  getLastHumanizeDepth,
  setLastHumanizeDepth,
  requestHumanizeStream
} from '@/windows/main/modules/ai/humanize'
import { openHumanizeDepth } from '../components/HumanizeDepthDialog'
import { openSelectionHumanizeDialog } from './components/SelectionHumanizeDialog'

/**
 * 选片段去 AI 味编排（ArticleBubbleMenu 选中文字入口）：
 * 锁编辑器 → 流式改写 → 对比弹窗（替换 / 丢弃）。不建版本、不落数据，
 * 替换即写回正文（走 onUpdate 自动保存）。请求与弹窗期间全程锁编辑器，防选区漂移。
 */
export const useSelectionHumanize = (ctx: {
  /** 气泡菜单所属编辑器（父级 v-if="editor" 保证存在） */
  editor: Editor
  /** 父级是否已锁定编辑器（版本级去 AI 味等）：解锁让位于父级，避免抢开 */
  isParentLocked: () => boolean
}) => {
  /** 改写请求进行中 / 对比弹窗打开中（菜单按钮 loading、其余按钮禁用） */
  const humanizing = ref(false)
  let abortController: AbortController | null = null
  let dialog: { destroy?: () => void } | null = null

  /** 解锁：仅当编辑器仍在且父级未接管锁定时恢复可编辑 */
  const unlock = (): void => {
    if (ctx.editor.isDestroyed) return
    if (ctx.isParentLocked()) return
    ctx.editor.setEditable(true)
  }

  /** 弹窗按钮出口统一收场：清引用、解锁 */
  const settle = (): void => {
    dialog = null
    humanizing.value = false
    unlock()
  }

  /**
   * 替换选区：先校验原文未被改动（版本级去 AI 味可在本流程期间清空正文），
   * 单行结果原位替换（保留标题 / 引用等所在块），多行结果按段落拆分插入。
   */
  const applyReplace = (from: number, to: number, original: string, result: string): void => {
    const ed = ctx.editor
    if (ed.isDestroyed) return
    if (ed.state.doc.textBetween(from, to, '\n').trim() !== original) {
      MessageUtil.warning('正文已发生变化，改写结果不再适用，已丢弃')
      return
    }
    const lines = result.split('\n')
    if (lines.length === 1) {
      ed.chain().focus().insertContentAt({ from, to }, { type: 'text', text: result }).run()
      return
    }
    const blocks = lines.map((line) =>
      line.trim()
        ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
        : { type: 'paragraph' }
    )
    ed.chain().focus().insertContentAt({ from, to }, blocks).run()
  }

  /** 入口：登录 / 选区校验通过后先选深度（与整篇去 AI 味共用弹窗与记忆深度） */
  const start = (): void => {
    const ed = ctx.editor
    if (humanizing.value || !HUMANIZE_ENABLED) return
    if (useAuthStore().status !== 'signed-in') {
      MessageUtil.warning('请先登录后再使用去 AI 味')
      return
    }
    const { from, to } = ed.state.selection
    const original = ed.state.doc.textBetween(from, to, '\n').trim()
    if (!original) return
    // 选区含图片节点时替换会连带删图，拒绝启动（图片操作走图片悬浮框）
    let hasImage = false
    ed.state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name === 'image') hasImage = true
      return !hasImage
    })
    if (hasImage) {
      MessageUtil.warning('选区包含图片，请仅选中要改写的文字')
      return
    }

    openHumanizeDepth({
      defaultDepth: getLastHumanizeDepth(),
      onConfirm: (depth) => void run(depth, from, to, original)
    })
  }

  /** 深度确认后执行：锁编辑器 → 流式改写 → 对比弹窗（弹窗期间保持锁定） */
  const run = (depth: number, from: number, to: number, original: string): void => {
    const ed = ctx.editor
    if (humanizing.value || ed.isDestroyed) return
    humanizing.value = true
    setLastHumanizeDepth(depth)
    ed.setEditable(false)
    abortController = new AbortController()

    void requestHumanizeStream({ text: original, depth, signal: abortController.signal })
      .then((raw) => {
        const result = raw.trim()
        if (!result) throw new Error('改写结果为空')
        dialog = openSelectionHumanizeDialog({
          original,
          result,
          onReplace: () => {
            applyReplace(from, to, original, result)
            settle()
          },
          onCancel: () => settle()
        })
      })
      .catch((e: unknown) => {
        const aborted =
          (e instanceof DOMException && e.name === 'AbortError') ||
          (e instanceof Error && e.name === 'AbortError')
        if (!aborted) MessageUtil.error('去 AI 味失败', e)
        settle()
      })
  }

  // 组件卸载：中止在途请求并销毁遗留弹窗（弹窗挂在 body，不随组件卸载）
  onBeforeUnmount(() => {
    abortController?.abort()
    dialog?.destroy?.()
    dialog = null
  })

  return { humanizing, start }
}
