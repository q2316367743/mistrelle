<template>
  <div class="mcp-page">
    <div class="mcp-page__toolbar">
      <t-button theme="primary" @click="handleAdd">
        <template #icon><AddIcon /></template>
        添加 MCP 服务器
      </t-button>
    </div>

    <t-empty v-if="store.state.length === 0" description="暂无 MCP 服务器，点击上方按钮添加" />

    <div v-else class="mcp-page__grid">
      <t-card
        v-for="tool in store.state"
        :key="tool.name"
        size="small"
        hover-shadow
        class="mcp-card"
        @click="handleClick(tool.name)"
      >
        <div class="mcp-card__header">
          <span class="mcp-card__name">{{ tool.name }}</span>
          <t-switch
            :value="tool.enabled"
            size="small"
            @click.stop
            @change="(val: unknown) => handleToggle(tool.name, Boolean(val))"
          />
        </div>
        <div class="mcp-card__meta">
          <t-tag size="small" variant="light">{{ tool.type === 'local' ? 'stdio' : 'HTTP' }}</t-tag>
          <t-tag size="small" :theme="statusOf(tool.name).theme" variant="light">
            {{ statusOf(tool.name).label }}
          </t-tag>
          <span v-if="toolCount(tool.name) > 0" class="mcp-card__count">
            {{ toolCount(tool.name) }} 个工具
          </span>
        </div>
        <div class="mcp-card__desc">
          {{ tool.type === 'local' ? tool.command.join(' ') : tool.url }}
        </div>
      </t-card>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AddIcon } from 'tdesign-icons-vue-next'
import { useAiToolStore } from '@/store'
import type { McpStatus } from '@/store'
import { openMcpServerDialog } from './modals/McpServerDialog'
import { openMcpDetailDrawer } from './modals/McpDetailDrawer'

const store = useAiToolStore()

const statusMap: Record<McpStatus, { label: string; theme: 'default' | 'primary' | 'success' | 'danger' }> = {
  disconnected: { label: '未连接', theme: 'default' },
  connecting: { label: '连接中', theme: 'primary' },
  connected: { label: '已连接', theme: 'success' },
  error: { label: '失败', theme: 'danger' }
}

const statusOf = (name: string) => {
  const status = store.connections[name]?.status ?? 'disconnected'
  return statusMap[status]
}

const toolCount = (name: string) => store.connections[name]?.tools.length ?? 0

const handleAdd = () => openMcpServerDialog(() => {})

const handleClick = (name: string) => openMcpDetailDrawer(name)

const handleToggle = async (name: string, enabled: boolean) => {
  await store.toggle(name, enabled)
}

// 首次进入时自动连接已启用的服务器
onMounted(() => {
  if (Object.keys(store.connections).length === 0 && store.state.some((t) => t.enabled)) {
    store.initConnections()
  }
})
</script>

<style scoped lang="less">
.mcp-page__toolbar {
  margin-bottom: 16px;
}

.mcp-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.mcp-card {
  cursor: pointer;

  :deep(.t-card__body) {
    padding: 16px;
  }
}

.mcp-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.mcp-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  line-height: 1.5;
}

.mcp-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.mcp-card__count {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.mcp-card__desc {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.6;
  font-family: var(--td-font-family-mono, monospace);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
