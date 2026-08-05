<template>
  <div class="article-aside">
    <article-toolbar
      :project-title="projectTitle"
      :root-label="rootLabel"
      @create="handleCreate"
      @refresh="handleRefresh"
    />
    <div class="article-aside__body">
      <div class="article-aside__list">
        <article-list :articles="articles" :active-id="activeId" @select="handleSelect" />
      </div>
      <template v-if="activeArticle">
        <article-editor
          :content="content"
          :article-title="activeArticle.title"
          @change="handleContentChange"
        />
      </template>
      <div v-else class="article-aside__empty">从左侧选择文章，或点击 + 新建</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { debounce } from 'es-toolkit'
import {
  buildArticleRoot,
  destroyArticleStore,
  getArticleStore
} from '@/modules/tool/components/article/articleStore'
import ArticleToolbar from './components/ArticleToolbar.vue'
import ArticleList from './components/ArticleList.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import { openArticleModal } from './modals/ArticleModal'

const props = defineProps<{
  sandbox?: string
  workspace?: string
}>()

/** 项目根：{workspace}/articles/（有工作空间）或 {sandbox}/outputs/articles/ */
const root = computed(() => buildArticleRoot(props.workspace ?? '', props.sandbox ?? ''))
const store = computed(() => getArticleStore(root.value))

const articles = computed(() => store.value.project.value?.articles ?? [])
const projectTitle = computed(() => store.value.project.value?.title ?? '')
const rootLabel = computed(() => {
  const ws = props.workspace
  return ws ? window.preload.path.basename(ws) || ws : '沙盒'
})

const activeId = ref('')
const activeArticle = computed(() => articles.value.find((a) => a.id === activeId.value))
const content = ref('')

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

const handleCreate = () => {
  openArticleModal({
    workspace: props.workspace,
    sandbox: props.sandbox,
    onCreated: async (item) => {
      await reload()
      content.value = await store.value.readArticle(item.id)
      activeId.value = item.id
    }
  })
}

const handleRefresh = () => {
  void reload()
}
</script>
<style scoped lang="less">
.article-aside {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__body {
    margin-top: 8px;
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
  }

  &__list {
    width: 180px;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    padding: 4px;
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--td-text-color-placeholder);
    font-size: var(--td-font-size-body-small);
  }
}
</style>
