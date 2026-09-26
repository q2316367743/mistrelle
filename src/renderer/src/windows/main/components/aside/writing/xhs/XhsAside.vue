<template>
  <div class="xhs-aside">
    <!-- 图与文是同位的一级视图，用 tab 切换：图片在前（笔记重点），正文其次 -->
    <t-tabs v-model="tab" class="xhs-aside__tabs">
      <t-tab-panel value="canvas" label="图片" :destroy-on-hide="false">
        <div class="xhs-aside__view">
          <!-- 一级视图直接复用设计创意场景的 canvas 侧栏：切页 / 上传 / 遮盖 / 元素树 /
               属性面板 / 导出 PNG·PSD，与 AI 的 canvas_* 同一 store 实时联动 -->
          <design-aside
            :sandbox="sandbox"
            :workspace="workspace"
            :fullscreen="fullscreen"
            :status="status"
          />
        </div>
      </t-tab-panel>
      <!-- lazy：正文页首次切到才挂载（Monaco 需要在可见容器里创建，不能建在隐藏容器上），
           之后 destroyOnHide=false 常驻，切回来保留撤销栈与滚动位置 -->
      <t-tab-panel value="text" label="正文" lazy :destroy-on-hide="false">
        <div class="xhs-aside__view">
          <xhs-text-panel :sandbox="sandbox" :workspace="workspace" />
        </div>
      </t-tab-panel>
    </t-tabs>
  </div>
</template>
<script lang="ts" setup>
import type { ChatStatus } from '@/windows/main/modules/chat'
import DesignAside from '@/windows/main/components/aside/design/DesignAside.vue'
import XhsTextPanel from './components/XhsTextPanel.vue'

/**
 * 小红书侧栏：**图为主**——「图片」tab 常驻画板（复用 canvas 引擎侧栏）；
 * 「正文」tab 用 Monaco 编辑发布文案源码，不做 Markdown 渲染（小红书不支持 Markdown，
 * 渲染层只会掩盖真正要复制发布的内容）。两 tab 是同位一级视图，都常驻不反复重建。
 */
defineProps<{
  sandbox?: string
  workspace?: string
  fullscreen?: boolean
  /** 会话作答状态：画板据此禁用切页，避免干扰 AI 作答 */
  status?: ChatStatus
}>()

const tab = ref<'canvas' | 'text'>('canvas')
</script>
<style scoped lang="less">
.xhs-aside {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  // tdesign tabs 的内容区默认不是弹性容器，且带内容内边距——这里让面板区撑满剩余高度。
  // 若后续调整 tab 头间距，改这几条即可，不要动 tdesign 自身样式
  :deep(.t-tabs) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :deep(.t-tabs__content) {
    flex: 1;
    min-height: 0;
    padding: 0;
  }

  :deep(.t-tab-panel) {
    height: 100%;
  }

  &__view {
    height: 100%;
    box-sizing: border-box;
  }
}
</style>
