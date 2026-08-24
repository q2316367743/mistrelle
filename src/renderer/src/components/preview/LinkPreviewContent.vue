<template>
  <div class="link-viewer">
    <div class="link-viewer__toolbar">
      <t-button
        variant="text"
        shape="square"
        size="small"
        :disabled="!canBack"
        class="btn"
        @click="goBack"
      >
        <template #icon><arrow-left-icon /></template>
      </t-button>
      <t-button
        variant="text"
        shape="square"
        size="small"
        class="btn"
        :disabled="!canForward"
        @click="goForward"
      >
        <template #icon><arrow-right-icon /></template>
      </t-button>
      <t-tooltip :content="loading ? '停止加载' : '刷新'">
        <t-button
          variant="text"
          shape="square"
          size="small"
          class="btn"
          @click="loading ? stopLoad() : reload()"
        >
          <template #icon>
            <stop-circle-icon v-if="loading" />
            <refresh-icon v-else />
          </template>
        </t-button>
      </t-tooltip>

      <div class="link-viewer__url" :title="currentUrl">{{ currentUrl }}</div>

      <t-tooltip content="用系统浏览器打开">
        <t-button variant="text" shape="square" size="small" class="btn" @click="openExternal">
          <template #icon><earth-icon /></template>
        </t-button>
      </t-tooltip>
      <t-tooltip content="关闭">
        <t-button variant="text" shape="square" size="small" class="btn" @click="emit('close')">
          <template #icon><close-icon /></template>
        </t-button>
      </t-tooltip>
    </div>

    <div class="link-viewer__progress" :class="{ 'is-loading': loading }"></div>

    <div class="link-viewer__stage">
      <webview
        ref="webviewRef"
        class="link-viewer__frame"
        :src="initialUrl"
        :partition="partition"
        :useragent="browserUa"
        allowpopups
        @did-start-loading="onStartLoading"
        @did-stop-loading="onStopLoading"
        @did-navigate="onNavigated"
        @did-navigate-in-page="onInPageNavigated"
        @did-fail-load="onFailLoad"
      ></webview>

      <div v-if="failed" class="link-viewer__error">
        <span class="link-viewer__error-title">页面加载失败</span>
        <span class="link-viewer__error-desc">{{ failed.desc }}（{{ failed.code }}）</span>
        <div class="link-viewer__error-actions">
          <t-button variant="outline" size="small" @click="reload">重试</t-button>
          <t-button theme="primary" size="small" @click="openExternal">系统浏览器打开</t-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { WebviewTag } from 'electron'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  EarthIcon,
  RefreshIcon,
  StopCircleIcon
} from 'tdesign-icons-vue-next'

const props = withDefaults(
  defineProps<{
    url: string
    /** webview 持久化会话名；沿用默认 session（不写 partition）时拿不到 cookie 持久化 */
    partition?: string
  }>(),
  { partition: 'persist:link-preview' }
)

const emit = defineEmits<{
  close: []
}>()

const webviewRef = ref<WebviewTag | null>(null)
// 仅作初值绑定：src 若跟随地址栏变化会在每次跳转时触发重复加载
const initialUrl = props.url

const currentUrl = ref(props.url)
const loading = ref(false)
const canBack = ref(false)
const canForward = ref(false)
const failed = ref<{ code: number; desc: string } | null>(null)

/**
 * 站点普遍按 UA 拦截 Electron 流量导致白屏，这里基于宿主 Chromium 版本拼出标准 Chrome UA：
 * 截取到 "(KHTML, like Gecko)" 后接 Chrome 版本与 Safari 尾缀；UA 结构不符时退化为仅剔除 Electron 标记
 */
const browserUa = (() => {
  const ua = navigator.userAgent
  const head = ua.match(/^Mozilla\/5\.0 \([^)]*\) AppleWebKit\/[\d.]+ \(KHTML, like Gecko\)/)?.[0]
  const chrome = ua.match(/Chrome\/[\d.]+/)?.[0]
  return head && chrome ? `${head} ${chrome} Safari/537.36` : ua.replace(/\sElectron\/[\d.]+/, '')
})()

/** 主框架导航提交后同步地址栏与后退/前进可用性，并清空上一轮失败态 */
const syncNavigationState = () => {
  const wv = webviewRef.value
  if (!wv) return
  currentUrl.value = wv.getURL()
  canBack.value = wv.canGoBack()
  canForward.value = wv.canGoForward()
}

const onStartLoading = () => {
  loading.value = true
}

const onStopLoading = () => {
  loading.value = false
}

const onNavigated = () => {
  failed.value = null
  syncNavigationState()
}

const onInPageNavigated = () => {
  syncNavigationState()
}

const onFailLoad = (
  e: CustomEvent<{ errorCode: number; errorDescription: string; isMainFrame: boolean }>
) => {
  // -3 为导航中断（如加载中再次跳转），不算失败；仅主框架失败展示错误面板
  if (!e.detail || e.detail.errorCode === -3 || !e.detail.isMainFrame) return
  failed.value = { code: e.detail.errorCode, desc: e.detail.errorDescription }
  loading.value = false
}

const goBack = () => webviewRef.value?.goBack()
const goForward = () => webviewRef.value?.goForward()

const reload = () => {
  failed.value = null
  webviewRef.value?.reload()
}

const stopLoad = () => webviewRef.value?.stop()

const openExternal = () => window.preload.inject.shell.openExternal(currentUrl.value)
</script>

<style scoped lang="less">
.link-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--td-bg-color-container);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--td-component-stroke);
    flex-shrink: 0;
  }

  &__url {
    flex: 1;
    min-width: 0;
    margin: 0 4px;
    padding: 5px 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
    background-color: var(--td-bg-color-secondarycontainer);
    border-radius: var(--td-radius-medium);
    user-select: none;
  }

  // 顶部 2px 不定进度条：加载中从左向右循环推进
  &__progress {
    height: 2px;
    flex-shrink: 0;

    &.is-loading {
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: 40%;
        background-color: var(--td-brand-color);
        animation: link-viewer-progress 1.2s ease-in-out infinite;
      }
    }
  }

  &__stage {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  &__frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  &__error {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background-color: var(--td-bg-color-container);

    &-title {
      font: var(--td-font-title-medium);
      color: var(--td-text-color-primary);
    }

    &-desc {
      max-width: 80%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: var(--td-font-body-small);
      color: var(--td-text-color-placeholder);
    }

    &-actions {
      margin-top: 8px;
      display: flex;
      gap: 8px;
    }
  }
  .btn {
    -webkit-app-region: no-drag;
  }
}

@keyframes link-viewer-progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
</style>