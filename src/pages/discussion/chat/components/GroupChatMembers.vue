<template>
  <div class="group-members">
    <t-input v-model="keyword" placeholder="搜索群成员" clearable class="group-members__search">
      <template #prefix-icon><search-icon /></template>
    </t-input>

    <div class="group-members__section-title">
      群成员 <span class="group-members__count">{{ sortedRoles.length }}</span>
    </div>
    <div class="group-members__grid">
      <div
        v-for="role in displayRoles"
        :key="role.id"
        class="group-members__cell"
        @click="editRole(role)"
      >
        <t-avatar
          size="48px"
          :style="{ background: avatarColor(role.index), color: 'var(--td-text-color-anti)' }"
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
          :options="modeOptions"
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
          :options="orderOptions"
          @change="(v) => update('orderType', v)"
        />
      </div>
      <div class="group-members__field">
        <label>总结触发</label>
        <t-select
          :value="discussion?.summaryTrigger"
          :options="summaryTriggerOptions"
          @change="(v) => update('summaryTrigger', v)"
        />
      </div>
    </div>

    <div class="group-members__section-title">总结者角色</div>
    <div class="group-members__summary">
      <div
        v-if="discussion?.summaryRole"
        class="group-members__summary-item"
        @click="editSummaryRole"
      >
        <t-avatar
          size="36px"
          :style="{ background: 'var(--td-brand-color)', color: 'var(--td-text-color-anti)' }"
          >{{ (discussion.summaryRole.name || '?').charAt(0) }}</t-avatar
        >
        <span class="group-members__name">{{ discussion.summaryRole.name || '总结者' }}</span>
        <t-button theme="danger" variant="text" size="small" @click.stop="removeSummaryRole"
          >移除</t-button
        >
      </div>
      <t-button v-else variant="outline" block @click="addSummaryRole">
        <template #icon><add-icon /></template>
        添加总结者角色
      </t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { throttle } from 'es-toolkit'
import { SearchIcon, AddIcon, ChevronDownIcon } from 'tdesign-icons-vue-next'
import type { AiDiscussion, AiDiscussionRole } from '@/entity/ai'
import { useSnowflake } from '@/hooks'
import { useAiDiscussionStore } from '@/store'
import { openRoleEdit } from './GroupChatRoleDialog'

const props = defineProps<{
  discussion: AiDiscussion
}>()

const keyword = ref('')
const expanded = ref(false)

const sortedRoles = computed(() =>
  [...(props.discussion?.roles ?? [])].sort((a, b) => a.index - b.index)
)

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

const editRole = (role: AiDiscussionRole) =>
  openRoleEdit(props.discussion, role, { deletable: true })

const addRole = () => {
  if (!props.discussion) return
  const role: AiDiscussionRole = {
    id: useSnowflake().nextId(),
    name: '',
    description: '',
    prompt: '',
    model: '',
    index: props.discussion.roles.length,
    tools: []
  }
  props.discussion.roles.push(role)
  openRoleEdit(props.discussion, role, { deletable: true })
}

const addSummaryRole = () => {
  if (!props.discussion) return
  props.discussion.summaryRole = {
    id: useSnowflake().nextId(),
    name: '',
    description: '',
    prompt: '',
    model: '',
    index: -1,
    tools: []
  }
  openRoleEdit(props.discussion, props.discussion.summaryRole, { deletable: false })
}

const editSummaryRole = () => {
  if (props.discussion?.summaryRole)
    openRoleEdit(props.discussion, props.discussion.summaryRole, { deletable: false })
}

const removeSummaryRole = () => {
  if (!props.discussion) return
  props.discussion.summaryRole = undefined
  saveDiscussion()
}

const modeOptions = [
  { label: '自动推进', value: 'auto' },
  { label: '手动推进', value: 'manual' },
  { label: '限制轮数', value: 'rounds_limit' }
]
const orderOptions = [
  { label: '顺序发言', value: 'sequential' },
  { label: '随机发言', value: 'random' },
  { label: '并行发言', value: 'parallel' }
]
const summaryTriggerOptions = [
  { label: '每轮结束后', value: 'after_each_round' },
  { label: '所有轮结束后', value: 'after_all_rounds' },
  { label: '手动触发', value: 'manual' }
]
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
