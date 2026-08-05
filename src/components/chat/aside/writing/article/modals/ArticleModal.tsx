import { h } from 'vue'
import { DialogPlugin } from 'tdesign-vue-next'
import { MessageUtil } from '@/utils/modal'
import { buildArticleRoot, getArticleStore } from '@/modules/tool/components/article/articleStore'
import type { ArticleCreateInput, ArticleItem } from '@/modules/tool/components/article/articleTypes'
import ArticleContent from './ArticleContent.vue'

export interface ArticleModalOptions {
  /** 用户工作空间（可能为空），用于定位项目根 */
  workspace?: string
  /** 沙盒目录（无工作空间时的项目根兜底） */
  sandbox?: string
  /** 创建成功回调（返回新建文章条目，供侧边栏选中） */
  onCreated?: (item: ArticleItem) => void
}

/**
 * 新建文章弹窗外壳（命令式 API，遵循弹窗规范）：
 * DialogPlugin + body 渲染 ArticleContent 内容组件，提交由内容组件内部完成并经 onSubmit 通知外壳落库。
 */
export const openArticleModal = (options: ArticleModalOptions): void => {
  const store = getArticleStore(buildArticleRoot(options.workspace ?? '', options.sandbox ?? ''))

  const dp = DialogPlugin({
    header: '新建文章',
    width: '480px',
    placement: 'center',
    destroyOnClose: true,
    footer: false,
    body: () =>
      h(ArticleContent, {
        onSubmit: async (input: ArticleCreateInput) => {
          try {
            const item = await store.createArticle(input)
            options.onCreated?.(item)
            dp.destroy()
          } catch (e) {
            MessageUtil.error('创建文章失败', e)
          }
        },
        onClose: () => dp.destroy()
      })
  })
}
