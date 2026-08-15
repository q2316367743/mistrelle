<template>
  <div class="font-meta-content">
    <!-- 添加模式：选中文件列表（表单应用到全部文件） -->
    <div v-if="!editMode" class="font-meta-content__files">
      <div class="font-meta-content__files-title">
        已选 {{ fileList.length }} 个字体文件，下方表单将应用到全部文件
      </div>
      <div
        class="font-meta-content__files-list"
        :class="{ 'font-meta-content__files-list--scroll': fileList.length > 5 }"
      >
        <div v-for="f in fileList" :key="f" class="font-meta-content__file">
          <FileIcon class="font-meta-content__file-icon" />
          <span class="font-meta-content__file-name" :title="f">{{ basename(f) }}</span>
        </div>
      </div>
    </div>

    <!-- 编辑模式：字体名 -->
    <div v-else class="font-meta-content__font-name">{{ font?.name }}</div>

    <t-form label-align="top" class="font-meta-content__form">
      <t-form-item label="字体类型">
        <t-select v-model="meta.type" :options="FONT_TYPE_SELECT" />
      </t-form-item>
      <t-form-item label="字体风格">
        <t-select v-model="meta.style" :options="FONT_STYLE_SELECT" />
      </t-form-item>
      <t-form-item label="字体字重">
        <t-select v-model="meta.weight" :options="FONT_WEIGHT_SELECT" />
      </t-form-item>
      <t-form-item label="授权类型">
        <t-select v-model="meta.license" :options="FONT_LICENSE_SELECT" />
      </t-form-item>
      <t-form-item label="字体语言">
        <t-select v-model="meta.language" :options="FONT_LANG_SELECT" />
      </t-form-item>
    </t-form>

    <div class="font-meta-content__actions">
      <t-button variant="outline" :disabled="loading" @click="emit('close')">取消</t-button>
      <t-button theme="primary" :loading="loading" @click="handleSubmit">{{
        editMode ? '保存' : '入库'
      }}</t-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { FileIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import {
  FONT_LANG_SELECT,
  FONT_LICENSE_SELECT,
  FONT_STYLE_SELECT,
  FONT_TYPE_SELECT,
  FONT_WEIGHT_SELECT,
  inferFontMeta,
  normalizeMetaInput
} from '@/utils/fontMeta'
import { FontItemWithMeta } from '@/domain/FontItem'

interface FontMetaForm {
  type: string
  style: string
  weight: string
  license: string
  language: string
}

const props = defineProps<{
  /** 添加模式：待入库字体文件绝对路径列表 */
  files?: string[]
  /** 编辑模式：已存在字体（资源库或系统字体），需展示其当前分类 */
  font?: FontItemWithMeta
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', result: { added?: number; name?: string }): void
}>()

const editMode = computed(() => !!props.font)
const fileList = computed(() => props.files ?? [])

const basename = (path: string): string => path.replace(/\\/g, '/').split('/').pop() ?? path

const buildMeta = (): FontMetaForm => {
  if (props.font) {
    return { ...inferFontMeta(props.font.name), ...props.font.meta }
  }
  const first = props.files?.[0]
  return { ...inferFontMeta(first ? basename(first) : '') }
}

const meta = reactive<FontMetaForm>(buildMeta())
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  try {
    if (editMode.value && props.font) {
      const result = await window.preload.font.updateFontMeta(
        props.font.name,
        normalizeMetaInput(meta)
      )
      if ('error' in result && result.error) {
        MessageUtil.error(result.error)
        return
      }
      MessageUtil.success(`已更新「${props.font.name}」字体信息`)
      emit('success', { name: props.font.name })
      return
    }
    const files = props.files ?? []
    const failed: string[] = []
    for (const path of files) {
      const result = await window.preload.font.addFont(path, normalizeMetaInput(meta))
      if ('error' in result && result.error) failed.push(`${basename(path)}: ${result.error}`)
    }
    const added = files.length - failed.length
    if (added > 0)
      MessageUtil.success(
        `已入库 ${added} 个字体${failed.length ? `，失败 ${failed.length} 个` : ''}`
      )
    if (failed.length) MessageUtil.error(failed.join('\n'))
    emit('success', { added })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="less">
.font-meta-content {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &__files {
    padding: 12px;
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-secondarycontainer);
  }

  &__files-title {
    margin-bottom: 8px;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__files-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 160px;
    overflow-y: auto;
  }

  &__file {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  &__file-icon {
    flex: none;
    color: var(--td-text-color-secondary);
  }

  &__file-name {
    font: var(--td-font-body-small);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__font-name {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__form {
    display: flex;
    flex-direction: column;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
