<template>
  <div class="flex flex-col gap-6">
    <!-- 卡片风格（本页相对参考站的唯一增量） -->
    <div class="flex flex-col gap-3">
      <label class="panel-label">
        <PaletteIcon />
        卡片风格
      </label>
      <t-select
        v-model="state.styleId"
        :options="styleOptions"
        clearable
        placeholder="默认（参考站原版样式）"
        style="width: 100%"
      />
      <p class="text-xs text-[#AAA]">不选即原版样式；可在「设计 → 卡片风格」查看、创建更多风格</p>
    </div>

    <!-- 文章内容 -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <label class="panel-label">
          <TextIcon />
          文章内容
        </label>
        <div class="flex items-center gap-2">
          <t-button
            title="从剪贴板一键粘贴图文（含图片）"
            theme="default"
            variant="outline"
            size="small"
            :loading="parsing"
            @click="pasteAll"
          >
            <template #icon>
              <PasteIcon />
            </template>
            {{ parsing ? '解析中...' : '粘贴图文' }}
          </t-button>
          <t-button
            title="在光标处插入配图标记"
            theme="default"
            size="small"
            shape="rectangle"
            @click="insertImageMark"
          >
            <template #icon>
              <ImageAddIcon />
            </template>
            插入配图
          </t-button>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <t-button
          title="选中文字后点击，或插入 **加粗** 标记"
          theme="default"
          size="small"
          shape="rectangle"
          @click="wrapMark('**')"
        >
          <template #icon>
            <textformat-bold-icon />
          </template>
          加粗
        </t-button>
        <t-button
          title="选中文字后点击，或插入 ==高亮== 标记（黄色底）"
          theme="default"
          size="small"
          shape="rectangle"
          @click="wrapMark('==')"
        >
          <template #icon>
            <pen-fluorescence-icon />
          </template>
          高亮
        </t-button>
        <t-divider layout="vertical" size="4px" />
        <t-button
          title="导入 .md 文件，标题/加粗/图片自动转换"
          :disabled="parsing"
          theme="default"
          size="small"
          shape="rectangle"
          @click="mdInput?.click()"
        >
          <template #icon>
            <FileMarkdownIcon />
          </template>
          导入 Markdown
        </t-button>
        <t-button
          title="导入 .docx 文件，文字与图片自动转换"
          :disabled="parsing"
          theme="default"
          size="small"
          shape="rectangle"
          @click="wordInput?.click()"
        >
          <template #icon>
            <FileWordIcon />
          </template>
          导入 Word
        </t-button>
        <input
          ref="mdInput"
          type="file"
          accept=".md,.markdown,.txt"
          class="hidden"
          @change="onMarkdownFile"
        />
        <input ref="wordInput" type="file" accept=".docx" class="hidden" @change="onWordFile" />
      </div>
      <textarea
        ref="textareaRef"
        v-model="state.content"
        placeholder="写点什么吧... 支持从飞书/网页直接复制图文、Markdown 文本粘贴进来，图片会自动插入对应位置"
        class="w-full h-64 p-4 bg-[#F5F5F5] rounded-xl border-none resize-none text-[15px] leading-relaxed text-[#1A1A1A] placeholder:text-[#888] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10"
        @paste="onPaste"
      />
      <p class="text-xs text-[#AAA]">
        提示：<code class="px-1 py-0.5 bg-[#F0F0F0] rounded text-[#666]">**加粗**</code>
        <code class="px-1 py-0.5 bg-[#F0F0F0] rounded text-[#666]">==黄色高亮==</code>
        <code class="px-1 py-0.5 bg-[#F0F0F0] rounded text-[#666]">[img]</code> 按顺序取图，
        <code class="px-1 py-0.5 bg-[#F0F0F0] rounded text-[#666]">[img2]</code>
        指定第 2 张；内容超长会自动拆成多张 3:4 卡片
      </p>
    </div>

    <!-- 作者信息 -->
    <div class="flex flex-col gap-4">
      <label class="panel-label">
        <UserIcon />
        作者信息
      </label>
      <div class="flex gap-4 items-start">
        <div
          class="avatar-zone relative flex-shrink-0"
          :class="{ 'drag-over': avatarDrag }"
          @dragover.prevent="avatarDrag = true"
          @dragleave="avatarDrag = false"
          @drop.prevent.stop="onDrop($event, 'avatar')"
          @click="avatarInput?.click()"
        >
          <t-avatar
            :image="state.avatar ?? undefined"
            size="64px"
            shape="circle"
            :class="{ 'avatar-zone--empty': !state.avatar }"
          >
            <template v-if="!state.avatar" #icon>
              <UserIcon />
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
            <template #icon>
              <CloseIcon />
            </template>
          </t-button>
        </div>
        <div class="flex flex-col gap-3 flex-1">
          <input v-model="state.nickname" type="text" placeholder="输入昵称" :class="INPUT_CLASS" />
          <div class="flex items-center gap-2">
            <TimeIcon class="panel-aux-icon" />
            <input
              v-model="state.dateStr"
              type="text"
              placeholder="日期"
              :class="`flex-1 ${INPUT_CLASS}`"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 配图 -->
    <div class="flex flex-col gap-3">
      <label class="panel-label">
        <ImageIcon />
        配图{{ state.images.length > 0 ? `（${state.images.length} 张）` : '' }}
      </label>
      <div
        class="rounded-xl p-1 transition-all"
        :class="{ 'ring-2 ring-[#FF2442]/40 bg-[#FFF5F6]': imagesDrag }"
        @dragover.prevent="imagesDrag = true"
        @dragleave="imagesDrag = false"
        @drop.prevent.stop="onDrop($event, 'image')"
      >
        <div class="grid grid-cols-4 gap-2">
          <div
            v-for="(image, i) in state.images"
            :key="image.src.slice(-24) + i"
            class="relative aspect-square rounded-lg overflow-hidden border border-[#EBEBEB] group"
          >
            <img :src="image.src" :alt="`图${i + 1}`" class="w-full h-full object-cover" />
            <span
              class="absolute left-1 bottom-1 px-1.5 py-0.5 text-[10px] leading-none text-white bg-black/50 rounded"
            >
              图{{ i + 1 }}
            </span>
            <t-button
              class="thumb-remove opacity-0 group-hover:opacity-100"
              title="移除这张图"
              shape="circle"
              variant="text"
              theme="danger"
              size="small"
              @click.stop="state.images.splice(i, 1)"
            >
              <template #icon>
                <CloseIcon />
              </template>
            </t-button>
          </div>
          <t-button
            class="thumb-add"
            title="点击或拖拽添加配图"
            variant="outline"
            theme="default"
            shape="square"
            @click="imagesInput?.click()"
          >
            <template #icon>
              <AddIcon />
            </template>
            添加
          </t-button>
        </div>
        <p class="text-xs text-[#AAA] mt-2 px-1">
          支持 JPG、PNG、GIF，可多选或拖拽添加；文中用 [img] 标记控制位置
        </p>
      </div>
      <input
        ref="imagesInput"
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onImageFiles"
      />
    </div>

    <!-- 底部水印 -->
    <div class="flex flex-col gap-3">
      <label class="panel-label">
        <CopyrightIcon />
        底部水印
      </label>
      <input
        v-model="state.watermark"
        type="text"
        placeholder="输入水印文字"
        :class="INPUT_CLASS"
      />
      <p class="text-xs text-[#AAA]">留空则不显示水印</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  PaletteIcon,
  TextIcon,
  FileMarkdownIcon,
  FileWordIcon,
  ImageAddIcon,
  TextformatBoldIcon,
  PenFluorescenceIcon,
  PasteIcon,
  UserIcon,
  TimeIcon,
  ImageIcon,
  CloseIcon,
  AddIcon,
  CopyrightIcon
} from 'tdesign-icons-vue-next'
import { useEditorPanel } from './useEditorPanel'

/**
 * 参考站 EditorPanel 的 1:1 移植（内容 / 作者信息 / 配图 / 底部水印），
 * 顶部「卡片风格」为本页唯一业务增量。
 * 交互逻辑在 useEditorPanel.ts，本文件只承载模板；按钮 / 图标 / 输入框均使用 tdesign。
 */
const textareaRef = useTemplateRef<HTMLTextAreaElement>('textareaRef')
const {
  state,
  INPUT_CLASS,
  styleOptions,
  avatarInput,
  imagesInput,
  mdInput,
  wordInput,
  avatarDrag,
  imagesDrag,
  parsing,
  insertImageMark,
  wrapMark,
  onPaste,
  pasteAll,
  onAvatarFile,
  onImageFiles,
  onDrop,
  onMarkdownFile,
  onWordFile
} = useEditorPanel(textareaRef)
</script>
<style scoped lang="less">
// tdesign 化后的局部修正：分节标签 / 头像上传区 / 配图缩略图按钮的覆盖与布局样式
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

  &.drag-over :deep(.t-avatar--circle) {
    border-color: var(--td-brand-color);
    box-shadow: 0 0 0 2px var(--td-brand-color-light);
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

.thumb-add {
  min-width: 0;
  height: auto;
  aspect-ratio: 1;
  border-radius: 8px;

  &.t-button--variant-outline {
    border: 1.5px dashed var(--td-border-level-2-color);
    background: transparent;
    color: var(--td-text-color-placeholder);
  }

  &:hover {
    border-color: var(--td-brand-color);
    color: var(--td-brand-color);
  }

  :deep(.t-button__text) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
}

.thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;

  &:hover {
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
  }
}
</style>
