<template>
  <div class="article-aside-footer">
    <!-- 预留：接入流式「去 AI 味」接口后启用（输入正文 → 流式输出去 AI 味内容） -->
    <t-tooltip content="流式接口暂未开放，敬请期待">
      <div class="footer-item">
        <t-button block disabled>
          <template #icon><ai-edit-icon /></template>
          去 AI 味
        </t-button>
      </div>
    </t-tooltip>
    <t-tooltip content="朱雀检测需企业认证接入，暂未开放">
      <div class="footer-item">
        <t-button block disabled>
          <template #icon><fact-check-icon /></template>
          AI 检测
        </t-button>
      </div>
    </t-tooltip>
  </div>
</template>
<script lang="ts" setup>
import { AiEditIcon, FactCheckIcon } from 'tdesign-icons-vue-next'
</script>
<style scoped lang="less">
.article-aside-footer {
  margin-top: 8px;
  display: flex;
  gap: 8px;

  .footer-item {
    flex: 1;
    min-width: 0;
  }
}
</style>
