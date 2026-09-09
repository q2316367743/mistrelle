<template>
  <div class="article-style-panel">
    <div class="field">
      <label class="field-label">目标平台</label>
      <t-select
        :value="article.platform"
        :options="PLATFORM_OPTIONS"
        @change="(v: unknown) => typeof v === 'string' && emit('patch', { platform: v as ArticlePlatform })"
      />
    </div>
    <div class="field">
      <label class="field-label">写作风格</label>
      <t-select
        :value="article.style ?? ''"
        :options="styleOptions"
        :placeholder="`预设或自定义描述${article.style ? '' : '（未设置）'}`"
        filterable
        creatable
        clearable
        @change="(v: unknown) => emit('patch', { style: typeof v === 'string' && v ? v : undefined })"
      />
      <div class="field-tip">预设词汇或自定义描述（如「闺蜜口吻」），AI 撰写 / 改写时严格遵循</div>
    </div>
    <div class="field">
      <label class="field-label">文章状态</label>
      <t-select
        :value="article.status"
        :options="STATUS_OPTIONS"
        @change="(v: unknown) => typeof v === 'string' && emit('patch', { status: v as ArticleStatus })"
      />
    </div>
    <t-button block theme="primary" @click="emit('rewrite')">
      <template #icon><ai-icon /></template>
      按当前风格重写正文
    </t-button>
    <div class="field-tip">指令将填入聊天输入框，可修改后发送；修改平台 / 风格立即保存生效</div>
  </div>
</template>
<script lang="ts" setup>
import { AiIcon } from 'tdesign-icons-vue-next'
import type {
  ArticleItem,
  ArticlePlatform,
  ArticleStatus,
  ArticleUpdatePatch
} from '@/windows/main/modules/tool/components/article/articleTypes'
import { ARTICLE_STYLE_PRESETS } from '@/windows/main/modules/tool/components/article/articleTypes'

const props = defineProps<{
  article: ArticleItem
}>()

const emit = defineEmits<{
  /** 元数据变更上抛（由父级写回 store，与 AI 工具共享同一响应式实例） */
  (e: 'patch', patch: ArticleUpdatePatch): void
  (e: 'rewrite'): void
}>()

const PLATFORM_OPTIONS: Array<{ label: string; value: ArticlePlatform }> = [
  { label: '公众号', value: '公众号' },
  { label: '知乎', value: '知乎' },
  { label: '小红书', value: '小红书' },
  { label: '其他', value: '其他' }
]

const STATUS_OPTIONS: Array<{ label: string; value: ArticleStatus }> = [
  { label: '草稿', value: 'draft' },
  { label: '写作中', value: 'writing' },
  { label: '已完稿', value: 'done' }
]

/** 风格预设跟随平台切换；creatable 支持自定义描述（清空 = 未设置） */
const styleOptions = computed(() =>
  (ARTICLE_STYLE_PRESETS[props.article.platform] ?? []).map((label) => ({ label, value: label }))
)
</script>
<style scoped lang="less">
.article-style-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
  color: var(--td-text-color-primary);
}

.field-tip {
  font-size: var(--td-font-size-body-small);
  color: var(--td-text-color-placeholder);
  line-height: 1.5;
}
</style>
