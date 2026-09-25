<template>
  <page-layout title="去 AI 味儿">
    <div class="humanize-page">
      <div class="humanize-page__panes">
        <section class="humanize-pane">
          <header class="humanize-pane__head">
            <span class="humanize-pane__title">原文（Markdown）</span>
            <div class="humanize-pane__actions">
              <span class="humanize-pane__meta">{{ sourceWords }} 字</span>
              <t-popconfirm
                content="将清空原文与结果，确定吗？"
                :disabled="humanizing"
                @confirm="handleClear"
              >
                <t-button size="small" variant="outline" :disabled="humanizing || !source">
                  清空
                </t-button>
              </t-popconfirm>
            </div>
          </header>
          <markdown-rich-editor
            :content="source"
            :editable="!humanizing"
            @change="source = $event"
          />
        </section>

        <section class="humanize-pane">
          <header class="humanize-pane__head">
            <span class="humanize-pane__title">去 AI 味结果</span>
            <div class="humanize-pane__actions">
              <span class="humanize-pane__meta">{{ resultWords }} 字</span>
              <t-tooltip content="复制结果的 Markdown 原文">
                <t-button size="small" variant="outline" :disabled="!result" @click="handleCopy">
                  <template #icon><copy-icon /></template>
                  复制
                </t-button>
              </t-tooltip>
              <t-tooltip content="导出为 .md 文件">
                <t-button size="small" variant="outline" :disabled="!result" @click="handleExport">
                  <template #icon><download-icon /></template>
                  导出
                </t-button>
              </t-tooltip>
            </div>
          </header>
          <!-- 流式期间只读锁定，结束后可就地微调（复制 / 导出取编辑后的内容） -->
          <markdown-rich-editor
            :content="result"
            :editable="!humanizing && !!result"
            @change="result = $event"
          />
          <div v-if="!result" class="humanize-pane__empty">
            {{ humanizing ? '正在改写…' : '点击下方「去 AI 味儿」，结果会实时出现在这里' }}
          </div>
        </section>
      </div>

      <footer class="humanize-page__bar">
        <span class="humanize-page__tip">{{ actionTip }}</span>
        <t-button v-if="humanizing" theme="danger" variant="outline" @click="handleAbort">
          停止
        </t-button>
        <t-button theme="primary" :disabled="!canRun" :loading="humanizing" @click="handleRun">
          去 AI 味儿
        </t-button>
      </footer>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import dayjs from 'dayjs'
import { CopyIcon, DownloadIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import { useAuthStore } from '@/windows/main/store/AuthStore'
import {
  HUMANIZE_ENABLED,
  getLastHumanizeDepth,
  requestHumanizeStream,
  setLastHumanizeDepth
} from '@/windows/main/modules/ai/humanize'
import { openHumanizeDepth } from '@/windows/main/components/humanize/HumanizeDepthDialog'
import MarkdownRichEditor from './components/MarkdownRichEditor.vue'

/**
 * 去 AI 味儿（独立页面）：左侧 Markdown 原文，右侧流式结果（可就地微调后复制 / 导出）。
 * 复用服务端 /api/rewrite 流式接口与写作侧同一套深度弹窗与记忆深度，不建版本、不落盘。
 */
defineOptions({ name: 'ExtendHumanizePage' })

const auth = useAuthStore()

const source = ref('')
const result = ref('')
const humanizing = ref(false)
let abortController: AbortController | null = null

const countWords = (text: string): number => text.replace(/\s+/g, '').length
const sourceWords = computed(() => countWords(source.value))
const resultWords = computed(() => countWords(result.value))

/** 门槛与提示：未登录 / 接口关闭 / 无原文 / 进行中 */
const canRun = computed(
  () => HUMANIZE_ENABLED && auth.status === 'signed-in' && !!source.value.trim() && !humanizing.value
)
const actionTip = computed(() => {
  if (humanizing.value) return '正在改写，请稍候…'
  if (!HUMANIZE_ENABLED) return '流式接口暂未开放，敬请期待'
  if (auth.status !== 'signed-in') return '请先登录后再使用去 AI 味'
  if (!source.value.trim()) return '请先输入要去 AI 味的原文'
  return '按字符计费；点击后选择改写深度（1~10，越大概率改写越彻底）'
})

const runHumanize = async (depth: number): Promise<void> => {
  if (humanizing.value) return
  setLastHumanizeDepth(depth)
  humanizing.value = true
  abortController = new AbortController()
  result.value = ''
  let streamed = ''
  try {
    const full = await requestHumanizeStream({
      text: source.value,
      depth,
      signal: abortController.signal,
      onDelta: (delta) => {
        streamed += delta
        result.value = streamed
      }
    })
    result.value = full || streamed
    MessageUtil.success('去 AI 味完成')
  } catch (e) {
    // 中止 / 失败都保留已得进度，避免用户白等一场
    result.value = streamed
    const aborted =
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError')
    if (aborted) {
      if (streamed) MessageUtil.warning('已停止，保留当前进度')
      else MessageUtil.info('已取消去 AI 味')
    } else {
      MessageUtil.error('去 AI 味失败', e)
    }
  } finally {
    humanizing.value = false
    abortController = null
  }
}

/** 入口：先选深度（记忆上次），确认后开始流式改写 */
const handleRun = (): void => {
  if (!canRun.value) return
  openHumanizeDepth({
    defaultDepth: getLastHumanizeDepth(),
    onConfirm: (depth) => void runHumanize(depth)
  })
}

const handleAbort = (): void => {
  abortController?.abort()
}

const handleClear = (): void => {
  source.value = ''
  result.value = ''
}

const handleCopy = async (): Promise<void> => {
  if (!result.value) return
  await window.preload.inject.clipboard.copyText(result.value)
  MessageUtil.success('已复制 Markdown 原文')
}

const handleExport = async (): Promise<void> => {
  if (!result.value) return
  const target = await window.preload.inject.dialog.save({
    title: '导出 Markdown',
    defaultPath: `去AI味-${dayjs().format('YYYYMMDDHHmmss')}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  })
  if (!target) return
  try {
    await window.preload.fs.writeTextFile(target, result.value)
    MessageUtil.success('已导出 Markdown')
  } catch (e) {
    MessageUtil.error('导出失败', e)
  }
}

onBeforeUnmount(() => abortController?.abort())
</script>
<style scoped lang="less">
.humanize-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding: 8px;
  box-sizing: border-box;

  &__panes {
    flex: 1;
    min-height: 0;
    display: flex;
    gap: 8px;
  }

  &__bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 4px;
  }

  &__tip {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }
}

.humanize-pane {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--td-component-border);
  border-radius: 12px;
  background: var(--td-bg-color-container);

  &__head {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--td-border-level-1-color);
  }

  &__title {
    font-size: var(--td-font-size-body-large);
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__meta {
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-secondary);
  }

  &__empty {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%);
    text-align: center;
    font-size: var(--td-font-size-body-small);
    color: var(--td-text-color-placeholder);
    pointer-events: none;
  }
}
</style>
