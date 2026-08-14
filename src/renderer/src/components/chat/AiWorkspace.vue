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
    <div class="ai-workspace__text active">{{ workspace ? renderBasename(workspace) : '' }}</div>
  </div>
  <t-dropdown v-else trigger="click" min-column-width="180px" placement="top" @click="handleClick">
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
    <t-dropdown-menu>
      <t-dropdown-item v-if="active" value="clearWorkspace">
        <template #prefix-icon>
          <close-icon />
        </template>
        清除工作目录
      </t-dropdown-item>
      <t-dropdown-item v-if="active" value="clearAndSelect">
        <template #prefix-icon>
          <folder-add1-icon />
        </template>
        清空并替换目录
      </t-dropdown-item>
      <t-dropdown-item v-else value="selectWorkspace">
        <template #prefix-icon>
          <folder-add1-icon />
        </template>
        选择目录
      </t-dropdown-item>
      <t-dropdown-item value="history">
        <template #prefix-icon>
          <history-icon />
        </template>
        最近使用的目录
        <t-dropdown-menu v-if="history && history.length > 0">
          <t-dropdown-item v-for="item in history" :key="item" :title="item" :value="item">
            {{ renderBasename(item) }}
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown-item>
    </t-dropdown-menu>
  </t-dropdown>
</template>
<script lang="ts" setup>
import { CloseIcon, FolderAdd1Icon, FolderFilledIcon, HistoryIcon } from 'tdesign-icons-vue-next'
import type { DropdownOption } from 'tdesign-vue-next'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { debounce } from 'es-toolkit'

const workspace = defineModel({
  type: String,
  required: true
})

/** 只读展示：会话创建后工作空间锁定，仅显示当前目录，不可再修改 */
const props = defineProps<{ readonly?: boolean }>()

const history = useUtoolsDbAsync(LocalNameEnum.KEY_AI_WORKSPACE, new Array<string>())

const active = computed(() => !!workspace.value)

const clearWorkspace = () => {
  workspace.value = ''
}
const selectWorkspace = async () => {
  const paths = await window.preload.inject.dialog.open({ properties: ['openDirectory'] })
  if (!paths || paths.length === 0) return
  workspace.value = paths[0]
  if (paths[0] && !history.value.includes(paths[0])) {
    history.value.push(paths[0])
  }
}
const clearAndSelect = () => {
  clearWorkspace()
  selectWorkspace()
}
const handleHistory = (path: string) => {
  workspace.value = path
}

const handleClickDebounced = debounce((val: string) => {
  switch (val) {
    case 'clearWorkspace':
      clearWorkspace()
      break
    case 'selectWorkspace':
      selectWorkspace()
      break
    case 'clearAndSelect':
      clearAndSelect()
      break
    default:
      handleHistory(val)
  }
}, 300)

const handleClick = ({ value }: DropdownOption) => {
  handleClickDebounced(String(value))
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
</style>
