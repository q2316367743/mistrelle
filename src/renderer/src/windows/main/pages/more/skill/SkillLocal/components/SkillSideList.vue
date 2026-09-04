<template>
  <aside class="skill-side">
    <div class="skill-side__toolbar">
      <t-select
        v-model="activeAgent"
        :options="agentOptions"
        size="small"
        class="flex-1"
        clearable
        placeholder="全部 Agent"
      />
      <t-button variant="outline" shape="square" size="small" @click="emit('manage')">
        <template #icon>
          <setting-icon />
        </template>
      </t-button>
      <t-button variant="outline" shape="square" size="small" @click="emit('refresh')">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
      <t-button shape="square" size="small" @click="emit('create')">
        <template #icon>
          <add-icon />
        </template>
      </t-button>
    </div>
    <div class="skill-side__filters">
      <t-input
        v-model="keyword"
        placeholder="搜索 Skill"
        clearable
        size="small"
        class="skill-side__search"
      >
        <template #prefix-icon>
          <search-icon />
        </template>
      </t-input>
      <t-select
        v-model="enableFilter"
        :options="enableOptions"
        size="small"
        class="skill-side__enable-filter"
      />
    </div>
    <div class="skill-side__list">
      <t-loading :loading="loading" size="small">
        <div v-if="filteredList.length === 0" class="skill-side__empty">暂无 Skill</div>
        <div
          v-for="skill in filteredList"
          :key="skill.agentKey + '/' + skill.dirName"
          class="skill-item"
          :class="{
            active: selectedKey === skill.agentKey + '/' + skill.dirName,
            disabled: !skillStore.isSkillEnabled(skill)
          }"
          @click="emit('select', skill)"
        >
          <div class="skill-item__head">
            <div class="skill-item__name">{{ skill.name }}</div>
            <t-switch
              size="small"
              :value="skillStore.isSkillEnabled(skill)"
              @click.stop
              @change="(val) => skillStore.setSkillEnabled(skill, Boolean(val))"
            />
          </div>
          <div class="skill-item__meta">
            <t-tag size="small" variant="light">{{ skill.agentName }}</t-tag>
            <span class="skill-item__time">{{ prettyDate(skill.updatedAt) }}</span>
          </div>
        </div>
      </t-loading>
    </div>
  </aside>
</template>
<script lang="ts" setup>
import { AddIcon, RefreshIcon, SearchIcon, SettingIcon } from 'tdesign-icons-vue-next'
import { LocalSkill, SkillAgent } from '@/windows/main/modules/skill'
import { useSettingSkillStore } from '@/windows/main/store'
import { prettyDate } from '@/utils/lang/FormatUtil'

const props = defineProps<{
  list: Array<LocalSkill>
  agents: Array<SkillAgent>
  loading: boolean
  selectedKey: string
}>()

const emit = defineEmits<{
  select: [skill: LocalSkill]
  create: []
  refresh: []
  manage: []
}>()

const keyword = ref('')
const activeAgent = ref('')
const skillStore = useSettingSkillStore()

const enableFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const enableOptions = [
  { label: '全部', value: 'all' },
  { label: '已启用', value: 'enabled' },
  { label: '已禁用', value: 'disabled' }
]

const agentOptions = computed(() => [
  { label: '全部 Agent', value: '' },
  ...props.agents.map((e) => ({ label: e.name, value: e.key }))
])

const filteredList = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  return props.list.filter((e) => {
    if (activeAgent.value && e.agentKey !== activeAgent.value) return false
    if (enableFilter.value === 'enabled' && !skillStore.isSkillEnabled(e)) return false
    if (enableFilter.value === 'disabled' && skillStore.isSkillEnabled(e)) return false
    if (!k) return true
    return (
      e.name.toLowerCase().includes(k) ||
      e.dirName.toLowerCase().includes(k) ||
      e.description.toLowerCase().includes(k)
    )
  })
})
</script>
<style scoped lang="less">
.skill-side {
  display: flex;
  flex-direction: column;
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--td-component-border);
  overflow: hidden;

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px;
    flex-shrink: 0;
  }

  &__filters {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 8px 8px;
    flex-shrink: 0;
  }

  &__search {
    flex: 1;
    min-width: 0;
  }

  &__enable-filter {
    width: 92px;
    flex-shrink: 0;
  }

  &__list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  &__empty {
    padding: 24px 12px;
    text-align: center;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.skill-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--td-component-border);
  transition: background-color 0.15s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: var(--td-bg-color-container-hover);
  }

  &.active {
    background-color: var(--td-brand-color-light);
  }

  &.disabled .skill-item__name {
    color: var(--td-text-color-disabled);
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
  }

  &__time {
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
