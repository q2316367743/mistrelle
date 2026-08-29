<template>
  <div class="chat-tool" :class="{ 'is-expanded': expanded }">
    <div class="tool-row" @click="toggle">
      <TerminalIcon v-if="!expanded" class="tool-icon" />
      <ChevronRightIcon v-else class="tool-chevron" />
      <span class="tool-value tool-command">{{ commandText }}</span>
      <div class="tool-end">
        <t-loading v-if="isLoading" size="small" />
        <t-tag v-if="statusConfig" :theme="statusConfig.theme" variant="light-outline" size="small">
          {{ statusConfig.label }}
        </t-tag>
      </div>
    </div>
    <!-- 终端样式详情：$ 命令 + 标准输入 + 输出，暗色固定画布（明暗主题下均为终端观感） -->
    <div v-if="expanded" class="tool-terminal">
      <div class="term-line">
        <span class="term-prompt">$</span>
        <code class="term-command">{{ commandText }}</code>
      </div>
      <template v-if="stdinText !== ''">
        <div class="term-section-label">标准输入</div>
        <pre class="term-stdin"><code>{{ stdinText }}</code></pre>
      </template>
      <div v-if="outputText || isLoading" class="term-section-label">输出</div>
      <pre
        v-if="outputText"
        class="term-output"
        :class="{ 'term-output--error': isError }"
      ><code>{{ outputText }}</code></pre>
      <div v-else-if="isLoading" class="term-running">
        <t-loading size="small" theme="dots" />
        <span class="term-caret" />
      </div>
      <div v-else class="term-empty">(无输出)</div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { PropType } from 'vue'
import type { ToolCallContent } from '@/domain'
import type { ToolPhase } from '@/domain'
import { toolPhaseOf } from '@/modules/chat/agent/agentMessages'
import { ChevronRightIcon, TerminalIcon } from 'tdesign-icons-vue-next'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const expanded = ref(false)
const toggle = () => {
  expanded.value = !expanded.value
}

/** cli_run 的入参对象：command / args[] / stdin，解析失败回退空对象 */
const cliArgs = computed<Record<string, unknown>>(() => {
  try {
    const parsed = JSON.parse(props.content.data.args ?? '')
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
})

const commandText = computed(() => {
  const name = props.content.data.toolCallName
  const { command, args } = cliArgs.value
  if (name === 'cli_run' && typeof command === 'string') {
    const rest = Array.isArray(args)
      ? args.filter((e): e is string => typeof e === 'string').join(' ')
      : ''
    return `${command} ${rest}`.trim()
  }
  return name
})

const stdinText = computed(() => {
  const stdin = cliArgs.value.stdin
  return typeof stdin === 'string' ? stdin : ''
})

const outputText = computed(() => props.content.data.result || '')

// 纯状态驱动：块级四态由执行器独占推进（toolPhaseOf 含历史旧值归一），无需终态覆盖
const phase = computed(() => toolPhaseOf(props.content))

const isError = computed(
  () =>
    (phase.value === 'complete' || phase.value === 'stop') && outputText.value.startsWith('错误')
)

interface StatusConfig {
  theme: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  label: string
}

const statusConfig = computed<StatusConfig>(() => {
  const map: Record<ToolPhase, StatusConfig> = {
    pending: { theme: 'default', label: '等待中' },
    confirm: { theme: 'warning', label: '审批中' },
    executing: { theme: 'primary', label: '执行中' },
    complete: { theme: 'success', label: '完成' },
    stop: { theme: 'default', label: '已停止' }
  }
  return map[phase.value]
})

const isLoading = computed(() => phase.value === 'pending' || phase.value === 'executing')
</script>
<style scoped lang="less">
.chat-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  overflow: hidden;

  &.is-expanded {
    border-color: var(--td-component-stroke);
  }
}

.tool-row {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  min-width: 0;
  cursor: pointer;
  user-select: none;
}

.tool-icon {
  flex-shrink: 0;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-large);
}

.tool-icon {
  display: inline-flex;
}


.tool-command {
  font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace), serif;
}

.tool-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: var(--td-font-body-small);
  color: var(--td-text-color-primary);
}

.tool-end {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  flex-shrink: 0;
  margin-left: auto;
}

// ─── 终端画布：明暗主题均保持暗色终端观感（灰色阶为固定色板不随主题翻转） ───

.tool-terminal {
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-m);
  background: var(--td-gray-color-14);
  border-top: 1px solid var(--td-component-border);
  font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace), serif;
}

.term-line {
  display: flex;
  align-items: baseline;
  gap: var(--td-comp-margin-s);
}

.term-prompt {
  flex-shrink: 0;
  color: var(--td-success-color-5);
  font-weight: 600;
  user-select: none;
}

.term-command {
  color: var(--td-font-white-1);
  word-break: break-all;
  white-space: pre-wrap;
}

.term-section-label {
  margin: var(--td-comp-margin-s) 0 var(--td-comp-margin-xxs);
  font-size: var(--td-font-size-body-small);
  color: var(--td-font-white-3);
}

.term-stdin,
.term-output {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font: var(--td-font-body-small);
  font-family: inherit;
  color: var(--td-font-white-2);
}

.term-stdin {
  padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
  border-radius: var(--td-radius-small);
  background: var(--td-gray-color-12);

  code {
    color: var(--td-font-white-2);
  }
}

.term-output--error code {
  color: var(--td-error-color-5);
}

.term-running {
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  color: var(--td-font-white-3);
  font: var(--td-font-body-small);
}

// 执行中闪烁光标
.term-caret {
  width: 8px;
  height: 16px;
  background: var(--td-font-white-2);
  animation: term-caret-blink 1s step-end infinite;
}

@keyframes term-caret-blink {
  50% {
    opacity: 0;
  }
}

.term-empty {
  margin-top: var(--td-comp-margin-xs);
  color: var(--td-font-white-3);
  font: var(--td-font-body-small);
}
</style>
