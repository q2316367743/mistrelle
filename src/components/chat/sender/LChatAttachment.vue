<template>
  <div class="flex gap-8px">
    <t-dropdown v-model:visible="show" trigger="click" placement="top">
      <t-button shape="circle" variant="text">
        <template #icon>
          <add-icon
            :style="{ transform: show ? 'rotate(45deg)' : '', transition: 'all 200ms ease-in-out' }"
          />
        </template>
      </t-button>
      <t-dropdown-menu>
        <t-dropdown-item>
          <template #prefix-icon>
            <building2-icon />
          </template>
          技能
          <t-dropdown-menu v-if="skillList" :max-height="50">
            <t-dropdown-item v-for="item in skillList" :key="item.dirName">{{
              item.name
            }}</t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown-item>
        <t-dropdown-item>
          <template #prefix-icon>
            <ai-tool-icon />
          </template>
          能力
          <t-dropdown-menu v-if="toolOptions" :max-height="50">
            <t-dropdown-item v-for="toolOption in toolOptions" :key="toolOption.group">
              {{ toolOption.group }}
              <t-dropdown-menu v-if="toolOption.children && toolOption.children.length > 0">
                <t-dropdown-item v-for="tool in toolOption.children" :key="tool.value">
                  {{ tool.label }}
                </t-dropdown-item>
              </t-dropdown-menu>
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown-item>
        <t-dropdown-item>
          <template #prefix-icon> <ai-education-icon /> </template>
          Agent
          <t-dropdown-menu v-if="agents.length > 0" :max-height="50">
            <t-dropdown-item v-for="item in agents" :key="item.id">
              {{ item.name }}
            </t-dropdown-item>
          </t-dropdown-menu>
        </t-dropdown-item>
        <t-dropdown-item>
          <template #prefix-icon>
            <file-add-icon />
          </template>
          文件
        </t-dropdown-item>
      </t-dropdown-menu>
    </t-dropdown>
    <t-tag size="large" closable theme="primary" variant="light-outline">
      <template #icon> <ai-education-icon /> </template>
      Tag
    </t-tag>
  </div>
</template>
<script lang="ts" setup>
import {
  AddIcon,
  AiEducationIcon,
  AiToolIcon,
  Building2Icon,
  FileAddIcon
} from 'tdesign-icons-vue-next'
import { skillList } from '@/modules/skill'
import { toolOptions } from '@/modules/tool'
import { useAiAgentStore } from '@/store'

const props = defineProps({
  // 选择的 tools
  tools: {
    type: Array as PropType<Array<string>>,
    default: () => []
  },
  // 使用的 agent
  agent: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['update:tools', 'update:agent', 'addSkill', 'addFile'])

const show = ref(false)

const agents = computed(() => useAiAgentStore().state)
</script>
<style scoped lang="less"></style>
