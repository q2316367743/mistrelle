import { debounce } from 'es-toolkit'
import {
  buildArticleRoot,
  destroyArticleStore,
  getArticleStore
} from '@/windows/main/modules/tool/components/article/articleStore'
import { exportArticleZip } from '@/windows/main/modules/tool/components/article/imageRef'
import type { ArticlePlatform, ArticleStatus } from '@/windows/main/modules/tool/components/article/articleTypes'
import { MessageUtil } from '@/utils/modal'

/**
 * ArticleAside 数据层：项目 store 共享实例（与 AI 工具同源）、文章选择 / 正文读写 / 文件操作。
 * UI 层只消费返回值；配图 / 风格面板的元数据写回也经这里的 store 完成。
 */
export const useArticleDoc = (props: { sandbox?: string; workspace?: string; fullscreen?: boolean }) => {
  /** 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/ */
  const root = computed(() => buildArticleRoot(props.workspace ?? '', props.sandbox ?? ''))
  const store = computed(() => getArticleStore(root.value))

  const articles = computed(() => store.value.project.value?.articles ?? [])
  /** 编辑 / 预览由侧边栏全屏状态驱动：全屏可编辑，非全屏仅预览 */
  const mode = computed<'edit' | 'preview'>(() => (props.fullscreen ? 'edit' : 'preview'))

  const activeId = ref('')
  const activeArticle = computed(() => articles.value.find((a) => a.id === activeId.value))
  const content = ref('')
  const exporting = ref(false)

  /** 当前文章 md 所在目录（预览图片解析基准） */
  const activeMdDir = computed(() =>
    activeArticle.value
      ? window.preload.path.dirname(window.preload.path.join(root.value, activeArticle.value.file))
      : ''
  )

  /** 配图目录（上传 / 粘贴图片落盘于此） */
  const assetsDir = computed(() => window.preload.path.join(root.value, 'assets'))

  const PLATFORM_THEME: Record<ArticlePlatform, 'primary' | 'warning' | 'danger' | 'default'> = {
    公众号: 'primary',
    知乎: 'warning',
    小红书: 'danger',
    其他: 'default'
  }

  const STATUS_THEME: Record<ArticleStatus, 'default' | 'warning' | 'success'> = {
    draft: 'default',
    writing: 'warning',
    done: 'success'
  }

  const STATUS_LABEL: Record<ArticleStatus, string> = {
    draft: '草稿',
    writing: '写作中',
    done: '已完稿'
  }

  const platformTheme = (p: ArticlePlatform) => PLATFORM_THEME[p] ?? 'default'
  const statusTheme = (s: ArticleStatus) => STATUS_THEME[s] ?? 'default'
  const statusLabel = (s: ArticleStatus) => STATUS_LABEL[s] ?? s

  /** 下拉选择：清空则复位选中，否则加载文章内容 */
  const handleSelectChange = (id: unknown) => {
    if (typeof id !== 'string' || !id) {
      activeId.value = ''
      content.value = ''
      return
    }
    void handleSelect(id)
  }

  const handleSelect = async (id: string) => {
    if (activeId.value === id) return
    try {
      content.value = await store.value.readArticle(id)
      activeId.value = id
    } catch {
      // 读取失败不切换
    }
  }

  /** 刷新项目索引；若当前选中文章已被删除则复位选中，否则从磁盘重载正文（反映 AI 改写） */
  const reload = async () => {
    await store.value.refresh()
    if (activeId.value && !articles.value.some((a) => a.id === activeId.value)) {
      activeId.value = ''
      content.value = ''
      return
    }
    if (activeId.value && activeArticle.value) {
      try {
        content.value = await store.value.readArticle(activeId.value)
      } catch {
        // 正文读取失败保持内存内容，不阻断刷新
      }
    }
  }

  onMounted(() => {
    void reload()
  })

  // 工作空间切换（用户更换目录）→ 释放旧 store，重载新项目
  watch(root, (_val, old) => {
    if (old) destroyArticleStore(old)
    activeId.value = ''
    content.value = ''
    void reload()
  })

  /** 防抖落盘：编辑内容写回当前文章正文文件 */
  const saveDoc = debounce(async () => {
    if (!activeArticle.value) return
    try {
      await window.preload.fs.writeTextFile(
        window.preload.path.join(root.value, activeArticle.value.file),
        content.value
      )
    } catch {
      // 落盘失败保持内存内容，不阻断编辑
    }
  }, 800)

  const handleContentChange = (value: string) => {
    content.value = value
    void saveDoc()
  }

  /** 在文件管理器中显示：选中文章定位到文件，否则打开项目根目录 */
  const handleReveal = () => {
    if (activeArticle.value) {
      window.preload.inject.shell.showItemInFolder(
        window.preload.path.join(root.value, activeArticle.value.file)
      )
    } else {
      window.preload.inject.shell.openPath(root.value)
    }
  }

  /** 导出当前文章（含引用的本地图片）为 zip 压缩包 */
  const handleExport = async () => {
    if (!activeArticle.value || exporting.value) return
    const article = activeArticle.value
    let zipPath = await window.preload.inject.dialog.save({
      defaultPath: `${article.title || article.id}.zip`,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    })
    if (!zipPath) return
    if (!zipPath.toLowerCase().endsWith('.zip')) zipPath = `${zipPath}.zip`
    exporting.value = true
    try {
      const result = await exportArticleZip({
        root: root.value,
        articleFile: article.file,
        targetZip: zipPath,
        name: article.title || article.id
      })
      MessageUtil.success(`已导出 ${zipPath}${result.assets ? `（含 ${result.assets} 张图片）` : ''}`)
    } catch (e) {
      MessageUtil.error('导出失败', e)
    } finally {
      exporting.value = false
    }
  }

  return {
    root,
    store,
    articles,
    mode,
    activeId,
    activeArticle,
    content,
    exporting,
    activeMdDir,
    assetsDir,
    platformTheme,
    statusTheme,
    statusLabel,
    handleSelectChange,
    handleContentChange,
    handleReveal,
    handleRefresh: () => void reload(),
    handleExport
  }
}
