<template>
  <t-dropdown trigger="click" min-column-width="180px" @click="handleClick">
    <div class="ai-workspace">
      <div :class="['ai-workspace__icon', { active: active }]">
        <folder-filled-icon v-if="workspace" />
        <folder-add1-icon v-else size="14px" />
      </div>
      <div :class="['ai-workspace__text', { active: active }]">
        {{ workspace || '选择工作目录' }}
      </div>
    </div>
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
            {{ item.split(win ? '\\' : '/').pop() }}
          </t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown-item>
    </t-dropdown-menu>
  </t-dropdown>
</template>
<script lang="ts" setup>
import { CloseIcon, FolderAdd1Icon, FolderFilledIcon, HistoryIcon } from 'tdesign-icons-vue-next'
import { useUtoolsDbAsync } from '@/hooks'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { debounce } from 'es-toolkit'

const workspace = defineModel({
  type: String,
  required: true
})

const history = useUtoolsDbAsync(LocalNameEnum.KEY_AI_WORKSPACE, new Array<string>())

const active = computed(() => !!workspace.value)
const win = window.preload.inject.os.isWindows()

const clearWorkspace = () => {
  workspace.value = ''
}
const selectWorkspace = () => {
  const paths = window.preload.inject.dialog.open({ properties: ['openDirectory'] })
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

const handleClick = ({ value }: any) => {
  handleClickDebounced(value)
}
</script>
<style scoped lang="less">
.ai-workspace {
  margin-left: 8px;
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: var(--td-font-size-body-medium);
  &__icon,
  &__text {
    &.active {
      color: var(--td-brand-color);
    }
  }
  &__text {
    margin-left: 8px;
    padding-top: 4px;
  }
}
</style>
