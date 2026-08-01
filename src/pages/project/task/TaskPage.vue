<template>
  <div class="task-page">
    <div class="task-page__header">
      <t-input
        v-model="keyword"
        placeholder="搜索任务标题"
        clearable
        class="task-page__search"
      >
        <template #prefix-icon><SearchIcon /></template>
      </t-input>
    </div>

    <div class="task-page__list">
      <div
        v-for="item in filteredList"
        :key="item.id"
        class="task-item"
        @click="goChat(item.id)"
      >
        <div class="task-item__icon">
          <AddCircleIcon size="20px" />
        </div>
        <div class="task-item__body">
          <span class="task-item__title">{{ item.name }}</span>
          <span class="task-item__dot" />
          <t-tag v-if="parseProvide(item.previewModel)" size="small" variant="light">
            {{ parseProvide(item.previewModel) }}
          </t-tag>
        </div>
        <span class="task-item__time">{{ prettyDate(item.updatedAt) }}</span>
        <t-dropdown :popup-props="{ trigger: 'click' }" @click.stop>
          <t-button theme="default" variant="text" shape="square" size="small" @click.stop>
            <template #icon><MoreIcon /></template>
          </t-button>
          <t-dropdown-menu>
            <t-dropdown-item @click="handleRename(item)">重命名</t-dropdown-item>
            <t-dropdown-item theme="error" @click="handleRemove(item)">删除</t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown>
      </div>

      <t-empty v-if="filteredList.length === 0" title="暂无任务" description="在下方输入框发送消息即可创建" />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { AddCircleIcon, MoreIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { ProjectChat } from '@/entity/project'
import { projectTaskList, projectTaskIndexSave, buildProjectTaskContentPath } from '@/modules/project'
import { destroyChatSession } from '@/modules/chat'
import { prettyDate } from '@/utils/lang/FormatUtil'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'

const props = defineProps<{ id: string }>()
const router = useRouter()

const list = ref<ProjectChat[]>([])
const keyword = ref('')

const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter((e) => e.name.toLowerCase().includes(kw))
})

const parseProvide = (previewModel?: string): string => {
  if (!previewModel) return ''
  return previewModel.split(':')[0] || ''
}

const goChat = (taskId: string) => {
  router.push(`/project/${props.id}/chat/${taskId}`)
}

const handleRename = async (item: ProjectChat) => {
  try {
    const newName = await MessageBoxUtil.prompt('请输入任务名称', '重命名', { inputValue: item.name })
    const trimmed = newName.trim()
    if (!trimmed || trimmed === item.name) return
    const idx = list.value.findIndex((e) => e.id === item.id)
    if (idx >= 0) {
      list.value[idx] = { ...list.value[idx], name: trimmed, updatedAt: Date.now() }
      await projectTaskIndexSave(props.id, list.value)
    }
  } catch {
    // 用户取消
  }
}

const handleRemove = async (item: ProjectChat) => {
  try {
    await MessageBoxUtil.confirm(`确定删除任务「${item.name}」？`, '删除任务')
    list.value = list.value.filter((e) => e.id !== item.id)
    await projectTaskIndexSave(props.id, list.value)
    // 销毁内存会话，避免后台请求与常驻持久化残留
    destroyChatSession(buildProjectTaskContentPath(props.id, item.id))
    MessageUtil.success('已删除')
  } catch {
    // 用户取消
  }
}

const refresh = async () => {
  list.value = await projectTaskList(props.id)
  // 按更新时间倒序
  list.value.sort((a, b) => b.updatedAt - a.updatedAt)
}

watch(() => props.id, refresh, { immediate: true })
</script>
<style scoped lang="less">
.task-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.task-page__header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.task-page__search {
  width: 220px;
}

.task-page__list {
  flex: 1;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background-color var(--fluent-transition-fast);

  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }
}

.task-item__icon {
  display: flex;
  align-items: center;
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
}

.task-item__body {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.task-item__title {
  font: var(--td-font-body-medium);
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--td-success-color);
  flex-shrink: 0;
}

.task-item__time {
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
