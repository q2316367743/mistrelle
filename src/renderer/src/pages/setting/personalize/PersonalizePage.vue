<template>
  <page-layout title="个性化">
    <div class="personalize-card">
      <t-tabs v-model="active">
        <t-tab-panel
          v-for="item in PERSONALIZE_FILE_CONFIG"
          :key="item.field"
          :value="item.field"
          :label="item.title"
        >
          <div class="file-editor">
            <div class="file-desc">
              {{ item.description }} · soul/{{ item.file }} · {{ scopeLabel(item.scope) }}
            </div>
            <t-textarea
              v-model="drafts[item.field]"
              class="file-textarea"
              :autosize="{ minRows: 8, maxRows: 20 }"
              :placeholder="item.placeholder"
            />
            <div class="editor-footer">
              <span class="footer-tip">保存后在新一轮对话中生效，文件可直接用编辑器修改</span>
              <t-button
                size="small"
                theme="primary"
                :loading="savingField === item.field"
                :disabled="drafts[item.field] === originals[item.field]"
                @click="onSave(item)"
              >
                保存
              </t-button>
            </div>
          </div>
        </t-tab-panel>
      </t-tabs>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { MessageUtil } from '@/utils/modal'
import { PERSONALIZE_FILE_CONFIG, type PersonalizeFileConfig, type PersonalizeScope } from '@/entity'
import { readPersonalizeFile, writePersonalizeFile } from '@/modules/personalize'

const active = ref(PERSONALIZE_FILE_CONFIG[0].field)
const savingField = ref('')

const drafts = reactive<Record<string, string>>({})
const originals = reactive<Record<string, string>>({})

const scopeLabel = (scope: PersonalizeScope): string => {
  if (scope === 'design') return '仅设计创意 / PPT 对话生效'
  if (scope === 'writing') return '仅写作对话生效'
  return '所有对话生效'
}

const onSave = async (item: PersonalizeFileConfig) => {
  savingField.value = item.field
  try {
    await writePersonalizeFile(item.file, drafts[item.field])
    originals[item.field] = drafts[item.field]
    MessageUtil.success(`「${item.title}」已保存`)
  } catch (e) {
    MessageUtil.error(`「${item.title}」保存失败`, e)
  } finally {
    savingField.value = ''
  }
}

onMounted(() => {
  for (const item of PERSONALIZE_FILE_CONFIG) {
    void readPersonalizeFile(item.file).then((content) => {
      drafts[item.field] = content
      originals[item.field] = content
    })
  }
})
</script>
<style scoped lang="less">
.personalize-card {
  margin: 16px;
  padding: 16px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: var(--td-radius-large);
}

.file-editor {
  padding-top: 12px;
}

.file-desc {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.footer-tip {
  font-size: 12px;
  color: var(--td-text-color-placeholder);
}
</style>
