<template>
  <t-form
    ref="formRef"
    class="article-content"
    :data="form"
    :rules="rules"
    :label-width="0"
  >
    <t-form-item name="title">
      <t-input v-model="form.title" placeholder="文章标题" clearable />
    </t-form-item>
    <t-form-item name="platform">
      <t-select v-model="form.platform" :options="PLATFORM_OPTIONS" placeholder="目标平台" />
    </t-form-item>
    <t-form-item name="summary">
      <t-textarea
        v-model="form.summary"
        placeholder="一句话选题 / 摘要（可选）"
        :autosize="{ minRows: 2, maxRows: 4 }"
      />
    </t-form-item>
    <t-form-item name="outline">
      <t-textarea
        v-model="form.outline"
        placeholder="文章提纲（可选）"
        :autosize="{ minRows: 3, maxRows: 8 }"
      />
    </t-form-item>
    <t-form-item>
      <div class="article-content__actions">
        <t-button theme="default" variant="outline" @click="$emit('close')">取消</t-button>
        <t-button theme="primary" @click="handleSubmit">创建</t-button>
      </div>
    </t-form-item>
  </t-form>
</template>
<script lang="ts" setup>
import type { FormInstanceFunctions } from 'tdesign-vue-next'
import type { ArticleCreateInput, ArticlePlatform } from '@/modules/tool/components/article/articleTypes'

const emit = defineEmits<{
  (e: 'submit', input: ArticleCreateInput): void
  (e: 'close'): void
}>()

const PLATFORM_OPTIONS: Array<{ label: ArticlePlatform; value: ArticlePlatform }> = [
  { label: '公众号', value: '公众号' },
  { label: '知乎', value: '知乎' },
  { label: '小红书', value: '小红书' },
  { label: '其他', value: '其他' }
]

const formRef = ref<FormInstanceFunctions>()

const form = reactive({
  title: '',
  platform: '公众号' as ArticlePlatform,
  summary: '',
  outline: ''
})

const rules = {
  title: [{ required: true, message: '请填写文章标题', type: 'error' as const }]
}

const handleSubmit = async () => {
  const result = await formRef.value?.validate?.()
  if (result !== true) return
  emit('submit', {
    title: form.title.trim(),
    platform: form.platform,
    summary: form.summary.trim() || undefined,
    outline: form.outline.trim() || undefined
  })
}

defineExpose({ formRef })
</script>
<style scoped lang="less">
.article-content {
  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    width: 100%;
  }
}
</style>
