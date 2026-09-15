<template>
  <t-popup trigger="click" placement="bottom-left" :disabled="humanizing" destroy-on-close>
    <t-button
      size="small"
      variant="outline"
      class="version-trigger"
      :loading="!!streamingVersionId"
    >
      {{ triggerLabel }}
      <template #suffix><chevron-down-icon /></template>
    </t-button>
    <template #content>
      <div class="version-panel">
        <t-timeline mode="same" layout="vertical">
          <t-timeline-item
            v-for="v in reversedVersions"
            :key="v.id"
            :label="timeLabel(v)"
            :dot-color="v.id === activeVersionId ? 'primary' : 'default'"
            :loading="v.id === streamingVersionId"
          >
            <div
              class="version-item"
              :class="{ 'is-active': v.id === activeVersionId }"
              :title="v.id === activeVersionId ? '当前版本' : '点击切换到此版本'"
              @click="emit('select', v.id)"
            >
              <div class="version-item__head">
                <span class="version-item__label">{{ versionLabel(v) }}</span>
                <span v-if="v.words" class="version-item__words">{{ v.words }} 字</span>
                <t-popconfirm
                  v-if="versions.length > 1"
                  content="确认删除该版本？"
                  theme="danger"
                  @confirm="emit('remove', v.id)"
                >
                  <span class="version-item__remove" title="删除版本" @click.stop>
                    <close-icon />
                  </span>
                </t-popconfirm>
              </div>
            </div>
          </t-timeline-item>
        </t-timeline>
        <div class="version-panel__tip">点击任意版本即可切换（原内容保留可随时切回）</div>
      </div>
    </template>
  </t-popup>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { ChevronDownIcon, CloseIcon } from 'tdesign-icons-vue-next'
import type { ArticleVersion } from '@/windows/main/modules/tool/components/article/articleTypes'
import { ARTICLE_VERSION_SOURCE_OPTIONS } from '@/windows/main/modules/tool/components/article/articleTypes'

const props = defineProps<{
  versions: ArticleVersion[]
  activeVersionId: string
  /** 去 AI 味进行中 */
  humanizing?: boolean
  /** 正在流式生成的版本 id */
  streamingVersionId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select', versionId: string): void
  (e: 'remove', versionId: string): void
}>()

const sourceLabel = (v: ArticleVersion): string =>
  v.label ?? ARTICLE_VERSION_SOURCE_OPTIONS.find((o) => o.value === v.source)?.label ?? '版本'

/** 最新版本在上（时间线倒序展示） */
const reversedVersions = computed(() => [...props.versions].reverse())

/** 版本号：显式 no 字段（创建时分配，删除中间版本不影响既有编号） */
const versionLabel = (v: ArticleVersion): string => `第${v.no}版 · ${sourceLabel(v)}`

const timeLabel = (v: ArticleVersion): string => dayjs(v.createdTime).format('MM-DD HH:mm')

const triggerLabel = computed((): string => {
  if (props.streamingVersionId) return '生成中…'
  const active = props.versions.find((v) => v.id === props.activeVersionId)
  if (!active) return '版本'
  return `第${active.no}版 · ${sourceLabel(active)}`
})
</script>
<style scoped lang="less">
.version-trigger {
  /* 可收缩：工具栏按「最小 VERSION_MIN_WIDTH」为它预留预算，实际更宽时由 flex 收缩补足差额，
     从而把空间让给格式区，保证工具栏恒为一行 */
  flex: 0 1 auto;
  min-width: 56px;
  max-width: 140px;

  :deep(.t-button__text) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.version-panel {
  padding: 12px;
  max-height: 380px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 264px;

  &__tip {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
  }
}

.version-item {
  padding: 2px 4px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--td-bg-color-secondarycontainer);

    .version-item__remove {
      opacity: 1;
    }
  }

  &.is-active {
    .version-item__label {
      color: var(--td-brand-color);
      font-weight: 600;
    }
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__label {
    flex: 1;
    min-width: 0;
    font-size: var(--td-font-size-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__words {
    flex-shrink: 0;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    font-variant-numeric: tabular-nums;
  }

  &__remove {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--td-text-color-placeholder);
    opacity: 0;
    transition: opacity 0.2s ease;

    &:hover {
      color: var(--td-error-color);
    }
  }
}
</style>
