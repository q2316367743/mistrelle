<template>
  <div
    v-if="readonly"
    class="ai-workspace ai-workspace--readonly"
    :title="workspace"
    role="button"
    @click="openWorkspace"
  >
    <div class="ai-workspace__icon active">
      <folder-filled-icon />
    </div>
  </div>
  <t-popup v-else v-model="visible" trigger="click" placement="top">
    <t-button theme="default" variant="text" class="ai-workspace">
      <template #icon>
        <div :class="['ai-workspace__icon', { active: active }]">
          <folder-filled-icon v-if="workspace" />
          <folder-add1-icon v-else size="14px" />
        </div>
      </template>
      <div :class="['ai-workspace__text', { active: active }]">
        {{ workspace ? renderBasename(workspace) : '选择工作目录' }}
      </div>
    </t-button>
    <template #content>
      <div class="ai-workspace-panel">
        <t-input v-model="keyword" size="small" clearable placeholder="搜索最近目录">
          <template #prefix-icon>
            <search-icon />
          </template>
        </t-input>
        <div class="ai-workspace-list">
          <div
            v-for="item in filteredHistory"
            :key="item"
            :title="item"
            :class="['ai-workspace-item', { active: workspace === item }]"
            @click="handleHistory(item)"
          >
            {{ renderBasename(item) }}
          </div>
          <div v-if="filteredHistory.length === 0" class="ai-workspace-empty">
            {{ history.length === 0 ? '暂无最近目录' : '无匹配目录' }}
          </div>
        </div>
        <template v-if="active">
          <div class="ai-workspace-action" @click="clearWorkspace">
            <close-icon size="14px" />
            <span class="ml-8px">清除工作目录</span>
          </div>
          <div class="ai-workspace-action" @click="clearAndSelect">
            <folder-add1-icon size="14px" />
            <span class="ml-8px">清空并替换目录</span>
          </div>
        </template>
        <div v-else class="ai-workspace-action" @click="selectWorkspace">
          <folder-add1-icon size="14px" />
          <span class="ml-8px">选择目录</span>
        </div>
      </div>
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import Fuse from 'fuse.js'
import { CloseIcon, FolderAdd1Icon, FolderFilledIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { readJsonFile, writeJsonFile } from '@/utils/native'
import { getWorkspaceHistoryPath } from '@/global/Constant'

const workspace = defineModel({
  type: String,
  required: true
})

/** 只读展示：会话创建后工作空间锁定，仅显示当前目录，不可再修改 */
defineProps<{ readonly?: boolean }>()

const history = ref(new Array<string>())
readJsonFile<Array<string>>(getWorkspaceHistoryPath()).then((list) => {
  if (list) history.value = list
})

const active = computed(() => !!workspace.value)

const visible = ref(false)
const keyword = ref('')
watch(visible, (val) => {
  if (val) keyword.value = ''
})

const historyItems = computed(() =>
  history.value.map((path) => ({ path, basename: renderBasename(path) }))
)
const fuse = computed(
  () =>
    new Fuse(historyItems.value, {
      keys: ['basename', 'path'],
      ignoreLocation: true,
      threshold: 0.4
    })
)
/** 最近优先倒序展示；有关键词时走 fuse 模糊匹配 */
const filteredHistory = computed(() => {
  const query = keyword.value.trim()
  if (!query) return historyItems.value.map((item) => item.path).reverse()
  return fuse.value.search(query).map((res) => res.item.path)
})

const clearWorkspace = () => {
  workspace.value = ''
  visible.value = false
}
const selectWorkspace = async () => {
  visible.value = false
  const paths = await window.preload.inject.dialog.open({ properties: ['openDirectory'] })
  if (!paths || paths.length === 0) return
  workspace.value = paths[0]
  if (paths[0] && !history.value.includes(paths[0])) {
    history.value.push(paths[0])
    await writeJsonFile(getWorkspaceHistoryPath(), history.value)
  }
}
const clearAndSelect = () => {
  clearWorkspace()
  selectWorkspace()
}
const handleHistory = (path: string) => {
  workspace.value = path
  visible.value = false
}

const openWorkspace = () => {
  if (workspace.value) {
    window.preload.inject.shell.openPath(workspace.value)
  }
}

const renderBasename = (path: string) => window.preload.path.basename(path)
</script>
<style scoped lang="less">
.ai-workspace {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: var(--td-font-size-body-medium);
  &--readonly {
    cursor: pointer;
    padding: 4px 8px;
    user-select: none;
    border-radius: var(--td-radius-medium);
    transition: background-color 0.3s ease-in-out;
    .ai-workspace__icon,
    .ai-workspace__text {
      transition: none;
    }

    &:hover {
      background-color: var(--td-bg-color-container-hover);
    }
  }
  &__icon,
  &__text {
    &.active {
      color: var(--td-brand-color);
    }
  }
  &__text {
    margin-left: 8px;
    padding-top: 2px;
  }
}

.ai-workspace-panel {
  width: 240px;
  padding: var(--td-pop-padding-m);
}
.ai-workspace-list {
  max-height: 200px;
  margin: 8px 0;
  padding-bottom: 4px;
  overflow: auto;
  border-bottom: 1px solid var(--td-border-level-1-color);
}
.ai-workspace-item {
  display: flex;
  align-items: center;
  border-radius: var(--td-radius-default);
  height: var(--td-comp-size-s);
  font: var(--td-font-body-medium);
  cursor: pointer;
  padding: 0 var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background-color 0.2s cubic-bezier(0.38, 0, 0.24, 1);
  box-sizing: border-box;
  margin-top: var(--td-comp-paddingTB-xxs);

  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }
  &:active {
    background-color: var(--td-brand-color-light-hover);
  }
  &.active {
    background-color: var(--td-brand-color-light-hover);
    color: var(--td-brand-color);
    font-weight: bold;
  }
}
.ai-workspace-empty {
  padding: 8px var(--td-comp-paddingLR-s);
  font: var(--td-font-body-medium);
  color: var(--td-text-color-placeholder);
  text-align: center;
}
.ai-workspace-action {
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: var(--td-radius-medium);
  font: var(--td-font-body-medium);
  color: var(--td-text-color-primary);
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;
  &:hover {
    background-color: var(--td-bg-color-component-hover);
  }
}
</style>
