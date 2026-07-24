<template>
  <div class="group-members">
    <t-input v-model="keyword" placeholder="搜索群成员" clearable class="group-members__search">
      <template #prefix-icon><search-icon /></template>
    </t-input>

    <div class="group-members__section-title">
      群成员 <span class="group-members__count">{{ sortedRoles.length }}</span>
    </div>
    <div class="group-members__grid">
      <div v-for="(role, index) in displayRoles" :key="role.id" class="group-members__cell">
        <t-avatar
          size="48px"
          :style="{ background: avatarColor(index), color: 'var(--td-text-color-anti)' }"
          >{{ (role.name || '?').charAt(0) }}</t-avatar
        >
        <span class="group-members__name">{{ role.name || '未命名成员' }}</span>
      </div>

      <div
        v-if="showViewMore"
        class="group-members__cell group-members__cell--action"
        @click="expanded = true"
      >
        <div class="group-members__add-icon"><chevron-down-icon /></div>
        <span class="group-members__name">查看更多</span>
      </div>
      <div
        v-if="showAddCell"
        class="group-members__cell group-members__cell--action"
        @click="addRole"
      >
        <div class="group-members__add-icon"><add-icon /></div>
        <span class="group-members__name">添加成员</span>
      </div>
    </div>

    <div class="group-members__section-title">讨论设置</div>
    <div class="group-members__form">
      <div class="group-members__field">
        <label>讨论组名称</label>
        <t-input
          :value="discussion?.name"
          placeholder="请输入讨论组名称"
          @change="(v) => update('name', v)"
        />
      </div>
      <div class="group-members__field">
        <label>讨论组描述</label>
        <t-textarea
          :value="discussion?.description"
          placeholder="请输入讨论组描述"
          autosize
          @change="(v) => update('description', v)"
        />
      </div>
      <div class="group-members__field">
        <label>讨论模式</label>
        <t-select
          :value="discussion?.mode"
          :options="AiDiscussionModeOptions"
          @change="(v) => update('mode', v)"
        />
      </div>
      <div v-if="discussion?.mode === 'rounds_limit'" class="group-members__field">
        <label>最大轮数</label>
        <t-input
          :value="discussion?.maxRounds"
          type="number"
          @change="(v) => update('maxRounds', Number(v))"
        />
      </div>
      <div class="group-members__field">
        <label>发言顺序</label>
        <t-select
          :value="discussion?.orderType"
          :options="AiDiscussionOrderTypeOptions"
          @change="(v) => update('orderType', v)"
        />
      </div>
      <div class="group-members__field">
        <label>总结触发</label>
        <t-select
          :value="discussion?.summaryTrigger"
          :options="AiDiscussionSummaryTriggerOptions"
          @change="(v) => update('summaryTrigger', v)"
        />
      </div>
    </div>

    <div class="group-members__section-title">总结者角色</div>
    <div class="group-members__summary">
      <t-select
        :value="discussion.summaryRole"
        :options="summaryRoleOptions"
        @change="selectSummaryRole"
        clearable
        filterable
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { throttle } from 'es-toolkit'
import { SearchIcon, AddIcon, ChevronDownIcon } from 'tdesign-icons-vue-next'
import {
  AiDiscussion,
  AiDiscussionModeOptions,
  AiDiscussionOrderTypeOptions,
  AiDiscussionSummaryTriggerOptions
} from '@/entity/ai'
import { useAiAgentStore, useAiDiscussionStore } from '@/store'

const props = defineProps<{
  discussion: AiDiscussion
}>()

const keyword = ref('')
const expanded = ref(false)

// 全部的成员
const sortedRoles = computed(() => {
  // 全部的 agent
  return useAiAgentStore().state.filter((e) => props.discussion.roles.includes(e.id))
})
const summaryRoleOptions = computed(() => useAiAgentStore().options)

const searching = computed(() => keyword.value.trim().length > 0)

const displayRoles = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const base = kw
    ? sortedRoles.value.filter((r) => (r.name || '').toLowerCase().includes(kw))
    : sortedRoles.value
  if (searching.value) return base
  return expanded.value ? base : base.slice(0, 15)
})

/** 超过 15 个成员且未展开时，第 16 格显示「查看更多」 */
const showViewMore = computed(
  () => !searching.value && !expanded.value && sortedRoles.value.length > 15
)
/** 未展开且成员 ≤ 15 时，第 16 格显示「添加成员」；展开后添加按钮放到最后 */
const showAddCell = computed(
  () => !searching.value && (expanded.value || sortedRoles.value.length <= 15)
)

const avatarPalette = [
  'var(--td-brand-color)',
  'var(--td-success-color)',
  'var(--td-warning-color)',
  'var(--td-error-color)',
  'var(--td-brand-color-hover)',
  'var(--td-success-color-hover)',
  'var(--td-warning-color-hover)',
  'var(--td-error-color-hover)'
]
const avatarColor = (index: number) =>
  avatarPalette[((index % avatarPalette.length) + avatarPalette.length) % avatarPalette.length]

const saveDiscussion = throttle(
  () => {
    if (props.discussion) useAiDiscussionStore().put(props.discussion, props.discussion.id)
  },
  300,
  { edges: ['trailing'] }
)

const update = (field: keyof AiDiscussion, value: unknown) => {
  if (!props.discussion) return
  ;(props.discussion as unknown as Record<string, unknown>)[field] = value
  saveDiscussion()
}

const addRole = () => {
  if (!props.discussion) return
  // TODO: 选择成员
}

const selectSummaryRole = (val: any) => {
  if (!props.discussion) return
  props.discussion.summaryRole = val
  saveDiscussion()
}

</script>

<style scoped lang="less">
.group-members {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-m);
  overflow-y: auto;
  height: calc(100% - var(--td-comp-paddingTB-l) - var(--td-comp-paddingTB-l));
  padding: var(--td-comp-paddingTB-l) var(--td-comp-paddingLR-l);
}

.group-members__search {
  flex: 0 0 auto;
}

.group-members__section-title {
  color: var(--td-text-color-primary);
  font: var(--td-font-title-small);
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.group-members__count {
  color: var(--td-text-color-placeholder);
  font: var(--td-font-body-small);
}

.group-members__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--td-comp-margin-m);
  flex: 0 0 auto;
}

.group-members__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border-radius: var(--td-radius-default);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }

  &.group-members__cell--action {
    justify-content: center;
  }
}

.group-members__name {
  color: var(--td-text-color-primary);
  font: var(--td-font-body-small);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-members__cell .group-members__name {
  max-width: 48px;
}

.group-members__add-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px dashed var(--td-component-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--td-text-color-placeholder);
  font-size: 20px;
}

.group-members__form {
  display: flex;
  flex-direction: column;
  gap: var(--td-comp-margin-s);
  flex: 0 0 auto;
}

.group-members__field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  > label {
    color: var(--td-text-color-secondary);
    font: var(--td-font-body-small);
  }
}

.group-members__summary {
  flex: 0 0 auto;
}

.group-members__summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-default);
  cursor: pointer;

  .group-members__name {
    flex: 1;
  }
}
</style>
