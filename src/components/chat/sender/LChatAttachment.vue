<template>
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
      </t-dropdown-item>
      <t-dropdown-item>
        <template #prefix-icon> <ai-education-icon /> </template>
        Agent
      </t-dropdown-item>
      <t-dropdown-item>
        <template #prefix-icon>
          <file-add-icon />
        </template>
        文件
      </t-dropdown-item>
    </t-dropdown-menu>
  </t-dropdown>
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

const show = ref(false)
</script>
<style scoped lang="less"></style>
