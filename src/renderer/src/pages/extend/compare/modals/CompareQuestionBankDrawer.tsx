import { h } from 'vue'
import { DrawerPlugin } from 'tdesign-vue-next'
import CompareQuestionBankDrawerContent from './CompareQuestionBankDrawerContent.vue'

/**
 * 题库管理抽屉（命令式 DrawerPlugin）：
 * 内容组件 CompareQuestionBankDrawerContent.vue 承载题目列表 + 行内编辑表单 + 新增 / 恢复默认，
 * 编辑为本地草稿、显式「保存题库」写回（composable 单例）。
 */
export const openQuestionBankDrawer = () => {
  const dp = DrawerPlugin({
    header: '题库管理',
    size: 'clamp(520px, 60%, 820px)',
    footer: false,
    destroyOnClose: true,
    body: () =>
      h(CompareQuestionBankDrawerContent, {
        onClose: () => dp?.destroy?.()
      })
  })
}
