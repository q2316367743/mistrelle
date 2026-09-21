<template>
  <t-popup
    v-model:visible="popupVisible"
    trigger="click"
    placement="bottom-left"
    destroy-on-close
    :disabled="disabled"
    @visible-change="handleVisibleChange"
  >
    <div class="canvas-file-picker" :class="{ 'canvas-file-picker--disabled': disabled }">
      <span
        class="canvas-file-picker__label"
        :class="{ 'canvas-file-picker__label--placeholder': !currentLabel }"
      >
        {{ currentLabel || '选择画布' }}
      </span>
      <chevron-down-icon class="canvas-file-picker__arrow" />
    </div>
    <template #content>
      <div class="canvas-picker-panel">
        <div class="canvas-picker-panel__header">
          <span class="canvas-picker-panel__title">画布</span>
          <t-button variant="text" size="small" theme="primary" :disabled="disabled" @click="handleUpload">
            <template #icon>
              <upload-icon />
            </template>
            上传
          </t-button>
        </div>
        <div v-if="canvasItems.length" class="canvas-picker-panel__list">
          <div
            v-for="item in canvasItems"
            :key="`${item.archived ? 'archived' : 'active'}-${item.name}`"
            class="canvas-picker-item"
            :class="{ 'canvas-picker-item--active': !item.archived && item.version === currentVersion }"
            @click="handleOpen(item)"
          >
            <image-icon v-if="item.source === 'upload'" class="canvas-picker-item__icon" />
            <palette-icon v-else class="canvas-picker-item__icon" />
            <div class="canvas-picker-item__main">
              <div class="canvas-picker-item__name">
                <span class="canvas-picker-item__text" :title="item.title || item.name">
                  {{ item.title || item.name }}
                </span>
                <t-tag v-if="item.source === 'upload'" size="small" variant="light" theme="primary">图片</t-tag>
                <t-tag v-if="item.archived" size="small" variant="light">已归档</t-tag>
              </div>
              <div class="canvas-picker-item__meta">
                {{ item.name }} · {{ formatTime(item.updatedTime) }}
              </div>
            </div>
            <t-button
              class="canvas-picker-item__action"
              variant="text"
              size="small"
              :theme="item.source === 'upload' && !item.archived ? 'danger' : 'primary'"
              :disabled="disabled"
              @click.stop="handleItemAction(item)"
            >
              {{ item.archived ? '取消归档' : item.source === 'upload' ? '删除' : '归档' }}
            </t-button>
          </div>
        </div>
        <div v-else class="canvas-picker-panel__empty">请先让 AI 创建画布或上传图片</div>
        <div class="canvas-picker-panel__footer">
          <t-checkbox v-model="showArchived" label="显示归档" />
        </div>
      </div>
    </template>
  </t-popup>
</template>

<script lang="ts" setup>
import dayjs from 'dayjs'
import { ChevronDownIcon, ImageIcon, PaletteIcon, UploadIcon } from 'tdesign-icons-vue-next'
import { getCanvasStore } from '@/windows/main/modules/canvas'
import { useCanvasPickerActions } from './useCanvasPickerActions'
import type { PickerCanvasItem } from './useCanvasPickerActions'

const props = withDefaults(
  defineProps<{
    sandbox?: string
    /** 聊天进行中：禁用切换 / 归档 / 上传 / 删除，避免干扰 AI 作答 */
    disabled?: boolean
  }>(),
  {
    sandbox: '',
    disabled: false
  }
)

const store = computed(() => getCanvasStore(props.sandbox))

const { handleItemAction, handleUpload } = useCanvasPickerActions(() => ({
  sandbox: props.sandbox,
  store: store.value
}))

const popupVisible = ref(false)
/** 勾选后归档画布追加展示在列表尾部（取消归档即可恢复） */
const showArchived = ref(false)

const canvasItems = computed<PickerCanvasItem[]>(() => {
  const active = store.value.files.value.map((file) => ({ ...file, archived: false }))
  if (!showArchived.value) return active
  return [...active, ...store.value.archivedFiles.value.map((file) => ({ ...file, archived: true }))]
})

const currentVersion = computed(() => store.value.current.value?.version)

const currentLabel = computed(() => {
  const doc = store.value.current.value
  if (!doc) return ''
  return doc.title ? `${doc.title}（${doc.name}）` : doc.name
})

const formatTime = (ts: number): string => dayjs(ts).format('MM-DD HH:mm')

const handleVisibleChange = (visible: boolean) => {
  popupVisible.value = visible
  // 每次展开都重扫列表：AI 与本地文件变更即时可见
  if (visible) void store.value.refreshFiles()
}

const close = () => {
  popupVisible.value = false
}

/** 点击条目打开画布（上传图片画布同样直接在主画布区显示）；归档画布先自动取消归档 */
const handleOpen = async (item: PickerCanvasItem) => {
  if (store.value.current.value?.version !== item.version) {
    if (item.archived) await store.value.unarchive(item.version)
    await store.value.open(item.version)
  }
  close()
}
</script>

<style scoped lang="less">
.canvas-file-picker {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: var(--td-brand-color);
  }

  &--disabled {
    cursor: not-allowed;
    background: var(--td-bg-color-secondarycontainer);

    &:hover {
      border-color: var(--td-component-border);
    }
  }

  &--disabled &__label {
    color: var(--td-text-color-disabled);
  }

  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    color: var(--td-text-color-primary);

    &--placeholder {
      color: var(--td-text-color-placeholder);
    }
  }

  &__arrow {
    flex-shrink: 0;
    color: var(--td-text-color-secondary);
  }
}

.canvas-picker-panel {
  width: 300px;
  padding: 8px;
  display: flex;
  flex-direction: column;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px 4px;
  }

  &__title {
    font-size: 12px;
    color: var(--td-text-color-secondary);
  }

  &__list {
    max-height: 280px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__empty {
    padding: 16px 8px;
    text-align: center;
    font-size: 12px;
    color: var(--td-text-color-placeholder);
  }

  &__footer {
    margin-top: 4px;
    padding: 8px 8px 0;
    border-top: 1px solid var(--td-component-stroke);
  }
}

.canvas-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: var(--td-bg-color-secondarycontainer);
  }

  &--active,
  &--active:hover {
    background: var(--td-brand-color-light);
  }

  &__icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--td-text-color-secondary);
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  &__text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    color: var(--td-text-color-primary);
  }

  &__meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    color: var(--td-text-color-secondary);
  }

  // hover 才出现操作按钮，保持列表视觉干净
  &__action {
    display: none;
    flex-shrink: 0;
  }

  &:hover &__action {
    display: inline-flex;
  }
}
</style>
