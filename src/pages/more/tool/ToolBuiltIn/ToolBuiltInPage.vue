<template>
  <div class="tool-groups">
    <div v-for="group in toolOptions" :key="group.group" class="tool-group">
      <h3 class="group-title">{{ group.group }}</h3>
      <div class="tool-grid">
        <t-card
          v-for="tool in group.children"
          :key="tool.value"
          size="small"
          hover-shadow
          class="tool-card"
          @click="handleClick(tool.value)"
        >
          <div class="tool-card__name">{{ tool.label }}</div>
          <div class="tool-card__desc">{{ toolMap[tool.value]?.description || '暂无描述' }}</div>
        </t-card>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { toolOptions, toolMap } from '@/modules/tool'
import { openToolDetailDialog } from './modals/ToolDetailDialog'

const handleClick = (name: string) => {
  const tool = toolMap[name]
  if (!tool) return
  openToolDetailDialog(tool)
}
</script>

<style scoped lang="less">
.tool-groups {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.group-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin: 0 0 12px;
  line-height: 1.5;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.tool-card {
  cursor: pointer;

  :deep(.t-card__body) {
    padding: 16px;
  }
}

.tool-card__name {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 8px;
  line-height: 1.5;
}

.tool-card__desc {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
