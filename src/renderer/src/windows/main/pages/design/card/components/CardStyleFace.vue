<template>
  <div class="card-face">
    <div class="card-face__render">
      <note-card-renderer
        :style-props="safeProps"
        :blocks="SAMPLE_BLOCKS"
        author="山月"
        watermark="@半窗烟雨 · 笔记卡片"
        fixed
      />
    </div>
    <div class="card-face__meta">
      <div class="card-face__name">
        <span class="card-face__title">{{ style.name }}</span>
        <t-tag v-if="isSystem" size="small" variant="light">内置</t-tag>
      </div>
      <div class="card-face__desc">{{ style.description }}</div>
      <div v-if="$slots.actions" class="card-face__actions" @click.stop>
        <slot name="actions"></slot>
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
 * （RL-04 例外先例同 StyleCardFace：规范数据渲染不经 tdesign，交互经 #actions 插槽仍走 tdesign）
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

  &__meta {
    padding: 10px 2px 0;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__desc {
    margin-top: 4px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__actions {
    margin-top: 8px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
