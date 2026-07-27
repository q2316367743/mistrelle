<template>
  <div class="monaco-editor" :style="{ width: '100%', height: height }">
    <div ref="codeEditBox" class="codeEditBox"></div>
  </div>
</template>

<script lang="ts" setup>
import * as monaco from 'monaco-editor'
import { isDark } from '@/global/BeanFactory'

const props = defineProps({
  value: String,
  language: {
    type: String as PropType<string>,
    default: 'javascript'
  },
  height: {
    type: String,
    default: '100%'
  },
  minimap: {
    type: Boolean,
    default: true
  },
  wordWrap: {
    type: Boolean,
    default: true
  }
})
const emit = defineEmits(['change', 'editor-mounted'])

let editor: monaco.editor.IStandaloneCodeEditor | null = null
const codeEditBox = ref()

const size = useElementSize(codeEditBox)

watch(
  () => size.width.value,
  () => editor?.layout()
)
watch(
  () => size.height.value,
  () => editor?.layout()
)

const init = () => {
  editor = monaco.editor.create(codeEditBox.value, {
    value: props.value,
    language: props.language,
    theme: isDark.value ? 'vs-dark' : 'vs',
    readOnly: true,
    minimap: {
      enabled: props.minimap
    },
    wordWrap: props.wordWrap ? 'on' : 'off'
  })

  // v-model 外部变更 → 同步到编辑器（值比较防循环）
  watch(
    () => props.value,
    (newVal) => {
      if (!editor) return
      if (editor.getValue() !== newVal) {
        editor.setValue(newVal || '')
      }
    }
  )

  watch(
    () => props.language,
    (value) => {
      if (!editor) return
      monaco.editor.setModelLanguage(editor.getModel()!, value)
    }
  )

  watch(
    () => isDark.value,
    (value) => {
      if (!editor) return
      editor.updateOptions({ theme: value ? 'vs-dark' : 'vs' })
    }
  )
}

onMounted(() => init())
</script>
<style lang="less" scoped>
.codeEditBox {
  position: relative;
  width: 100%;
  height: 100%;
}
.monaco-editor {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: var(--td-radius-medium);
  overflow: hidden;
}
</style>
