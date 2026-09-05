<template>
  <div class="flex flex-col gap-6">
    <!-- 卡片风格（本页相对参考站的唯一增量） -->
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
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
        <label class="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
          <text-icon />
          文章内容
        </label>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#555] bg-[#F5F5F5] rounded-full hover:bg-[#EBEBEB] transition-colors disabled:opacity-50"
            title="从剪贴板一键粘贴图文（含图片）"
            :disabled="parsing"
            @click="pasteAll"
          >
            <xhs-icon
              :node="ICON_NODES.loaderCircle"
              :class="parsing ? 'w-3.5 h-3.5 animate-spin' : 'hidden'"
            />
            <xhs-icon v-if="!parsing" :node="ICON_NODES.clipboardPaste" class="w-3.5 h-3.5" />
            {{ parsing ? '解析中...' : '粘贴图文' }}
          </button>
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
      <label class="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
        <xhs-icon :node="ICON_NODES.user" class="w-4 h-4" />
        作者信息
      </label>
      <div class="flex gap-4 items-start">
        <div
          class="upload-zone relative w-16 h-16 !rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
          :class="{ 'drag-over': avatarDrag }"
          @dragover.prevent="avatarDrag = true"
          @dragleave="avatarDrag = false"
          @drop.prevent.stop="onDrop($event, 'avatar')"
          @click="avatarInput?.click()"
        >
          <img
            v-if="state.avatar"
            :src="state.avatar"
            alt="avatar"
            class="w-full h-full object-cover"
          />
          <xhs-icon v-else :node="ICON_NODES.user" class="w-6 h-6 text-[#888]" />
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onAvatarFile"
          />
          <button
            v-if="state.avatar"
            class="absolute top-0 right-0 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
            title="移除头像"
            @click.stop="state.avatar = null"
          >
            <xhs-icon :node="ICON_NODES.x" class="w-3 h-3" />
          </button>
        </div>
        <div class="flex flex-col gap-3 flex-1">
          <input v-model="state.nickname" type="text" placeholder="输入昵称" :class="INPUT_CLASS" />
          <div class="flex items-center gap-2">
            <xhs-icon :node="ICON_NODES.calendar" class="w-4 h-4 text-[#888]" />
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
      <label class="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
        <xhs-icon :node="ICON_NODES.imageUp" class="w-4 h-4" />
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
            <button
              class="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
              title="移除这张图"
              @click="state.images.splice(i, 1)"
            >
              <xhs-icon :node="ICON_NODES.x" class="w-3 h-3" />
            </button>
          </div>
          <button
            class="aspect-square rounded-lg border-2 border-dashed border-[#E5E5E5] flex flex-col items-center justify-center gap-1 text-[#AAA] hover:border-[#C0C0C0] hover:text-[#888] transition-colors"
            title="点击或拖拽添加配图"
            @click="imagesInput?.click()"
          >
            <xhs-icon :node="ICON_NODES.plus" class="w-5 h-5" />
            <span class="text-[10px]">添加</span>
          </button>
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
      <label class="flex items-center gap-2 text-sm font-medium text-[#1A1A1A]">
        <xhs-icon :node="ICON_NODES.copyright" class="w-4 h-4" />
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
  PenFluorescenceIcon
} from 'tdesign-icons-vue-next'
import XhsIcon from './XhsIcon.vue'
import { ICON_NODES } from './icons'
import { useEditorPanel } from './useEditorPanel'

/**
 * 参考站 EditorPanel 的 1:1 移植（内容 / 作者信息 / 配图 / 底部水印），
 * 顶部「卡片风格」为本页唯一增量（RL-04 例外：1:1 复刻参考站的按钮与输入框）。
 * 交互逻辑在 useEditorPanel.ts，本文件只承载模板。
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
<style lang="less"></style>
