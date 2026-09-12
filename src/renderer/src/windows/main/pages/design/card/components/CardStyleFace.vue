<template>
  <div class="card-face">
    <div class="card-face__render">
      <note-card-renderer
        :style-props="safeProps"
        :template="style.template ?? ''"
        :extra-css="style.css ?? ''"
        :blocks="SAMPLE_BLOCKS"
        author="山月"
        watermark="@半窗烟雨 · 笔记卡片"
        fixed
      />
    </div>
    <div class="card-face__body">
      <div class="card-face__head">
        <span class="card-face__title" :title="style.name">{{ style.name }}</span>
        <span v-if="isSystem" class="card-face__badge">内置</span>
        <slot name="actions"></slot>
      </div>
      <p class="card-face__desc">{{ style.description }}</p>
      <div v-if="style.tags.length > 0" class="card-face__meta">
        <span v-for="t in style.tags.slice(0, 3)" :key="t" class="card-face__tag">#{{ t }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { AiCardStyle, AiCardStyleItem } from '@/entity'
import { normalizeCardStyleProps } from '@/global/card-style-props'
import { markdownToBlocks } from '@/components/card/note-markdown'
import NoteCardRenderer from '@/components/card/NoteCardRenderer.vue'

/**
 * 卡片风格整卡预览面：固定示例 markdown + 该风格键值对，经 NoteCardRenderer 所见即所得渲染。
 * meta 区与设计风格的 StyleCardFace compact 同构（标题行 + 徽标 + actions / 描述 / 标签行），
 * 封面是 iframe 真实渲染，外层拿不到风格 tokens，故文字样式走 tdesign 变量。
 */
const props = defineProps<{ style: AiCardStyleItem | AiCardStyle }>()

const isSystem = computed(() => 'isSystem' in props.style && props.style.isSystem)

/** 归一兜底：旧数据缺键时按注册表 fallback 补齐再渲染 */
const safeProps = computed(() => normalizeCardStyleProps(props.style.props))

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
</script>

<style scoped lang="less">
.card-face {
  &__render {
    border: 1px solid var(--td-component-stroke);
    border-radius: var(--td-radius-large);
    overflow: hidden;
    background: var(--td-bg-color-secondarycontainer);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 2px 0;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__badge {
    flex-shrink: 0;
    padding: 0 8px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    border: 1px solid currentColor;
    border-radius: var(--td-radius-default);
  }

  &__desc {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    min-width: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }

  &__tag {
    padding: 0 8px;
    border: 1px solid currentColor;
    border-radius: var(--td-radius-default);
  }
}
</style>
