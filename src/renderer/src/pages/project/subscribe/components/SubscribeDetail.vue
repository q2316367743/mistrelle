<template>
  <div class="subscribe-detail">
    <div class="subscribe-detail__header">
      <t-button variant="text" shape="square" @click="emit('back')">
        <template #icon><ArrowLeftIcon /></template>
      </t-button>
      <div class="subscribe-detail__titles">
        <span class="subscribe-detail__title">{{ item.title }}</span>
        <span class="subscribe-detail__date">{{ item.publishDate || '' }}</span>
      </div>
      <t-tag :theme="SUBSCRIBE_STATUS_META[item.status].theme" variant="light">
        {{ SUBSCRIBE_STATUS_META[item.status].label }}
      </t-tag>
      <t-dropdown :popup-props="{ trigger: 'click' }">
        <t-button variant="text" shape="square">
          <template #icon><MoreIcon /></template>
        </t-button>
        <t-dropdown-menu>
          <t-dropdown-item theme="error" @click="emit('remove')">删除订阅</t-dropdown-item>
        </t-dropdown-menu>
      </t-dropdown>
    </div>

    <div v-if="item.error" class="subscribe-detail__error">
      <t-tag theme="danger" variant="light">{{ item.error }}</t-tag>
    </div>

    <div class="subscribe-detail__actions">
      <t-button theme="primary" :loading="action === 'process'" @click="handleProcess">
        <template #icon><PlayCircleIcon /></template>
        一键处理
      </t-button>
      <t-button variant="outline" :loading="action === 'download'" @click="runAction('download', () => subscribeDownload(projectId, blogger.id, item.id))">
        下载
      </t-button>
      <t-button variant="outline" :loading="action === 'extract'" @click="runAction('extract', () => subscribeExtractAudio(projectId, blogger.id, item.id))">
        提取音频
      </t-button>
      <t-button variant="outline" :loading="action === 'transcribe'" @click="runAction('transcribe', () => subscribeTranscribe(projectId, blogger.id, item.id, blogger.recognize))">
        转写
      </t-button>
      <t-button variant="outline" :loading="action === 'summarize'" @click="runAction('summarize', () => subscribeSummarize(projectId, blogger.id, item.id))">
        总结
      </t-button>
      <t-button variant="text" shape="square" @click="openDir">
        <template #icon><FolderOpenIcon /></template>
      </t-button>
    </div>

    <div class="subscribe-detail__body">
      <section class="subscribe-detail__section">
        <div class="subscribe-detail__label">视频</div>
        <video v-if="hasVideo" :src="videoHref" controls class="subscribe-detail__video" />
        <t-empty v-else title="未下载视频" description="点击上方「下载」或「一键处理」" />
      </section>

      <section class="subscribe-detail__section">
        <div class="subscribe-detail__label">音频</div>
        <audio v-if="hasAudio" :src="audioHref" controls class="subscribe-detail__audio" />
        <t-empty v-else title="未提取音频" description="点击上方「提取音频」或「一键处理」" />
      </section>

      <section class="subscribe-detail__section">
        <div class="subscribe-detail__label">总结</div>
        <pre v-if="summaryContent" class="subscribe-detail__content">{{ summaryContent }}</pre>
        <t-empty v-else title="暂无总结" description="转写完成后点击「总结」生成" />
      </section>

      <t-collapse v-model="collapseValue" class="subscribe-detail__collapse">
        <t-collapse-panel value="text" header="转写文案">
          <pre v-if="textContent" class="subscribe-detail__content">{{ textContent }}</pre>
          <t-empty v-else title="暂无转写文案" description="下载音频后点击「转写」生成" />
        </t-collapse-panel>
      </t-collapse>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { ArrowLeftIcon, FolderOpenIcon, MoreIcon, PlayCircleIcon } from 'tdesign-icons-vue-next'
import type { SubscribeBlogger, SubscribeItem } from '@/entity/project/Subscribe'
import {
  buildSubscribeVideoDir,
  buildSubscribeMediaPath,
  subscribeDownload,
  subscribeExtractAudio,
  subscribeProcessItem,
  subscribeSummarize,
  subscribeTranscribe
} from '@/modules/subscribe'
import { subscribeFileHref, subscribeMediaExists } from '@/modules/subscribe'
import { SUBSCRIBE_STATUS_META } from '@/modules/subscribe'
import { MessageUtil } from '@/utils/modal'

const props = defineProps<{
  projectId: string
  blogger: SubscribeBlogger
  item: SubscribeItem
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'refresh'): void
  (e: 'remove'): void
}>()

const action = ref('')
const collapseValue = ref(['text'])
const summaryContent = ref('')
const textContent = ref('')

const videoPath = computed(() =>
  buildSubscribeMediaPath(props.projectId, props.blogger.id, props.item.id, 'video.mp4')
)
const audioPath = computed(() =>
  buildSubscribeMediaPath(props.projectId, props.blogger.id, props.item.id, 'audio.mp3')
)
const textPath = computed(() =>
  buildSubscribeMediaPath(props.projectId, props.blogger.id, props.item.id, 'text.md')
)
const summaryPath = computed(() =>
  buildSubscribeMediaPath(props.projectId, props.blogger.id, props.item.id, 'summary.md')
)

const hasVideo = computed(() => subscribeMediaExists(props.projectId, props.blogger.id, props.item.id, 'video.mp4'))
const hasAudio = computed(() => subscribeMediaExists(props.projectId, props.blogger.id, props.item.id, 'audio.mp3'))
const videoHref = computed(() => (hasVideo.value ? subscribeFileHref(videoPath.value) : ''))
const audioHref = computed(() => (hasAudio.value ? subscribeFileHref(audioPath.value) : ''))

const loadContent = async () => {
  summaryContent.value = window.preload.fs.existsSync(summaryPath.value)
    ? await window.preload.fs.readTextFile(summaryPath.value)
    : ''
  textContent.value = window.preload.fs.existsSync(textPath.value)
    ? await window.preload.fs.readTextFile(textPath.value)
    : ''
}

watch(
  () => props.item.id,
  () => {
    loadContent()
  },
  { immediate: true }
)

const runAction = async (name: string, fn: () => Promise<void>) => {
  if (action.value) return
  action.value = name
  try {
    await fn()
    MessageUtil.success('操作完成')
    emit('refresh')
    await loadContent()
  } catch (e) {
    MessageUtil.error('操作失败', e)
  } finally {
    action.value = ''
  }
}

const handleProcess = () => runAction('process', () => subscribeProcessItem(props.projectId, props.blogger.id, props.item.id))

const openDir = () => {
  window.preload.inject.shell.openPath(buildSubscribeVideoDir(props.projectId, props.blogger.id, props.item.id))
}
</script>
<style scoped lang="less">
.subscribe-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 12px;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    flex-shrink: 0;
  }

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  &__title {
    font: var(--td-font-title-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__date {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  &__error {
    flex-shrink: 0;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  &__body {
    flex: 1;
    overflow-y: auto;
  }

  &__section {
    margin-bottom: 16px;
  }

  &__label {
    font: var(--td-font-title-small);
    color: var(--td-text-color-primary);
    margin-bottom: 8px;
  }

  &__video {
    width: 100%;
    max-height: 320px;
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-component);
  }

  &__audio {
    width: 100%;
  }

  &__content {
    margin: 0;
    padding: 12px;
    border-radius: var(--td-radius-medium);
    background-color: var(--td-bg-color-secondarycontainer);
    font-family: var(--td-font-family);
    font-size: 13px;
    line-height: 1.7;
    color: var(--td-text-color-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__collapse {
    margin-bottom: 16px;
  }
}
</style>
