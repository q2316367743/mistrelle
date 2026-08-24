<template>
  <div class="m-chat-user">
    <!-- 用户消息内联展示：文本为文字，skill/file 为不同色与图标的标签，整行内联。
         默认折叠限高、底部逐渐模糊，模糊区中央向下箭头展开；展开后内容下方居中向上箭头收起 -->
    <div class="content-wrap" :class="{ 'is-collapsed': collapsed, 'is-faded': isOverflow }">
      <div ref="contentRef" class="r-chat-list__user-content">
        <template v-for="(item, index) in message.content" :key="item.id || index">
          <span v-if="item.type === 'text'" class="r-chat-list__text">{{ item.data }}</span>
          <t-tag
            v-else-if="item.type === 'skill'"
            theme="primary"
            variant="light"
            :title="item.data.path"
            size="small"
            class="r-chat-list__inline-tag"
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
            class="r-chat-list__inline-tag"
          >
            <template #icon><ToolsIcon /></template>
            {{ item.data.label }}
          </t-tag>
          <template v-else-if="item.type === 'attachment'">
            <template v-for="(file, fi) in item.data" :key="file.url || fi">
              <t-popup
                v-if="file.fileType === 'image' && file.url"
                trigger="hover"
                placement="top"
                show-arrow
                destroy-on-close
                class="r-chat-list__inline-tag"
              >
                <t-tag
                  theme="success"
                  variant="light"
                  :title="file.url"
                  class="r-chat-list__file-tag"
                  @click="revealFile(file.url)"
                >
                  <template #icon><FileImageIcon /></template>
                  @{{ file.name }}
                </t-tag>
                <template #content>
                  <t-image
                    :src="toLocalSrc(file.url)"
                    :alt="file.name"
                    fit="contain"
                    shape="round"
                    class="r-chat-list__image-preview"
                  />
                </template>
              </t-popup>
              <t-tag
                v-else
                theme="success"
                variant="light"
                :title="file.url"
                class="r-chat-list__inline-tag r-chat-list__file-tag"
                @click="revealFile(file.url)"
              >
                <template #icon><FileIcon /></template>
                @{{ file.name }}
              </t-tag>
            </template>
          </template>
          <t-tag
            v-else-if="item.type === 'canvas'"
            theme="default"
            variant="light"
            :title="`画布 canvas-${item.data.version} 节点 ${item.data.nodeId}`"
            size="small"
            class="r-chat-list__inline-tag"
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
            class="r-chat-list__inline-tag"
          >
            <template #icon><SlideshowIcon /></template>
            PPT({{ item.data.pptId }})节点({{ item.data.label || item.data.nodeId }})
          </t-tag>
        </template>
      </div>
      <!-- 折叠态：悬浮在底部模糊区中央的向下箭头，点击展开 -->
      <button
        v-if="collapsed && isOverflow"
        class="toggle-arrow toggle-arrow--down"
        type="button"
        title="展开"
        @click="toggle"
      >
        <ChevronDownIcon />
      </button>
    </div>
    <!-- 展开态：内容下方居中的向上箭头，点击收起 -->
    <button
      v-if="!collapsed"
      class="toggle-arrow toggle-arrow--up"
      type="button"
      title="收起"
      @click="toggle"
    >
      <ChevronUpIcon />
    </button>
    <div class="footer">
      <RChatActionbar
        :content="getUserText(message)"
        role="user"
        @delete="$emit('delete', message.id)"
        style="margin-right: 8px;"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { UserMessage } from '@/domain'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CodeIcon,
  FileIcon,
  FileImageIcon,
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

const revealFile = (path?: string) => {
  if (!path) return
  window.preload.inject.shell.showItemInFolder(path)
}

const toLocalSrc = (path: string) => window.preload.net.pathToHref(path)

// ─── 内容折叠 / 展开（默认限高 + 底部渐变模糊，箭头展开 / 收起） ───

const contentRef = ref<HTMLElement>()
/** 是否处于折叠态（默认折叠） */
const collapsed = ref(true)
/** 折叠态下内容是否溢出限高（否则无需"展开"箭头） */
const isOverflow = ref(false)

/**
 * 检测折叠内容是否存在溢出（scrollHeight 不受 max-height 影响，返回完整内容高度，
 * 因此只需在折叠态下比较 scrollHeight 与 clientHeight 即可判断是否需要"展开"箭头）。
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
  // 容器/窗口尺寸变化后重新判断是否需要"展开"箭头（如聊天窗口宽度影响换行高度）
  resizeObserver = new ResizeObserver(checkOverflow)
  if (contentRef.value) resizeObserver.observe(contentRef.value)
})
onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = undefined
})
</script>
<style scoped lang="less">
/* popup 传送到 body，选择器不能挂在 .m-chat-user 下，否则宽高不生效 */
.r-chat-list__image-preview {
  width: 240px;
  height: 180px;
  background: var(--td-bg-color-secondarycontainer);
}
.m-chat-user {
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  // 内容外壳：折叠态承载限高与底部渐变模糊，箭头按钮须在模糊层之外定位
  .content-wrap {
    position: relative;

    // 折叠态：限高 3 行（66px）；仅当内容溢出时底部逐渐模糊（短消息限高无副作用，但不能被无故糊掉）
    &.is-collapsed {
      .r-chat-list__user-content {
        max-height: 66px;
        overflow: hidden;
      }

      // 底部模糊覆盖层：backdrop-filter 模糊内容，自身 mask 渐变使模糊强度自上而下递增
      &.is-faded::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 30px;
        backdrop-filter: blur(6px);
        mask-image: linear-gradient(to bottom, transparent, black 90%);
        pointer-events: none;
      }
    }
  }

  // 用户消息内容：文本与标签像一段文字内联排列，自然换行
  .r-chat-list__user-content {
    padding: 8px;
    border: 1px solid var(--td-border-level-1-color);
    border-radius: var(--td-radius-large);
    overflow-wrap: anywhere;
    display: block;
    line-height: 22px;

    .r-chat-list__inline-tag {
      margin-right: 4px;
      vertical-align: middle;
    }
    .r-chat-list__file-tag {
      cursor: pointer;
    }
    .r-chat-list__text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  }
  // 圆形毛玻璃箭头钮：折叠态悬浮于模糊区中央（向下展开），展开态居中排在内容下方（向上收起）
  .toggle-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--td-component-border);
    border-radius: 50%;
    background: color-mix(in srgb, var(--td-bg-color-container) 72%, transparent);
    backdrop-filter: blur(8px);
    color: var(--td-text-color-secondary);
    cursor: pointer;
    transition:
      color 120ms ease-out,
      background 120ms ease-out,
      box-shadow 120ms ease-out;

    &:hover {
      color: var(--td-brand-color);
      background: var(--td-brand-color-light);
      box-shadow: var(--td-shadow-1);
    }

    &--down {
      position: absolute;
      left: 50%;
      bottom: 4px;
      transform: translateX(-50%);
    }

    &--up {
      margin: 6px auto 0;
    }
  }
  .footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }
}
</style>
