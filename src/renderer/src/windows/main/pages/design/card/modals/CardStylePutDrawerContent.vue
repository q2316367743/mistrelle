<template>
  <div class="put-content">
    <div class="put-content__form">
      <t-form label-align="top">
        <t-form-item label="风格名称">
          <t-input v-model="form.name" placeholder="如：杂志刊头" :maxlength="30" />
        </t-form-item>
        <t-form-item label="一句话简介">
          <t-input v-model="form.description" placeholder="展示在卡片列表下方" :maxlength="60" />
        </t-form-item>
        <t-form-item label="标签">
          <t-tag-input v-model="form.tags" clearable placeholder="回车添加标签" />
        </t-form-item>
      </t-form>

      <card-style-props-form v-model="form.props" />

      <div class="put-content__footer">
        <t-button variant="outline" @click="emit('close')">取消</t-button>
        <t-button theme="primary" :loading="saving" @click="handleSave">保存</t-button>
      </div>
    </div>

    <div class="put-content__preview">
      <div class="put-content__preview-sticky">
        <note-card-renderer
          :style-props="form.props"
          :blocks="SAMPLE_BLOCKS"
          author="山月"
          watermark="@半窗烟雨 · 笔记卡片"
          fixed
        />
        <div class="put-content__preview-tip">实时预览</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { AiCardStyleForm } from '@/entity'
import { MessageUtil } from '@/utils/modal'
import { useCardStyleStore } from '@/windows/main/store'
import NoteCardRenderer from '@/components/card/NoteCardRenderer.vue'
import { markdownToBlocks } from '@/components/card/note-markdown'
import CardStylePropsForm from '../components/CardStylePropsForm.vue'

/**
 * 卡片风格新建 / 编辑抽屉内容：左侧基础信息 + 注册表驱动的样式表单，右侧实时预览。
 */
const props = defineProps<{ form: AiCardStyleForm; styleId?: string }>()
const emit = defineEmits<{ close: []; success: [] }>()

const store = useCardStyleStore()
const saving = ref(false)

/** 与风格预览面同一份示例内容，保证编辑所见与列表所见一致 */
const SAMPLE_BLOCKS = markdownToBlocks(
  [
    '## 周末去了趟青云山',
    '',
    '山里的空气特别清新，**云海**在脚下慢慢流动，走到一半突然放晴。',
    '',
    '> 最好的风景，总在人少的地方。',
    '',
    '- 全程步行约 8 公里',
    '- 山顶的日出值得早起',
    '',
    '==下次还来=='
  ].join('\n')
)

const handleSave = async () => {
  if (!props.form.name.trim()) {
    MessageUtil.warning('请填写风格名称')
    return
  }
  saving.value = true
  try {
    const id = await store.put(props.form, props.styleId)
    if (!id) {
      MessageUtil.error('保存失败：内置预设只读，或当前档位不支持自定义卡片风格')
      return
    }
    MessageUtil.success(props.styleId ? '修改成功' : '创建成功')
    emit('success')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.put-content {
  display: flex;
  gap: 20px;
  height: 100%;

  &__form {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding-right: 4px;
    padding-bottom: 56px;
  }

  &__footer {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 0;
    margin-top: 20px;
    background: var(--td-bg-color-container);
    border-top: 1px solid var(--td-component-stroke);
  }

  &__preview {
    width: 280px;
    flex-shrink: 0;
    overflow-y: auto;
  }

  &__preview-sticky {
    position: sticky;
    top: 0;
  }

  &__preview-tip {
    margin-top: 8px;
    text-align: center;
    font: var(--td-font-body-small);
    color: var(--td-text-color-placeholder);
  }
}
</style>
