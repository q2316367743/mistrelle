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

      <t-form label-align="top" class="put-content__code">
        <t-form-item label="HTML 模板（进阶，留空使用默认骨架）">
          <t-textarea
            v-model="form.template"
            class="put-content__mono"
            :autosize="{ minRows: 4, maxRows: 12 }"
            placeholder='<div class="my-card">…<div data-nc="content"></div>…</div>'
          />
        </t-form-item>
        <t-form-item label="自定义 CSS（最后注入，可覆盖上方所有规则）">
          <t-textarea
            v-model="form.css"
            class="put-content__mono"
            :autosize="{ minRows: 4, maxRows: 12 }"
            placeholder='.my-card{background:linear-gradient(…)}'
          />
        </t-form-item>
        <t-collapse expand-mutex>
          <t-collapse-panel value="contract" header="插槽契约与可用类名说明">
            <pre class="put-content__hint">{{ SLOT_DOC }}</pre>
          </t-collapse-panel>
        </t-collapse>
      </t-form>

      <div class="put-content__footer">
        <t-button variant="outline" @click="emit('close')">取消</t-button>
        <t-button theme="primary" :loading="saving" @click="handleSave">保存</t-button>
      </div>
    </div>

    <div class="put-content__preview">
      <div class="put-content__preview-sticky">
        <note-card-renderer
          :style-props="form.props"
          :template="form.template"
          :extra-css="form.css"
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
import { reactive, ref } from 'vue'
import { AiCardStyleForm } from '@/entity'
import { MessageUtil } from '@/utils/modal'
import { useCardStyleStore } from '@/windows/main/store'
import {
  describeCardStyleCss,
  describeCardStyleSlots
} from '@/global/card-style-template'
import NoteCardRenderer from '@/components/card/NoteCardRenderer.vue'
import { markdownToBlocks } from '@/components/card/note-markdown'
import CardStylePropsForm from '../components/CardStylePropsForm.vue'

/**
 * 卡片风格新建 / 编辑抽屉内容：左侧基础信息 + 注册表样式表单 + 自由层（模板/CSS）编辑，
 * 右侧实时预览。外壳仅传入初始值（单向数据流），编辑全部发生在本地副本，保存写本地副本。
 */
const props = defineProps<{ initial: AiCardStyleForm; styleId?: string }>()
const emit = defineEmits<{ close: []; success: [] }>()

const store = useCardStyleStore()
const saving = ref(false)

/** 深拷贝初始表单（tags / props 是引用类型，需单独复制） */
const cloneInitial = (source: AiCardStyleForm): AiCardStyleForm => ({
  ...source,
  tags: [...source.tags],
  props: { ...source.props }
})

/** 本地编辑状态（唯一可变数据源） */
const form = reactive(cloneInitial(props.initial))

/** 插槽契约与自定义 CSS 说明（表单折叠面板展示） */
const SLOT_DOC = [describeCardStyleSlots(), '', describeCardStyleCss()].join('\n')

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
  if (!form.name.trim()) {
    MessageUtil.warning('请填写风格名称')
    return
  }
  saving.value = true
  try {
    const id = await store.put(form, props.styleId)
    if (!id) {
      MessageUtil.error('保存失败：内置预设只读，不可覆盖')
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

  &__code {
    margin-top: 20px;
  }

  &__mono {
    :deep(textarea) {
      font-family: Menlo, Consolas, monospace;
      font-size: 12px;
    }
  }

  &__hint {
    margin: 0;
    font-family: Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    color: var(--td-text-color-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
