<template>
  <div class="novel-aside">
    <div class="novel-aside__header">
      <t-select
        class="novel-aside__select"
        :value="activeId"
        placeholder="选择小说"
        :empty="'暂无小说，可让 AI 生成'"
        :popup-props="{ overlayClassName: 'novel-select-overlay' }"
        clearable
        @change="handleSelectChange"
      >
        <t-option v-for="n in novels" :key="n.id" :value="n.id" :label="n.title">
          <div class="novel-aside__option">
            <span class="novel-aside__option-title">{{ n.title }}</span>
            <div class="novel-aside__option-meta">
              <t-tag size="small" variant="light">{{ n.genre }}</t-tag>
              <t-tag size="small" variant="outline" :theme="statusTheme(n.status)">
                {{ statusLabel(n.status) }}
              </t-tag>
            </div>
          </div>
        </t-option>
      </t-select>
      <t-button theme="primary" variant="text" shape="square" title="在文件夹中显示" @click="handleReveal">
        <template #icon>
          <folder-open-icon />
        </template>
      </t-button>
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="handleRefresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>
    <div class="novel-aside__body" :class="{ 'novel-aside__body--split': fullscreen }">
      <template v-if="activeNovel">
        <novel-setting-tabs
          v-if="!fullscreen"
          :active-file="activeFile"
          :contents="contents"
          @change="handleFileChange"
        />
        <template v-else>
          <novel-setting-tree
            :title="activeNovel.title"
            :active-file="activeFile"
            :characters="contents.characters"
            @select="handleFileChange"
          />
          <novel-editor
            :key="`${activeId}-${activeFile}`"
            :content="contents[activeFile] ?? ''"
            mode="edit"
            @change="handleContentChange"
          />
        </template>
      </template>
      <div v-else class="novel-aside__empty">从上方选择小说，或让 AI 生成小说后在此选择</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { debounce } from 'es-toolkit'
import { FolderOpenIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import { NOVEL_FILES, type NovelFileKey } from '@/windows/main/modules/tool/components/novel/novelTypes'
import type { NovelStatus } from '@/windows/main/modules/tool/components/novel/novelTypes'
import {
  buildNovelRoot,
  destroyNovelStore,
  getNovelStore
} from '@/windows/main/modules/tool/components/novel/novelStore'
import NovelEditor from './components/NovelEditor.vue'
import NovelSettingTabs from './components/NovelSettingTabs.vue'
import NovelSettingTree from './components/NovelSettingTree.vue'

const props = defineProps<{
  sandbox?: string
  workspace?: string
  /** 侧边栏全屏：非全屏 tabs 预览；全屏「左设定树 + 右编辑器」 */
  fullscreen?: boolean
}>()

/** 项目根：{workspace}/novels/（有工作空间）或 {sandbox}/outputs/novels/ */
const root = computed(() => buildNovelRoot(props.workspace ?? '', props.sandbox ?? ''))
const store = computed(() => getNovelStore(root.value))

const novels = computed(() => store.value.project.value?.novels ?? [])

const activeId = ref('')
const activeNovel = computed(() => novels.value.find((n) => n.id === activeId.value))

/** 当前编辑 / 预览的文件（正文或 4 个设定文件之一） */
const activeFile = ref<NovelFileKey>('story')

const EMPTY_CONTENTS: Record<NovelFileKey, string> = {
  story: '',
  characters: '',
  outline: '',
  setting: '',
  style: ''
}
const contents = ref<Record<NovelFileKey, string>>({ ...EMPTY_CONTENTS })

const STATUS_THEME: Record<NovelStatus, 'default' | 'warning' | 'success'> = {
  draft: 'default',
  writing: 'warning',
  done: 'success'
}

const STATUS_LABEL: Record<NovelStatus, string> = {
  draft: '草稿',
  writing: '写作中',
  done: '已完稿'
}

const statusTheme = (s: NovelStatus) => STATUS_THEME[s] ?? 'default'
const statusLabel = (s: NovelStatus) => STATUS_LABEL[s] ?? s

/** 加载当前小说全部文件内容（正文 + 4 个设定文件） */
const loadContents = async () => {
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

/** 自动选中 AI 新建小说：以 reload 后的 id 集合为基线，增量新增且未选中任何小说时自动选中最新一部 */
const seenNovelIds = ref<Set<string>>(new Set())
let seenInitialized = false

const seedSeenNovels = () => {
  seenNovelIds.value = new Set(novels.value.map((n) => n.id))
  seenInitialized = true
}

watch(
  () => novels.value.map((n) => n.id).join(','),
  () => {
    if (!seenInitialized) {
      seedSeenNovels()
      return
    }
    const ids = novels.value.map((n) => n.id)
    const added = ids.filter((id) => !seenNovelIds.value.has(id))
    seedSeenNovels()
    if (added.length && !activeId.value) {
      activeId.value = added[added.length - 1]
    }
  }
)

/** 当前文件是否有未落盘的编辑（编辑中跳过自动刷新，避免覆盖用户输入） */
const dirtyFile = ref(false)

/** 刷新项目索引；若当前选中小说已被删除则复位选中 */
const reload = async () => {
  await store.value.refresh()
  if (activeId.value && !novels.value.some((n) => n.id === activeId.value)) {
    activeId.value = ''
  }
  await loadContents()
  seedSeenNovels()
}

// 工作空间切换（用户更换目录）→ 释放旧 store，重载新项目
watch(root, (_val, old) => {
  if (old) destroyNovelStore(old)
  activeId.value = ''
  activeFile.value = 'story'
  dirtyFile.value = false
  void reload()
})

// 切换小说 → 回到正文页并重载内容（待写内容已在 handleSelectChange 中落盘）
watch(activeId, () => {
  activeFile.value = 'story'
  void loadContents()
})

/** 防抖落盘：编辑内容写回当前文件 */
const saveDoc = debounce(async () => {
  if (!activeNovel.value) return
  try {
    await store.value.writeNovelFile(
      activeNovel.value.id,
      activeFile.value,
      contents.value[activeFile.value] ?? ''
    )
    dirtyFile.value = false
  } catch {
    // 落盘失败保持内存内容，不阻断编辑
  }
}, 800)

/** 最近一次轮询到的文件 mtime（文件变化时自动刷新预览） */
let lastPoll: { file: string; mtime: number } | null = null

/** 轮询当前文件 mtime：AI 写入（file_write / novel_*）后自动刷新内容 */
const poll = async () => {
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
    if (content !== contents.value[file]) {
      contents.value[file] = content
    }
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

/** 将当前未落盘内容写盘（切换小说 / 文件前调用） */
const flushPendingSave = async () => {
  if (!activeNovel.value || !dirtyFile.value) return
  try {
    await store.value.writeNovelFile(
      activeNovel.value.id,
      activeFile.value,
      contents.value[activeFile.value] ?? ''
    )
  } catch {
    // 落盘失败不阻断切换
  }
  dirtyFile.value = false
}

const handleSelectChange = (id: unknown) => {
  if (!activeNovel.value) {
    applySelect(id)
    return
  }
  saveDoc.cancel()
  void flushPendingSave().then(() => applySelect(id))
}

const applySelect = (id: unknown) => {
  if (typeof id !== 'string' || !id) {
    activeId.value = ''
    return
  }
  activeId.value = id
}

const handleFileChange = async (key: NovelFileKey) => {
  if (key === activeFile.value) return
  saveDoc.cancel()
  await flushPendingSave()
  activeFile.value = key
  await loadContents()
}

const handleContentChange = (value: string) => {
  contents.value[activeFile.value] = value
  dirtyFile.value = true
  void saveDoc()
}

const handleReveal = () => {
  if (activeNovel.value) {
    window.preload.inject.shell.showItemInFolder(
      window.preload.path.join(root.value, activeNovel.value.dir)
    )
  } else {
    window.preload.inject.shell.openPath(root.value)
  }
}

const handleRefresh = () => {
  void reload()
}
</script>
<style scoped lang="less">
.novel-aside {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__header {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__body {
    margin-top: 8px;
    flex: 1;
    min-height: 0;
    display: flex;
    overflow: hidden;

    &--split {
      gap: 8px;
    }
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }

  &__option {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__option-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__option-meta {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}
</style>
<style lang="less">
/* 自定义 select 下拉选项面板（teleport 到 body，需全局样式；类名见 popup-props.overlayClassName） */
.novel-select-overlay {
  .t-select-option {
    height: 100%;
    padding: 8px;
  }
}
</style>
