<template>
  <div class="article-aside">
    <div class="article-aside__header">
      <t-select
        class="article-aside__select"
        :value="activeId"
        placeholder="选择文章"
        :empty="'暂无文章，可让 AI 生成'"
        :popup-props="{ overlayClassName: 'article-select-overlay' }"
        clearable
        @change="handleSelectChange"
      >
        <t-option v-for="a in articles" :key="a.id" :value="a.id" :label="a.title">
          <div class="article-aside__option">
            <span class="article-aside__option-title">{{ a.title }}</span>
            <div class="article-aside__option-meta">
              <t-tag size="small" variant="light" :theme="platformTheme(a.platform)">
                {{ a.platform }}
              </t-tag>
              <t-tag size="small" variant="outline" :theme="statusTheme(a.status)">
                {{ statusLabel(a.status) }}
              </t-tag>
              <span v-if="a.words" class="article-aside__option-words">{{ a.words }} 字</span>
            </div>
          </div>
        </t-option>
      </t-select>
      <t-radio-group v-model="mode" size="small" theme="button" variant="default-filled">
        <t-radio-button value="edit">编辑</t-radio-button>
        <t-radio-button value="preview">预览</t-radio-button>
      </t-radio-group>
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        title="在文件夹中显示"
        @click="handleReveal"
      >
        <template #icon>
          <folder-open-icon />
        </template>
      </t-button>
      <t-button theme="primary" variant="text" shape="square" title="刷新" @click="handleRefresh">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
      <t-button
        theme="primary"
        variant="text"
        shape="square"
        title="导出为 ZIP（含图片）"
        :disabled="!activeArticle || exporting"
        @click="handleExport"
      >
        <template #icon>
          <download-icon />
        </template>
      </t-button>
    </div>
    <div class="article-aside__body">
      <article-editor
        v-if="activeArticle"
        :key="activeId"
        :content="content"
        :mode="mode"
        :base-dir="activeMdDir"
        :assets-dir="assetsDir"
        @change="handleContentChange"
      />
      <div v-else class="article-aside__empty">从上方选择文章，或让 AI 生成文章后在此选择</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { debounce } from 'es-toolkit'
import { DownloadIcon, FolderOpenIcon, RefreshIcon } from 'tdesign-icons-vue-next'
import {
  buildArticleRoot,
  destroyArticleStore,
  getArticleStore
} from '@/modules/tool/components/article/articleStore'
import { exportArticleZip } from '@/modules/tool/components/article/imageRef'
import type {
  ArticlePlatform,
  ArticleStatus
} from '@/modules/tool/components/article/articleTypes'
import { MessageUtil } from '@/utils/modal'
import ArticleEditor from './components/ArticleEditor.vue'

const props = defineProps<{
  sandbox?: string
  workspace?: string
}>()

/** 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/ */
const root = computed(() => buildArticleRoot(props.workspace ?? '', props.sandbox ?? ''))
const store = computed(() => getArticleStore(root.value))

const articles = computed(() => store.value.project.value?.articles ?? [])
const mode = ref<'edit' | 'preview'>('preview')

const activeId = ref('')
const activeArticle = computed(() => articles.value.find((a) => a.id === activeId.value))
const content = ref('')
const exporting = ref(false)

/** 当前文章 md 所在目录（预览图片解析基准） */
const activeMdDir = computed(() =>
  activeArticle.value ? window.preload.path.dirname(window.preload.path.join(root.value, activeArticle.value.file)) : ''
)

/** 配图目录（粘贴 / 拖入图片落盘于此） */
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

/** 刷新项目索引；若当前选中文章已被删除则复位选中 */
const reload = async () => {
  await store.value.refresh()
  if (activeId.value && !articles.value.some((a) => a.id === activeId.value)) {
    activeId.value = ''
    content.value = ''
  }
}

onMounted(() => {
  void reload()
})

// 工作空间切换（用户更换目录）→ 释放旧 store，重载新项目
watch(root, (val, old) => {
  if (old) destroyArticleStore(old)
  activeId.value = ''
  content.value = ''
  void reload()
})

const handleSelect = async (id: string) => {
  if (activeId.value === id) return
  try {
    content.value = await store.value.readArticle(id)
    activeId.value = id
  } catch {
    // 读取失败不切换
  }
}

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

const handleRefresh = () => {
  void reload()
}

/** 导出当前文章（含引用的本地图片）为 zip 压缩包 */
const handleExport = async () => {
  if (!activeArticle.value || exporting.value) return
  const article = activeArticle.value
  let zipPath = window.preload.inject.dialog.save({
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
</script>
<style scoped lang="less">
.article-aside {
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
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    overflow: hidden;
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

  &__option-words {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
<style lang="less">
/* 自定义 select 下拉选项面板（teleport 到 body，需全局样式；类名见 popup-props.overlayClassName） */
.article-select-overlay {
  .t-select-option {
    height: 100%;
    padding: 8px;
  }
}
</style>
