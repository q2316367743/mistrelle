<template>
  <div class="md-editor flex flex-col gap-6">
    <!-- 卡片风格 -->
    <div class="flex flex-col gap-3">
      <label class="panel-label">
        <palette-icon />
        卡片风格
      </label>
      <t-select
        v-model="state.styleId"
        :options="styleOptions"
        clearable
        placeholder="默认（系统预设风格）"
        style="width: 100%"
      />
      <p class="text-xs text-[#AAA]">可在「设计 → 卡片风格」查看、创建更多风格</p>
    </div>

    <!-- Markdown 内容 -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <label class="panel-label">
          <text-icon />
          Markdown 内容
        </label>
        <div class="flex items-center gap-2">
          <t-button
            title="在光标处插入本地图片（转 dataURL 内嵌，导出无需外链）"
            theme="default"
            variant="outline"
            size="small"
            @click="imageInput?.click()"
          >
            <template #icon><image-add-icon /></template>
            插入图片
          </t-button>
        </div>
        <input
          ref="imageInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onImageFiles"
        />
      </div>
      <t-textarea
        ref="contentRef"
        v-model="state.content"
        class="md-content-area"
        :autosize="{ minRows: 20, maxRows: 40 }"
        placeholder="支持 Markdown 语法：标题 / 列表 / 引用 / 代码块 / **加粗** / ==高亮==，图片用 ![描述](链接)"
      />
      <p class="text-xs text-[#AAA]">
        提示：`#` 标题、`**加粗**`、`==黄色高亮==`、`![](...)` 插图的排版会原样呈现在卡片上；
        正文超长自动拆成多张 3:4 卡片。
      </p>
    </div>

    <!-- 作者信息 -->
    <div class="flex flex-col gap-4">
      <label class="panel-label">
        <user-icon />
        作者信息
      </label>
      <div class="flex gap-4 items-start">
        <div class="avatar-zone relative flex-shrink-0" @click="avatarInput?.click()">
          <t-avatar
            :image="state.avatar || undefined"
            size="64px"
            shape="circle"
            :class="{ 'avatar-zone--empty': !state.avatar }"
          >
            <template v-if="!state.avatar" #icon>
              <user-icon />
            </template>
          </t-avatar>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onAvatarFile"
          />
          <t-button
            v-if="state.avatar"
            class="avatar-zone__remove"
            title="移除头像"
            shape="circle"
            variant="text"
            theme="danger"
            size="small"
            @click.stop="state.avatar = null"
          >
            <template #icon><close-icon /></template>
          </t-button>
        </div>
        <div class="flex flex-col gap-3 flex-1">
          <t-input v-model="state.nickname" type="text" placeholder="输入昵称" />
          <div class="flex items-center gap-2">
            <time-icon class="panel-aux-icon" />
            <t-input v-model="state.dateStr" type="text" placeholder="日期" />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部水印 -->
    <div class="flex flex-col gap-3">
      <label class="panel-label">
        <copyright-icon />
        底部水印
      </label>
      <t-input v-model="state.watermark" type="text" placeholder="输入水印文字" />
      <p class="text-xs text-[#AAA]">留空则不显示水印</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, type ComponentPublicInstance } from 'vue'
import {
  PaletteIcon,
  TextIcon,
  UserIcon,
  TimeIcon,
  CloseIcon,
  ImageAddIcon,
  CopyrightIcon
} from 'tdesign-icons-vue-next'
import { useCardStyleStore } from '@/windows/main/store'
import { state } from '../state'
import { blobToBase64 } from '@/utils/file/CovertUtil'

/**
 * Markdown 卡片主页面 - 编辑面板：卡片风格 + Markdown 源码 + 作者信息 + 底部水印。
 * 文章内容本身就是 Markdown，配图用 ![描述](dataURL) 插入 Markdown。
 */
const styleStore = useCardStyleStore()
const styleOptions = computed(() => styleStore.all.map((s) => ({ label: s.name, value: s.id })))

const avatarInput = ref<HTMLInputElement | null>(null)
const imageInput = ref<HTMLInputElement | null>(null)
const contentRef = ref<ComponentPublicInstance | null>(null)

const onAvatarFile = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) state.avatar = await blobToBase64(file)
  input.value = ''
}

const insertAtCursor = (text: string) => {
  const host = contentRef.value?.$el as HTMLElement | undefined
  const ta = host?.querySelector('textarea')
  if (!ta) {
    state.content += text
    return
  }
  const start = ta.selectionStart
  const end = ta.selectionEnd
  state.content = state.content.slice(0, start) + text + state.content.slice(end)
  requestAnimationFrame(() => {
    ta.focus()
    ta.setSelectionRange(start + text.length, start + text.length)
  })
}

const onImageFiles = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter((f) => f.type.startsWith('image/'))
  input.value = ''
  for (const file of files) {
    const data = await blobToBase64(file)
    insertAtCursor(`\n![配图](${data})\n`)
  }
}
</script>

<style scoped lang="less">
.panel-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--td-text-color-primary);
}

.panel-aux-icon {
  flex-shrink: 0;
  color: var(--td-text-color-placeholder);
}

.avatar-zone {
  cursor: pointer;

  :deep(.t-avatar--circle) {
    border: 1.5px dashed var(--td-border-level-2-color);
  }

  &.avatar-zone--empty :deep(.t-avatar--circle) {
    background: var(--td-bg-color-secondarycontainer);
  }

  .avatar-zone__remove {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 22px;
    height: 22px;
    padding: 0;
    background: var(--td-error-color);
    color: #fff;

    &:hover {
      background: var(--td-error-color-hover);
      color: #fff;
    }

    :deep(.t-button__text) {
      display: inline-flex;
    }
  }
}
</style>
