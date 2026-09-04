<template>
  <t-tabs :value="activeFile" class="novel-tabs" @change="handleChange">
    <t-tab-panel v-for="item in tabItems" :key="item.key" :value="item.key" :label="item.label">
      <div class="novel-tabs__preview">
        <chat-content :content="contents[item.key] ?? ''" />
      </div>
    </t-tab-panel>
  </t-tabs>
</template>
<script lang="ts" setup>
import { ChatContent } from '@tdesign-vue-next/chat'
import type { NovelFileKey } from '@/windows/main/modules/tool/components/novel/novelTypes'

defineProps<{
  activeFile: NovelFileKey
  contents: Record<NovelFileKey, string>
}>()

const emit = defineEmits<{
  (e: 'change', key: NovelFileKey): void
}>()

const tabItems: { key: NovelFileKey; label: string }[] = [
  { key: 'story', label: '正文' },
  { key: 'characters', label: '角色' },
  { key: 'outline', label: '大纲' },
  { key: 'setting', label: '设定' },
  { key: 'style', label: '文风' }
]

const handleChange = (value: unknown) => {
  const item = tabItems.find((t) => t.key === value)
  if (item) emit('change', item.key)
}
</script>
<style scoped lang="less">
.novel-tabs {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.t-tabs__nav) {
    margin: 0 8px;
  }

  :deep(.t-tabs__content) {
    flex: 1;
    min-height: 0;
    display: flex;
    margin-top: 8px;
  }

  :deep(.t-tab-panel) {
    flex: 1;
    min-width: 0;
    display: flex;
    border-radius: var(--td-radius-medium);
    border: 1px solid var(--td-border-level-1-color);
    overflow: hidden;
  }

  &__preview {
    flex: 1;
    min-width: 0;
    overflow: auto;
    padding: 16px 20px;
    box-sizing: border-box;
  }
}
</style>
