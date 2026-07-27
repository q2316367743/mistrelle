<template>
  <div class="project-side">
    <section class="project-side__section">
      <div class="project-side__section-header" @click="toggle('prompt')">
        <div>
          <EditIcon />
          <span class="project-side__section-title">指令</span>
        </div>
        <t-button theme="primary" variant="text" shape="square" size="small" @click.stop="openEdit">
          <template #icon><EditIcon /></template>
        </t-button>
      </div>
      <div v-if="expanded.prompt" class="project-side__section-body">
        <pre class="project-side__prompt">{{ project.prompt || '（未设置）' }}</pre>
      </div>
    </section>

    <section class="project-side__section">
      <div class="project-side__section-header" @click="toggle('agents')">
        <div>
          <AiEducationIcon />
          <span class="project-side__section-title">Agent {{ project.agents.length }} </span>
        </div>
        <t-button theme="primary" variant="text" shape="square" size="small" @click.stop="openEdit">
          <template #icon><AddIcon /></template>
        </t-button>
      </div>
      <div v-if="expanded.agents" class="project-side__section-body">
        <t-space size="small">
          <t-tag v-for="id in project.agents" :key="id" variant="outline">
            {{ agentLabel(id) }}
          </t-tag>
          <span v-if="project.agents.length === 0" class="project-side__empty">未指定</span>
        </t-space>
      </div>
    </section>

    <section class="project-side__section">
      <div class="project-side__section-header" @click="toggle('skills')">
        <div>
          <LightbulbIcon />
          <span class="project-side__section-title">技能 {{ project.skills.length }}</span>
        </div>
        <t-button theme="primary" variant="text" shape="square" size="small" @click.stop="openEdit">
          <template #icon><AddIcon /></template>
        </t-button>
      </div>
      <div v-if="expanded.skills" class="project-side__section-body">
        <t-space size="small">
          <t-tag v-for="key in project.skills" :key="key" variant="outline">
            {{ skillMap.get(key)?.name ?? key }}
          </t-tag>
          <span v-if="project.skills.length === 0" class="project-side__empty">未指定</span>
        </t-space>
      </div>
    </section>

    <section class="project-side__section">
      <div class="project-side__section-header" @click="toggle('tools')">
        <div>
          <ToolsIcon />
          <span class="project-side__section-title">工具 {{ project.tools.length }}</span>
        </div>
        <t-button theme="primary" variant="text" shape="square" size="small" @click.stop="openEdit">
          <template #icon><AddIcon /></template>
        </t-button>
      </div>
      <div v-if="expanded.tools" class="project-side__section-body">
        <t-space size="small">
          <t-tag v-for="name in project.tools" :key="name" variant="outline">
            {{ toolLabel(name) }}
          </t-tag>
          <span v-if="project.tools.length === 0" class="project-side__empty">未指定</span>
        </t-space>
      </div>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { reactive } from 'vue'
import {
  AddIcon,
  AiEducationIcon,
  EditIcon,
  LightbulbIcon,
  ToolsIcon
} from 'tdesign-icons-vue-next'
import { Project } from '@/entity'
import { useAgentToolLabels } from '../func'

const props = defineProps<{ project: Project }>()

const expanded = reactive({ prompt: true, agents: false, skills: false, tools: false })
const toggle = (k: keyof typeof expanded) => {
  expanded[k] = !expanded[k]
}

const { agentLabel, toolLabel, skillMap } = useAgentToolLabels()

const openEdit = () => {
  import('../../list/modals/ProjectPutDialog').then(({ openProjectPut }) =>
    openProjectPut(props.project.id)
  )
}
</script>

<style scoped lang="less">
.project-side {
  padding: 16px;
  width: 208px;
  min-width: 208px;
  overflow: hidden;

  &__header {
    margin-bottom: 12px;
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
  }

  &__section {
    padding: 12px 0;
    border-top: 1px solid var(--td-component-stroke);
    &:first-child {
      border: none;
    }
  }

  &__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
  }

  &__section-title {
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    margin-left: 8px;
  }

  &__section-body {
    margin-top: 10px;
    padding: 0 2px;
  }

  &__prompt {
    margin: 0;
    padding: 10px 12px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    background: var(--td-bg-color-component);
    border-radius: var(--td-radius-small);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow: auto;
  }

  &__empty {
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }
}
</style>
