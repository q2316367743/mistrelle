<template>
  <div class="put-content">
    <t-tabs v-model="activeTab" class="put-content__tabs">
      <t-tab-panel value="basic" label="基础信息">
        <t-form class="put-content__form">
          <t-form-item label="风格名称" name="name">
            <t-input v-model="form.name" placeholder="请输入风格名称" />
          </t-form-item>
          <t-form-item label="简介" name="description">
            <t-textarea
              v-model="form.description"
              placeholder="一句话简介，展示在卡片下方"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </t-form-item>
          <t-form-item label="适用场景" name="category">
            <t-select v-model="form.category" :options="DESIGN_STYLE_CATEGORY_OPTIONS" />
          </t-form-item>
          <t-form-item label="标签" name="tags">
            <t-tag-input v-model="form.tags" placeholder="输入后回车添加标签" clearable />
          </t-form-item>
          <t-form-item label="别名" name="aliases" help="口头点名匹配，如「瑞士」「国际主义」">
            <t-tag-input v-model="form.aliases" placeholder="输入后回车添加别名" clearable />
          </t-form-item>
          <t-form-item
            label="签名手法"
            name="signature"
            help="本风格独有的那一招；只换色板不算换风格"
          >
            <t-textarea
              v-model="form.signature"
              placeholder="写清可执行的图层动作，如：贯穿 1px 横线切开标题与内容…"
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </t-form-item>
          <t-form-item label="留白档位" name="whitespaceRatio">
            <t-select v-model="form.whitespaceRatio" :options="DESIGN_STYLE_WHITESPACE_OPTIONS" />
          </t-form-item>
          <t-form-item label="常用画幅" name="preferredFormats" help="如 3:4、1.91:1、1:1">
            <t-tag-input
              v-model="form.preferredFormats"
              placeholder="输入比例后回车，如 3:4"
              clearable
            />
          </t-form-item>
          <t-form-item label="适合" name="suitableFor">
            <t-input v-model="form.suitableFor" placeholder="适用场景简述" />
          </t-form-item>
          <t-form-item label="不适合" name="unsuitableFor">
            <t-input v-model="form.unsuitableFor" placeholder="禁忌场景简述" />
          </t-form-item>
        </t-form>
      </t-tab-panel>

      <t-tab-panel value="prompt" label="视觉提示">
        <t-form class="put-content__form">
          <t-form-item
            label="正向风格描述词"
            name="visualPrompt"
            help="描述构图、光影、材质、氛围，Agent 生图时读取"
          >
            <t-textarea
              v-model="form.visualPrompt"
              placeholder="描述构图、光影、材质、氛围…"
              :autosize="{ minRows: 6, maxRows: 12 }"
            />
          </t-form-item>
          <t-form-item label="反向排除词" name="negativePrompt" help="告诉 AI 不要出现什么">
            <t-textarea
              v-model="form.negativePrompt"
              placeholder="告诉 AI 不要出现什么…"
              :autosize="{ minRows: 4, maxRows: 8 }"
            />
          </t-form-item>
        </t-form>
      </t-tab-panel>

      <t-tab-panel value="color" label="配色方案">
        <color-palette-fields :palette="form.colorPalette" />
      </t-tab-panel>

      <t-tab-panel value="typography" label="字体规范">
        <typography-fields :typography="form.typography" />
      </t-tab-panel>

      <t-tab-panel value="layout" label="布局规则">
        <div class="put-layout">
          <div v-for="(_rule, idx) in form.layoutRules" :key="idx" class="put-layout__row">
            <t-input v-model="form.layoutRules[idx]" placeholder="输入一条布局硬约束" />
            <t-button theme="danger" variant="text" shape="square" @click="removeRule(idx)">
              <template #icon><DeleteIcon /></template>
            </t-button>
          </div>
          <t-button theme="default" variant="outline" @click="addRule">
            <template #icon><AddIcon /></template>
            添加规则
          </t-button>
        </div>
      </t-tab-panel>

      <t-tab-panel value="tokens" label="细节规范">
        <token-fields :tokens="form.tokens" />
      </t-tab-panel>
    </t-tabs>

    <div class="put-content__footer">
      <t-button theme="default" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="saving" @click="handleSave">保存</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { AddIcon, DeleteIcon } from 'tdesign-icons-vue-next'
import {
  AiDesignStyleForm,
  DESIGN_STYLE_CATEGORY_OPTIONS,
  DESIGN_STYLE_WHITESPACE_OPTIONS
} from '@/entity'
import { useDesignStyleStore } from '@/windows/main/store'
import { MessageUtil } from '@/utils/modal'
import ColorPaletteFields from './ColorPaletteFields.vue'
import TypographyFields from './TypographyFields.vue'
import TokenFields from './TokenFields.vue'

const props = defineProps<{ form: AiDesignStyleForm; styleId?: string }>()
const emit = defineEmits<{ close: []; success: [] }>()

const store = useDesignStyleStore()
const saving = ref(false)
const activeTab = ref('basic')

/** 深拷贝一份表单用于编辑，避免直接改动外壳传入的对象 */
const form = reactive<AiDesignStyleForm>(structuredClone(props.form))

const addRule = () => form.layoutRules.push('')
const removeRule = (idx: number) => form.layoutRules.splice(idx, 1)

const handleSave = async () => {
  if (!form.name.trim()) {
    MessageUtil.error('请填写风格名称')
    return
  }
  saving.value = true
  try {
    await store.put(form, props.styleId)
    emit('success')
  } catch (e) {
    MessageUtil.error('保存失败', e)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="less">
.put-content {
  display: flex;
  flex-direction: column;
  height: 100%;

  &__tabs {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  &__form {
    padding-top: 8px;
    max-width: 560px;
  }

  &__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 0 0;
    border-top: 1px solid var(--td-component-stroke);
  }
}

.put-layout {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  max-width: 560px;

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
