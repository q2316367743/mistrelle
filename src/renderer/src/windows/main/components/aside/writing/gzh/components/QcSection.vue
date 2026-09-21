<template>
  <div class="qc-card">
    <div class="qc-card__head">
      <t-button
        size="small"
        variant="text"
        theme="primary"
        :loading="checking"
        :disabled="disabled"
        @click="check"
      >
        运行质检
      </t-button>
      <t-tag v-if="report" size="small" :theme="report.verdict === 'pass' ? 'success' : 'warning'">
        {{ report.verdict === 'pass' ? '全部通过' : '存在未过项' }} · {{ report.words }} 字
      </t-tag>
    </div>
    <div v-if="report" class="qc-card__list">
      <div
        v-for="item in report.items"
        :key="item.key"
        class="qc-item"
        :class="item.pass ? 'is-pass' : 'is-fail'"
      >
        <component :is="item.pass ? CheckCircleIcon : CloseCircleIcon" class="qc-item__icon" />
        <div class="qc-item__body">
          <div class="qc-item__label">{{ item.label }}</div>
          <div v-if="item.note" class="qc-item__note">{{ item.note }}</div>
        </div>
      </div>
    </div>
    <span v-else class="qc-card__hint">
      按公众号成稿清单逐项检查（开头独立 / 有我 / 例子真实 / 边界 / 段落 / 结尾动作 / AI 腔）
    </span>
  </div>
</template>
<script lang="ts" setup>
import { CheckCircleIcon, CloseCircleIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import { gzhComplete, extractGzhJson, type GzhModelRef } from '@/windows/main/modules/gzh/gzhAi'
import { buildQcMessages, type GzhQcResult } from '@/windows/main/modules/gzh/gzhPromptContent'

const props = defineProps<{
  /** 文章标题 */
  title: string
  /** 当前正文（Markdown 原文） */
  content: string
  /** 当前对话模型（最后一条 user 消息，aside 直呼用） */
  model: GzhModelRef
  /** true 时禁用（流式改写中 / 无模型） */
  disabled?: boolean
}>()

const checking = ref(false)
const report = ref<GzhQcResult | null>(null)

const check = async (): Promise<void> => {
  const content = props.content.trim()
  if (!content) {
    MessageUtil.warning('正文为空，先成稿或输入内容')
    return
  }
  if (checking.value) return
  if (!props.model.model || !props.model.provide) {
    MessageUtil.warning('无法确定当前对话模型，先在左侧发送一条消息')
    return
  }
  checking.value = true
  try {
    const { system, messages } = buildQcMessages({ title: props.title, content })
    const text = await gzhComplete({ model: props.model, system, messages })
    const parsed = extractGzhJson<GzhQcResult>(text)
    if (!parsed?.items?.length) {
      MessageUtil.warning('没有解析出质检结果，请重试')
      return
    }
    report.value = parsed
  } catch (e) {
    MessageUtil.error('质检失败', e)
  } finally {
    checking.value = false
  }
}
</script>
<style scoped lang="less">
.qc-card {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__hint {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    line-height: 1.6;
  }
}

.qc-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-secondarycontainer);

  &__icon {
    font-size: 18px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  &.is-pass &__icon {
    color: var(--td-success-color);
  }

  &.is-fail &__icon {
    color: var(--td-error-color);
  }

  &__label {
    font-size: var(--td-font-size-body-medium);
    color: var(--td-text-color-primary);
  }

  &__note {
    margin-top: 2px;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
    line-height: 1.6;
  }
}
</style>
