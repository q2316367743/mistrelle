<template>
  <div class="novel-aside">
    <novel-header
      v-if="activeNovel"
      :novel="activeNovel"
      :novels="novels"
      :active-id="activeId"
      :assets-dir="assetsDir"
      @select="handleSelectChange($event, applySelect)"
      @cover="handleCover"
      @reveal="handleReveal"
      @refresh="handleRefresh"
    />
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
        <novel-actions
          :humanizing="humanizing"
          :words="liveWords"
          @humanize="handleHumanize"
          @abort="handleAbortHumanize"
          @copy="handleCopy"
          @reveal="handleReveal"
        />
      </template>
      <div v-else class="novel-aside__empty">
        <div class="novel-aside__empty-card">
          <div class="novel-aside__empty-title">开始短篇小说创作</div>
          <p>在左侧聊天说明题材与核心冲突，AI 创建小说后会自动出现在这里。</p>
          <p>
            创作流程：AI 建角色与设定 → 写正文（可分章续写）→ 在此直接编辑润色 → 去 AI 味。
            每部小说含正文 / 角色 / 大纲 / 设定 / 文风五个文件。
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { copyText } from '@/utils/native'
import { MessageUtil } from '@/utils/modal'
import { useNovelDoc } from './useNovelDoc'
import { useNovelAssist } from './useNovelAssist'
import NovelHeader from './components/NovelHeader.vue'
import NovelEditor from './components/NovelEditor.vue'
import NovelActions from './components/NovelActions.vue'
import NovelSettingTabs from './components/NovelSettingTabs.vue'
import NovelSettingTree from './components/NovelSettingTree.vue'

const props = defineProps<{
  sandbox?: string
  workspace?: string
  /** 侧边栏全屏：非全屏 tabs 预览；全屏「左设定树 + 右编辑器」 */
  fullscreen?: boolean
}>()

const {
  root,
  store,
  novels,
  activeId,
  activeNovel,
  activeFile,
  contents,
  reload,
  flushPendingSave,
  handleSelectChange,
  handleFileChange,
  handleContentChange
} = useNovelDoc(props)

/** 当前小说资源目录（封面 / 插图落盘处） */
const assetsDir = computed(() =>
  activeNovel.value ? store.value.buildAssetsDir(activeNovel.value.id) : ''
)

/** 编辑器内容即时字数（去空白） */
const liveWords = computed(() => (contents.value[activeFile.value] ?? '').replace(/\s+/g, '').length)

/** 去 AI 味编排（流式改写当前文件） */
const { humanizing, handleHumanize, handleAbortHumanize } = useNovelAssist({
  store,
  activeNovelId: activeId,
  activeFile,
  content: computed({
    get: () => contents.value[activeFile.value] ?? '',
    set: (v) => {
      contents.value[activeFile.value] = v
    }
  }),
  flushSave: flushPendingSave
})

const applySelect = (id: unknown): void => {
  activeId.value = typeof id === 'string' && id ? id : ''
}

/** 设置 / 清除封面（rel 相对 novels/ 根；undefined = 清除） */
const handleCover = async (rel: string | undefined): Promise<void> => {
  const novel = activeNovel.value
  if (!novel) return
  try {
    await store.value.updateNovel(novel.id, { cover: rel })
  } catch (e) {
    MessageUtil.error('封面设置失败', e)
  }
}

const handleReveal = (): void => {
  const novel = activeNovel.value
  if (novel) {
    window.preload.inject.shell.showItemInFolder(window.preload.path.join(root.value, novel.dir))
  } else {
    window.preload.inject.shell.openPath(root.value)
  }
}

const handleCopy = async (): Promise<void> => {
  const text = contents.value[activeFile.value] ?? ''
  if (!text.trim()) {
    MessageUtil.warning('当前文件为空')
    return
  }
  await copyText(text)
  MessageUtil.success('已复制到剪贴板')
}

const handleRefresh = (): void => {
  void reload()
}
</script>
<style scoped lang="less">
.novel-aside {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 8px 0 8px 8px;

  &__body {
    margin-top: 8px;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    &--split {
      flex-direction: row;
      gap: 8px;
    }
  }

  &__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  &__empty-card {
    max-width: 320px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    line-height: 1.7;

    p {
      margin: 8px 0 0;
    }
  }

  &__empty-title {
    font-size: var(--td-font-size-title-small);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }
}
</style>
