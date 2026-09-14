import { debounce } from 'es-toolkit'
import type { Ref } from 'vue'
import {
  buildArticleRoot,
  destroyArticleStore,
  getArticleStore
} from '@/windows/main/modules/tool/components/article/articleStore'
import type { ArticleTypePatch } from '@/windows/main/modules/tool/components/article/articleTypes'
import { MessageUtil } from '@/utils/modal'

/**
 * ArticleAside 数据层：以文档为中心的单文章工作台（一篇文章 × 多类型）。
 * - 与 AI 工具共享同一响应式 store 单例：article_write 写入 bump contentRevs → 本层即时重读
 * - id 集合增量 watcher：AI 新建文章自动激活（无选中时），当前文章被删回落最新一篇
 * - mtime 轮询兜底：兼容 AI 用 file_write 直写正文文件的历史路径
 * - 类型（平台）切换：selectType 先冲刷未落盘编辑再切换并重读；类型由 AI 设定（自由命名），用户端只能查看与切换
 * - 编辑器恒可编辑；仅「流式改写进行中」（suspended）期间暂停外部刷新与本地落盘竞争
 */
export const useArticleDoc = (
  props: { sandbox?: string; workspace?: string },
  /** 流式改写进行中标记：true 时暂停轮询与外部重读，避免覆盖流式内容 */
  suspended?: Ref<boolean>
) => {
  /** 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/ */
  const root = computed(() => buildArticleRoot(props.workspace ?? '', props.sandbox ?? ''))
  const store = computed(() => getArticleStore(root.value))

  const articles = computed(() => store.value.project.value?.articles ?? [])

  const activeId = ref('')
  const activeArticle = computed(() => articles.value.find((a) => a.id === activeId.value))
  /** 当前类型（平台）；'' 表示文章尚无类型 */
  const activeType = ref('')
  const activeEntry = computed(() =>
    activeArticle.value?.types.find((t) => t.type === activeType.value)
  )
  /** 版本维度：当前类型的版本列表与激活版本 id（entry.file 恒等于激活版本的 file） */
  const versions = computed(() => activeEntry.value?.versions ?? [])
  const activeVersionId = computed(() => activeEntry.value?.activeVersionId ?? '')
  const content = ref('')
  /** 本地有未落盘编辑（轮询跳过，防覆盖输入；AI 显式写入时仍以 AI 为准） */
  const dirty = ref(false)

  /** 当前类型 md 所在目录（图片相对路径解析基准） */
  const activeMdDir = computed(() =>
    activeEntry.value
      ? window.preload.path.dirname(window.preload.path.join(root.value, activeEntry.value.file))
      : ''
  )

  /** 配图目录（上传 / 粘贴 / 生图落盘于此） */
  const assetsDir = computed(() => window.preload.path.join(root.value, 'assets'))

  // ─── 正文加载与落盘 ────────────────────────────────────────────────

  const loadContent = async (): Promise<void> => {
    if (!activeArticle.value || !activeEntry.value || !activeVersionId.value) {
      content.value = ''
      return
    }
    try {
      content.value = await store.value.readArticle(activeVersionId.value)
    } catch {
      // 读取失败保持内存内容，不阻断
    }
  }

  const writeActiveContent = async (): Promise<void> => {
    const entry = activeEntry.value
    if (!activeArticle.value || !entry) return
    try {
      await window.preload.fs.writeTextFile(
        window.preload.path.join(root.value, entry.file),
        content.value
      )
      dirty.value = false
    } catch {
      // 落盘失败保持内存内容，不阻断编辑
    }
  }

  /** 防抖落盘：编辑内容写回当前类型激活版本文件 */
  const saveDoc = debounce(writeActiveContent, 800)

  const handleContentChange = (value: string): void => {
    content.value = value
    dirty.value = true
    void saveDoc()
  }

  /** 冲刷未落盘编辑（切文章 / 切类型 / 切版本 / 流式改写前调用） */
  const flushSave = async (): Promise<void> => {
    saveDoc.cancel()
    if (dirty.value) await writeActiveContent()
  }

  /** 外部（AI article_write / 文件直写）重读：以磁盘为准覆盖本地 */
  const reloadExternal = async (): Promise<void> => {
    saveDoc.cancel()
    dirty.value = false
    lastPoll = null
    await loadContent()
  }

  // ─── 文章 / 类型选择与自动联动 ─────────────────────────────────────

  const selectArticle = async (id: string): Promise<void> => {
    if (activeId.value === id) return
    await flushSave()
    lastPoll = null
    activeId.value = id
    activeType.value = articles.value.find((a) => a.id === id)?.types[0]?.type ?? ''
    content.value = ''
    await loadContent()
  }

  const selectType = async (type: string): Promise<void> => {
    if (activeType.value === type) return
    await flushSave()
    lastPoll = null
    activeType.value = type
    content.value = ''
    await loadContent()
  }

  /** 以 reload / watcher 后的文章集合为基线，检测 AI 新建与删除 */
  const seenIds = ref<Set<string>>(new Set())
  let seenReady = false

  const seedSeen = (): void => {
    seenIds.value = new Set(articles.value.map((a) => a.id))
    seenReady = true
  }

  watch(
    () => articles.value.map((a) => a.id).join(','),
    () => {
      const ids = articles.value.map((a) => a.id)
      if (!seenReady) {
        seedSeen()
        return
      }
      const added = ids.filter((id) => !seenIds.value.has(id))
      seedSeen()
      // 当前文章被删除：回落到最新一篇
      if (activeId.value && !ids.includes(activeId.value)) {
        void selectArticle(ids[ids.length - 1] ?? '')
        return
      }
      // AI 新建文章且当前未选中：自动激活（写完即出现在编辑器）
      if (!activeId.value && added.length) {
        void selectArticle(added[added.length - 1])
      }
    }
  )

  // 当前文章类型集合变化：AI 追加类型时自动选中（无类型 → 首个新类型）
  watch(
    () => activeArticle.value?.types.map((t) => t.type).join(',') ?? '',
    (typeKeys, old) => {
      if (!seenReady) return
      const article = activeArticle.value
      if (!article) return
      if (activeType.value && article.types.some((t) => t.type === activeType.value)) return
      const added = typeKeys
        .split(',')
        .filter((t) => t && !(old ?? '').split(',').includes(t))
      void selectType(added[added.length - 1] ?? article.types[0]?.type ?? '')
    }
  )

  /** 刷新项目索引并保证有选中文章与类型（重开聊天自动呈现最新一篇）；刷新以磁盘为准，丢弃未落盘编辑 */
  const reload = async (): Promise<void> => {
    saveDoc.cancel()
    dirty.value = false
    await store.value.refresh()
    if (activeId.value && !articles.value.some((a) => a.id === activeId.value)) {
      activeId.value = ''
      activeType.value = ''
      content.value = ''
    }
    if (!activeId.value) {
      const latest = articles.value[articles.value.length - 1]
      if (latest) {
        activeId.value = latest.id
        activeType.value = latest.types[0]?.type ?? ''
      }
    }
    if (activeId.value && !activeEntry.value) {
      activeType.value = activeArticle.value?.types[0]?.type ?? ''
    }
    lastPoll = null
    await loadContent()
    seedSeen()
  }

  /** AI 经 article_write 写入（store bump，key 为 `${id}::${type}`）→ 即时重读呈现 */
  watch(
    () => store.value.contentRevs.get(`${activeId.value}::${activeType.value}`) ?? 0,
    () => {
      if (suspended?.value) return
      void reloadExternal()
    }
  )

  // ─── mtime 轮询（file_write 直写兜底） ─────────────────────────────

  let lastPoll: { file: string; mtime: number } | null = null

  const poll = async (): Promise<void> => {
    const entry = activeEntry.value
    if (!activeArticle.value || !entry || dirty.value || suspended?.value) return
    const filePath = window.preload.path.join(root.value, entry.file)
    if (!(window.preload.fs.existsSync(filePath))) return
    try {
      const st = await window.preload.fs.stat(filePath)
      if (lastPoll && lastPoll.file === filePath && lastPoll.mtime === st.mtime) return
      lastPoll = { file: filePath, mtime: st.mtime }
      const text = await window.preload.fs.readTextFile(filePath)
      if (text !== content.value) {
        saveDoc.cancel()
        dirty.value = false
        content.value = text
      }
    } catch {
      // 读取失败保持现状
    }
  }

  let pollTimer: number | undefined

  onMounted(() => {
    void reload()
    pollTimer = window.setInterval(() => void poll(), 3000)
  })

  onBeforeUnmount(() => {
    if (pollTimer !== undefined) window.clearInterval(pollTimer)
  })

  // 工作空间切换（用户更换目录）→ 释放旧 store，重载新项目
  watch(root, (_val, old) => {
    if (old) destroyArticleStore(old)
    activeId.value = ''
    activeType.value = ''
    content.value = ''
    dirty.value = false
    seenReady = false
    void reload()
  })

  // ─── 版本操作 ─────────────────────────────────────────────────────

  /** 切换版本：先冲刷未落盘编辑（防旧内容经防抖写进新版本文件），再切换并重读正文 */
  const handleSwitchVersion = async (versionId: string): Promise<void> => {
    const article = activeArticle.value
    const entry = activeEntry.value
    if (!article || !entry || versionId === activeVersionId.value) return
    await flushSave()
    try {
      await store.value.switchVersion(article.id, entry.type, versionId)
      await reloadExternal()
    } catch {
      // 切换失败保持当前版本不动
    }
  }

  /** 删除版本：激活版本被删时 store 回落到最后一个版本，重读正文 */
  const handleRemoveVersion = async (versionId: string): Promise<void> => {
    const article = activeArticle.value
    const entry = activeEntry.value
    if (!article || !entry) return
    try {
      await store.value.removeVersion(article.id, entry.type, versionId)
      await reloadExternal()
    } catch (e) {
      MessageUtil.error('版本删除失败', e)
    }
  }

  // ─── 元信息与文件操作 ─────────────────────────────────────────────

  /** 类型级元信息写回（封面 / 配图），与 AI 工具共享同一响应式实例 */
  const patchType = (patch: ArticleTypePatch): void => {
    const article = activeArticle.value
    const entry = activeEntry.value
    if (!article || !entry) return
    store.value
      .updateType(article.id, entry.type, patch)
      .catch(() => MessageUtil.error('类型信息保存失败'))
  }

  /** 在文件管理器中显示：选中类型定位到文件，否则打开项目根目录 */
  const handleReveal = (): void => {
    if (activeEntry.value) {
      window.preload.inject.shell.showItemInFolder(
        window.preload.path.join(root.value, activeEntry.value.file)
      )
    } else {
      window.preload.inject.shell.openPath(root.value)
    }
  }

  return {
    root,
    store,
    articles,
    activeId,
    activeArticle,
    activeType,
    activeEntry,
    versions,
    activeVersionId,
    content,
    dirty,
    activeMdDir,
    assetsDir,
    selectArticle,
    selectType,
    reloadExternal,
    handleContentChange,
    handleSwitchVersion,
    handleRemoveVersion,
    patchType,
    handleReveal,
    flushSave,
    handleRefresh: () => void reload()
  }
}
