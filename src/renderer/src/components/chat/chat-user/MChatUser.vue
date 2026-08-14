<template>
  <div class="m-chat-user">
    <!-- 用户消息内联展示：文本为文字，skill/file 为不同色与图标的标签，整行内联。
         默认折叠为最多 2 行，点击"更多"展开全部，再次点击"收起"折叠 -->
    <div
      ref="contentRef"
      class="r-chat-list__user-content"
      :class="{ 'is-collapsed': collapsed }"
    >
      <template v-for="(item, index) in message.content" :key="item.id || index">
        <span v-if="item.type === 'text'" class="r-chat-list__text">{{ item.data }}</span>
        <t-tag
          v-else-if="item.type === 'skill'"
          theme="primary"
          variant="light"
          :title="item.data.path"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><CodeIcon /></template>
          {{ item.data.name }}
        </t-tag>
        <t-tag
          v-else-if="item.type === 'tool'"
          theme="warning"
          variant="light"
          :title="item.data.label"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><ToolsIcon /></template>
          {{ item.data.label }}
        </t-tag>
        <template v-else-if="item.type === 'attachment'">
          <t-tag
            v-for="(file, fi) in item.data"
            :key="file.url || fi"
            theme="success"
            variant="light"
            :title="file.url"
            class="r-chat-list__inline-tag"
          >
            <template #icon><FileIcon /></template>
            @{{ file.name }}
          </t-tag>
        </template>
        <t-tag
          v-else-if="item.type === 'canvas'"
          theme="default"
          variant="light"
          :title="`画布 canvas-${item.data.version} 节点 ${item.data.nodeId}`"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><LayersIcon /></template>
          画布(canvas-{{ item.data.version }})节点({{ item.data.label || item.data.nodeId }})
        </t-tag>
        <t-tag
          v-else-if="item.type === 'ppt'"
          theme="warning"
          variant="light"
          :title="`PPT「${item.data.pptId}」第 ${item.data.slide} 页节点 ${item.data.nodeId}`"
          size="small"
          class="r-chat-list__inline-tag mr-4px"
        >
          <template #icon><SlideshowIcon /></template>
          PPT({{ item.data.pptId }})节点({{ item.data.label || item.data.nodeId }})
        </t-tag>
      </template>
    </div>
    <button
      v-if="canToggle"
      class="show-more"
      type="button"
      @click="toggle"
    >
      <ChevronDownIcon v-if="collapsed" class="show-more__icon" />
      <ChevronUpIcon v-else class="show-more__icon" />
      <span>{{ collapsed ? '更多' : '收起' }}</span>
    </button>
    <div class="footer">
      <RChatActionbar
        :content="getUserText(message)"
        role="user"
        @delete="$emit('delete', message.id)"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { UserMessage } from '@/domain'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  FileIcon,
  LayersIcon,
  SlideshowIcon,
  ToolsIcon
} from 'tdesign-icons-vue-next'

defineProps({
  message: {
    type: Object as PropType<UserMessage>,
    required: true
  }
})
defineEmits(['delete'])

const getUserText = (message: UserMessage) => {
  return message.content.find((item) => item.type === 'text')?.data ?? ''
}

// ─── 内容折叠 / 展开（默认最多 2 行，点击"更多"展开全部，再次点击"收起"折叠） ───

const contentRef = ref<HTMLElement>()
/** 是否处于折叠态（默认折叠） */
const collapsed = ref(true)
/** 折叠态下内容是否超过两行一屏（否则无需"更多"按钮） */
const isOverflow = ref(false)

const canToggle = computed(() => !collapsed.value || isOverflow.value)

/**
 * 检测折叠内容是否存在溢出（scrollHeight 不受 -webkit-line-clamp 影响，返回完整内容高度，
 * 因此只需在折叠态下比较 scrollHeight 与 clientHeight 即可判断是否需要"更多"）。
 */
const checkOverflow = () => {
  const el = contentRef.value
  if (!el) return
  isOverflow.value = el.scrollHeight > el.clientHeight + 1
}

const toggle = () => {
  collapsed.value = !collapsed.value
}

watch(collapsed, () => nextTick(checkOverflow))

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  nextTick(checkOverflow)
  // 容器/窗口尺寸变化后重新判断是否需要"更多"（如聊天窗口宽度影响换行高度）
  resizeObserver = new ResizeObserver(checkOverflow)
  if (contentRef.value) resizeObserver.observe(contentRef.value)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = undefined
})
</script>
<style scoped lang="less">
.m-chat-user {
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  // 用户消息内容：文本与标签像一段文字内联排列，自然换行
  .r-chat-list__user-content {
    padding: 8px;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-large);
    overflow-wrap: anywhere;
    display: block;
    line-height: 22px;

    // 折叠态：限制为最多 2 行，超出省略号截断
    &.is-collapsed {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }

    .r-chat-list__text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }
  .show-more {
    display: inline-flex;
    align-items: center;
    gap: var(--td-comp-margin-xxs);
    margin-top: var(--td-comp-margin-xxs);
    padding: 0 var(--td-comp-paddingLR-xxs);
    border: none;
    background: none;
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
    cursor: pointer;
    user-select: none;
    transition: color 120ms ease-out;

    &:hover {
      color: var(--td-brand-color);
    }

    &__icon {
      flex-shrink: 0;
      font-size: var(--td-font-size-body-medium);
    }
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
}
</style>
