<template>
  <div class="detail-content">
    <note-card-renderer
      :style-props="target?.props ?? {}"
      :blocks="SAMPLE_BLOCKS"
      author="山月"
      watermark="@半窗烟雨 · 笔记卡片"
      fixed
    />

    <div v-for="group in groupedProps" :key="group.value" class="detail-content__group">
      <h4 class="detail-content__group-title">{{ group.label }}</h4>
      <div class="detail-content__items">
        <div v-for="item in group.items" :key="item.key" class="detail-content__item">
          <span class="detail-content__label">{{ item.label }}</span>
          <span class="detail-content__value">
            <span
              v-if="item.type === 'color'"
              class="detail-content__swatch"
              :style="{ background: item.value }"
            ></span>
            {{ item.value || '（空）' }}
          </span>
        </div>
      </div>
    </div>

    <div class="detail-content__footer">
      <t-button v-if="!isSystem" variant="outline" theme="danger" @click="handleDelete">
        删除
      </t-button>
      <t-button v-if="!isSystem" theme="primary" @click="handleEdit">编辑</t-button>
      <t-button v-if="isSystem" variant="outline" @click="emit('close')">关闭</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  CARD_STYLE_GROUP_OPTIONS,
  CARD_STYLE_PROPS,
  type CardStylePropGroup
} from '@/global/card-style-props'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import { useCardStyleStore } from '@/windows/main/store'
import NoteCardRenderer from '@/components/card/NoteCardRenderer.vue'
import { markdownToBlocks } from '@/components/card/note-markdown'
import { openCardStylePut } from './CardStylePutDrawer'

/**
 * 卡片风格查看抽屉内容：整卡预览 + 按注册表分组展示样式值 + 编辑 / 删除操作。
 */
const props = defineProps<{ styleId: string }>()
const emit = defineEmits<{ close: [] }>()

const store = useCardStyleStore()
const target = computed(() => store.getById(props.styleId))
const isSystem = computed(() => !!target.value && store.isSystem(props.styleId))

const SAMPLE_BLOCKS = markdownToBlocks(
  [
    '## 周末去了趟青云山',
    '',
    '山里的空气特别清新，**云海**在脚下慢慢流动，走到一半突然放晴。',
    '',
    '> 最好的风景，总在人少的地方。',
    '',
    '- 全程步行约 8 公里',
    '- 山顶的日出值得早起',
    '',
    '==下次还来=='
  ].join('\n')
)

/** 按注册表分组展示样式值（跳过空值，如未设置的字体 / 描边） */
const groupedProps = computed(() => {
  const source = target.value
  if (!source) return []
  return CARD_STYLE_GROUP_OPTIONS.map((g) => ({
    ...g,
    items: CARD_STYLE_PROPS.filter((p) => p.group === (g.value as CardStylePropGroup))
      .map((p) => ({ key: p.key, label: p.label, type: p.type, value: source.props[p.key] ?? '' }))
      .filter((item) => item.value !== '')
  })).filter((g) => g.items.length > 0)
})

const handleEdit = () => {
  emit('close')
  openCardStylePut(props.styleId)
}

const handleDelete = async () => {
  if (!target.value) return
  try {
    await MessageBoxUtil.confirm(`确认删除卡片风格「${target.value.name}」？删除后不可恢复`, '删除风格')
    await store.remove(props.styleId)
    MessageUtil.success('删除成功')
    emit('close')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="less">
.detail-content {
  &__group {
    margin-top: 20px;

    &-title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 600;
      color: var(--td-text-color-primary);
    }
  }

  &__items {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 16px;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--td-radius-default);
    background: var(--td-bg-color-secondarycontainer);
    font: var(--td-font-body-small);
  }

  &__label {
    color: var(--td-text-color-secondary);
    flex-shrink: 0;
  }

  &__value {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--td-text-color-primary);
    word-break: break-all;
    text-align: right;
  }

  &__swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid var(--td-component-stroke);
    flex-shrink: 0;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid var(--td-component-stroke);
  }
}
</style>
