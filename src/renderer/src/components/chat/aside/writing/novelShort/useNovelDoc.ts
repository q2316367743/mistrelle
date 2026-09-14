import { debounce } from 'es-toolkit'
import {
  NOVEL_FILES,
  type NovelFileKey
} from '@/windows/main/modules/tool/components/novel/novelTypes'
import {
  buildNovelRoot,
  destroyNovelStore,
  getNovelStore
} from '@/windows/main/modules/tool/components/novel/novelStore'

const EMPTY_CONTENTS: Record<NovelFileKey, string> = {
  story: '',
  characters: '',
  outline: '',
  setting: '',
  style: ''
}

export interface NovelDocContext {
  sandbox?: string
  workspace?: string
}

/**
 * 短篇小说侧边栏数据层（从 NovelAside.vue 抽出，控制组件体积）：
 * - 项目 store / 小说列表 / 当前小说与文件
 * - 内容加载 + 防抖落盘 + AI 写入即时重读（contentRevs）+ mtime 轮询兜底
 * - 新建小说自动选中、工作空间切换释放旧 store
 */
export const useNovelDoc = (props: NovelDocContext) => {
  /** 项目根：{workspace}/novels/（有工作空间）或 {sandbox}/outputs/novels/ */
  const root = computed(() => buildNovelRoot(props.workspace ?? '', props.sandbox ?? ''))
  const store = computed(() => getNovelStore(root.value))

  const novels = computed(() => store.value.project.value?.novels ?? [])

  const activeId = ref('')
  const activeNovel = computed(() => novels.value.find((n) => n.id === activeId.value))

  /** 当前编辑 / 预览的文件（正文或 4 个设定文件之一） */
  const activeFile = ref<NovelFileKey>('story')
  const contents = ref<Record<NovelFileKey, string>>({ ...EMPTY_CONTENTS })

  /** 当前文件是否有未落盘的编辑（编辑中跳过自动刷新，避免覆盖用户输入） */
  const dirtyFile = ref(false)

  /** 加载当前小说全部文件内容（正文 + 4 个设定文件） */
  const loadContents = async (): Promise<void> => {
    const novel = activeNovel.value
    if (!novel) {
      contents.value = { ...EMPTY_CONTENTS }
      return
    }
    const loaded = {} as Record<NovelFileKey, string>
    for (const [key, file] of Object.entries(NOVEL_FILES) as [NovelFileKey, string][]) {
      loaded[key] = await store.value.readNovelFile(novel.id, file)
    }
    contents.value = loaded
  }

  /** 防抖落盘：编辑内容写回当前文件 */
  const saveDoc = debounce(async () => {
    const novel = activeNovel.value
    if (!novel) return
    try {
      await store.value.writeNovelFile(novel.id, NOVEL_FILES[activeFile.value], contents.value[activeFile.value] ?? '')
      dirtyFile.value = false
    } catch {
      // 落盘失败保持内存内容，不阻断编辑
    }
  }, 800)

  /** 将当前未落盘内容写盘（切换小说 / 文件前调用） */
  const flushPendingSave = async (): Promise<void> => {
    const novel = activeNovel.value
    if (!novel || !dirtyFile.value) return
    try {
      await store.value.writeNovelFile(
        novel.id,
        NOVEL_FILES[activeFile.value],
        contents.value[activeFile.value] ?? ''
      )
    } catch {
      // 落盘失败不阻断切换
    }
    dirtyFile.value = false
  }

  // ─── 选中回落与 AI 新建自动切换 ────────────────────────────

  /** 当前选中无效（空 / 已被删）时回落到最新一部（createNovel 追加到末尾，末位即最新） */
  const ensureActiveSelection = (): void => {
    if (activeId.value && novels.value.some((n) => n.id === activeId.value)) return
    activeId.value = novels.value[novels.value.length - 1]?.id ?? ''
  }

  /** 以 reload 后的 id 集合为基线，增量检测 AI 新建（novel_create） */
  const seenNovelIds = ref<Set<string>>(new Set())
  let seenInitialized = false

  const seedSeenNovels = (): void => {
    seenNovelIds.value = new Set(novels.value.map((n) => n.id))
    seenInitialized = true
  }

  watch(
    () => novels.value.map((n) => n.id).join(','),
    async () => {
      if (!seenInitialized) {
        seedSeenNovels()
        return
      }
      const ids = novels.value.map((n) => n.id)
      const added = ids.filter((id) => !seenNovelIds.value.has(id))
      seedSeenNovels()
      // AI 新建小说：切到最新一部（先落盘当前编辑，防内容写串文件）
      const target = added[added.length - 1]
      if (target) {
        saveDoc.cancel()
        await flushPendingSave()
        activeId.value = target
        return
      }
      ensureActiveSelection()
    }
  )

  // ─── 刷新 ────────────────────────────────────────────────

  /** 刷新项目索引：加载后保证有有效选中（无选中回落最新一部） */
  const reload = async (): Promise<void> => {
    await store.value.refresh()
    ensureActiveSelection()
    await loadContents()
    seedSeenNovels()
  }

  /**
   * AI 写入（novel_write / novel_write_setting / novel_character_upsert 经 store bump）→ 即时重读当前文件。
   * 只重读当前文件：其余文件在切换时按需 load，不必全量刷新。
   */
  watch(
    () => store.value.contentRevs.get(`${activeId.value}::${activeFile.value}`) ?? 0,
    async () => {
      const novel = activeNovel.value
      if (!novel || dirtyFile.value) return
      try {
        contents.value[activeFile.value] = await store.value.readNovelFile(
          novel.id,
          NOVEL_FILES[activeFile.value]
        )
      } catch {
        // 读取失败保持现状
      }
    }
  )

  // ─── mtime 轮询（用户手改外部文件的兜底） ────────────────

  let lastPoll: { file: string; mtime: number } | null = null

  /** 轮询当前文件 mtime：外部（编辑器 / 本地工具）改动后自动刷新预览 */
  const poll = async (): Promise<void> => {
    const novel = activeNovel.value
    if (!novel || dirtyFile.value) return
    const file = activeFile.value
    const filePath = window.preload.path.join(root.value, novel.dir, NOVEL_FILES[file])
    if (!(window.preload.fs.existsSync(filePath))) return
    try {
      const st = await window.preload.fs.stat(filePath)
      if (lastPoll && lastPoll.file === file && lastPoll.mtime === st.mtime) return
      lastPoll = { file, mtime: st.mtime }
      const content = await window.preload.fs.readTextFile(filePath)
      if (content !== contents.value[file]) contents.value[file] = content
    } catch {
      // 读取失败保持现状
    }
  }

  let pollTimer: number | undefined

  onMounted(() => {
    void reload()
    pollTimer = window.setInterval(() => {
      void poll()
    }, 3000)
  })

  onBeforeUnmount(() => {
    if (pollTimer !== undefined) window.clearInterval(pollTimer)
  })

  // 工作空间切换（用户更换目录）→ 释放旧 store，重载新项目
  watch(root, (_val, old) => {
    if (old) destroyNovelStore(old)
    activeId.value = ''
    activeFile.value = 'story'
    dirtyFile.value = false
    void reload()
  })

  // 切换小说 → 回到正文页并重载内容（待写内容由调用方先落盘）
  watch(activeId, () => {
    activeFile.value = 'story'
    void loadContents()
  })

  const handleSelectChange = (id: unknown, apply: (v: unknown) => void): void => {
    saveDoc.cancel()
    void flushPendingSave().then(() => apply(id))
  }

  const handleFileChange = async (key: NovelFileKey): Promise<void> => {
    if (key === activeFile.value) return
    saveDoc.cancel()
    await flushPendingSave()
    activeFile.value = key
    await loadContents()
  }

  const handleContentChange = (value: string): void => {
    contents.value[activeFile.value] = value
    dirtyFile.value = true
    void saveDoc()
  }

  return {
    root,
    store,
    novels,
    activeId,
    activeNovel,
    activeFile,
    contents,
    dirtyFile,
    reload,
    loadContents,
    flushPendingSave,
    handleSelectChange,
    handleFileChange,
    handleContentChange
  }
}
