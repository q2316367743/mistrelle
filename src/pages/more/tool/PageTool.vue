<template>
  <page-layout title="工具">
    <template #extra>
      <t-radio-group v-model="active" variant="primary-filled">
        <t-radio-button value="tool">内置工具</t-radio-button>
        <t-radio-button value="mcp">MCP 工具</t-radio-button>
      </t-radio-group>
    </template>
    <div class="p-16px pt-0">
      <tool-built-in-page v-if="active === 'tool'" />
      <tool-mcp-page v-else-if="active === 'mcp'" />
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import ToolBuiltInPage from '@/pages/more/tool/ToolBuiltIn/ToolBuiltInPage.vue'
import ToolMcpPage from '@/pages/more/tool/ToolMcp/ToolMcpPage.vue'

const active = ref('tool')
</script>
<style scoped lang="less"></style>
