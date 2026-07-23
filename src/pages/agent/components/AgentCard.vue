<template>
  <t-card size="small" hover-shadow class="agent-card" @click="emit('preview')">
    <div class="agent-card__head">
      <t-avatar size="44px" shape="round">{{ avatarText }}</t-avatar>
      <div class="agent-card__title">
        <div class="agent-card__name" :title="agent.name">{{ agent.name }}</div>
        <div class="agent-card__model" :title="modelLabel">{{ modelLabel || '默认模型' }}</div>
      </div>
      <t-space size="small" class="agent-card__actions" @click.stop>
        <t-button
          theme="primary"
          variant="text"
          shape="square"
          size="small"
          @click.stop="emit('edit')"
        >
          <template #icon><EditIcon /></template>
        </t-button>
        <t-popconfirm
          content="确定删除该专家？会删除全部相关聊天记录，数据不可恢复"
          @confirm="emit('delete')"
        >
          <t-button @click.stop theme="danger" variant="text" shape="square" size="small">
            <template #icon><DeleteIcon /></template>
          </t-button>
        </t-popconfirm>
      </t-space>
    </div>
    <div class="agent-card__desc" :title="agent.description">
      {{ agent.description || '暂无描述' }}
    </div>
    <div class="agent-card__tags">
      <t-tag v-if="agent.think" size="small" theme="warning" variant="light">深度思考</t-tag>
      <t-tag v-for="tool in toolLabels" :key="tool" size="small" variant="outline">
        {{ tool }}
      </t-tag>
    </div>
  </t-card>
</template>

<script lang="ts" setup>
import { BrowseIcon, EditIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import { AiAgent } from '@/entity/ai'
import { toolMap } from '@/modules/tool'
import { useSettingAiStore } from '@/store'

const props = defineProps<{
  agent: AiAgent
}>()

const emit = defineEmits<{
  preview: []
  edit: []
  delete: []
}>()

const settingAiStore = useSettingAiStore()

const avatarText = computed(() => props.agent.name.trim().slice(0, 1) || 'A')

const modelLabel = computed(() => {
  const groups = settingAiStore.options
  for (const group of groups) {
    const hit = group.children?.find((item) => item.value === props.agent.model)
    if (hit) return hit.label
  }
  return props.agent.model
})

const toolLabels = computed(() => {
  return props.agent.tools
    .map((name) => toolMap[name]?.label)
    .filter((label): label is string => Boolean(label))
    .slice(0, 3)
})
</script>

<style scoped lang="less">
.agent-card {
  user-select: none;
  height: 100%;
  cursor: pointer;

  :deep(.t-card__body) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  &__title {
    min-width: 0;
    flex: 1;
  }

  &__name {
    overflow: hidden;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__model {
    margin-top: 2px;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__actions {
    flex-shrink: 0;
    opacity: 0;
    transition: opacity var(--fluent-transition-fast);
  }

  &:hover &__actions {
    opacity: 1;
  }

  &__desc {
    display: -webkit-box;
    min-height: 40px;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-height: 24px;
  }
}
</style>
