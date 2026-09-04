<template>
  <div class="file-preview">
    <div v-if="withModeSwitch" class="file-preview__toolbar">
      <t-button
        size="small"
        :variant="mode === 'preview' ? 'base' : 'text'"
        @click="setMode('preview')"
      >
        预览
      </t-button>
      <t-button
        size="small"
        :variant="mode === 'source' ? 'base' : 'text'"
        @click="setMode('source')"
      >
        源码
      </t-button>
    </div>

    <div v-if="kind === 'markdown'" class="file-preview__body">
      <div v-if="mode === 'preview'" class="file-preview__scroll">
        <ChatContent :content="content ?? ''" />
      </div>
      <MonacoEditorView
        v-else
        :value="content ?? ''"
        language="markdown"
        height="60vh"
        :minimap="false"
      />
    </div>

    <div v-else-if="kind === 'code'" class="file-preview__body">
      <MonacoEditorView
        :value="content ?? ''"
        :language="language ?? 'plaintext'"
        height="60vh"
        :minimap="false"
      />
    </div>

    <div v-else-if="kind === 'image'" class="file-preview__body file-preview__center">
      <img :src="src" :alt="fileName" class="file-preview__media" />
    </div>

    <div v-else-if="kind === 'video'" class="file-preview__body file-preview__center">
      <video :src="src" controls class="file-preview__media" />
    </div>

    <div v-else-if="kind === 'audio'" class="file-preview__body file-preview__center">
      <audio :src="src" controls class="file-preview__audio" />
    </div>

    <div v-else-if="kind === 'html'" class="file-preview__body">
      <template v-if="mode === 'preview'">
        <webview
          v-if="!htmlFailed"
          class="file-preview__frame"
          :src="src"
          allowpopups
          @did-fail-load="onHtmlFailLoad"
        ></webview>
        <div v-else class="file-preview__error">
          <span class="file-preview__error-title">页面加载失败</span>
          <t-button variant="outline" size="small" @click="retryHtml">重试</t-button>
        </div>
      </template>
      <template v-else>
        <div v-if="sourceLoading" class="file-preview__center">加载中…</div>
        <MonacoEditorView
          v-else
          :value="sourceContent"
          language="html"
          height="60vh"
          :minimap="false"
        />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ChatContent } from '@tdesign-vue-next/chat'
import MonacoEditorView from '@/components/view/MonacoEditorView.vue'
import { MessageUtil } from '@/utils/modal'

export type FilePreviewKind = 'markdown' | 'code' | 'image' | 'video' | 'audio' | 'html'

const props = withDefaults(
  defineProps<{
    kind: FilePreviewKind
    fileName: string
    fullPath: string
    /** markdown / code：外壳已读取的文本内容 */
    content?: string
    /** image / video / audio / html：本地事件服务资源地址（pathToHref） */
    src?: string
    /** code：Monaco 语言 */
    language?: string
  }>(),
  { content: '', src: '', language: 'plaintext' }
)

const withModeSwitch = computed(() => props.kind === 'markdown' || props.kind === 'html')
const mode = ref<'preview' | 'source'>('preview')

// html 源码按需读取（外壳不预读，渲染预览本身不需要文本）
const sourceContent = ref('')
const sourceLoading = ref(false)

const setMode = async (m: 'preview' | 'source') => {
  mode.value = m
  if (m === 'source' && props.kind === 'html' && !sourceContent.value && !sourceLoading.value) {
    sourceLoading.value = true
    try {
      sourceContent.value = await window.preload.fs.readTextFile(props.fullPath)
    } catch {
      MessageUtil.error('无法读取文件')
    } finally {
      sourceLoading.value = false
    }
  }
}

const htmlFailed = ref(false)

const onHtmlFailLoad = (
  e: CustomEvent<{ errorCode: number; errorDescription: string; isMainFrame: boolean }>
) => {
  // -3 为导航中断，不算失败；仅主框架失败展示错误态
  if (!e.detail || e.detail.errorCode === -3 || !e.detail.isMainFrame) return
  htmlFailed.value = true
}

const retryHtml = () => {
  htmlFailed.value = false
}
</script>

<style scoped lang="less">
.file-preview {
  width: calc(100% - 2px);

  &__toolbar {
    display: flex;
    gap: 4px;
    margin-bottom: var(--td-comp-margin-s);
  }

  &__body {
    min-height: 0;
  }

  &__scroll {
    max-height: 60vh;
    overflow: auto;
    padding: 4px 0;
  }

  &__center {
    display: flex;
    justify-content: center;
  }

  &__media {
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border-radius: var(--td-radius-medium);
  }

  &__audio {
    width: 100%;
    padding: var(--td-comp-paddingTB-xl) 0;
  }

  &__frame {
    display: block;
    width: 100%;
    height: 60vh;
  }

  &__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 60vh;
    background-color: var(--td-bg-color-container);

    &-title {
      font: var(--td-font-title-medium);
      color: var(--td-text-color-primary);
    }
  }
}
</style>
