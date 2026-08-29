<template>
  <div class="confirm-chat-tool" :data-tool-call-id="toolCallId">
    <template v-if="isInteractive">
      <div class="confirm-row">
        <ShieldErrorIcon class="confirm-icon" />
        <div class="confirm-info">
          <div class="confirm-title">{{ label }}</div>
          <div class="confirm-name">{{ toolCallName }}</div>
        </div>
      </div>
      <div v-if="formattedArgs" class="confirm-args">
        <pre>{{ formattedArgs }}</pre>
      </div>
      <div class="confirm-actions">
        <t-checkbox v-if="confirmPath" v-model="rememberDir" class="confirm-remember">
          此目录以后都允许（仅本聊天）
        </t-checkbox>
        <t-button theme="primary" size="small" @click="approve">批准执行</t-button>
        <t-button theme="default" variant="outline" size="small" @click="reject">拒绝</t-button>
      </div>
    </template>
    <div v-else-if="isExecuting || showExecutingFallback" class="confirm-executing">
      <t-loading size="small" />
      <span>{{ showExecutingFallback ? '等待交互桥…' : '执行中…' }}</span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { computed, inject, ref } from 'vue'
import type { PropType } from 'vue'
import type { ToolCallContent } from '@/domain'
import { ShieldErrorIcon } from 'tdesign-icons-vue-next'
import { INTERACTIVE_KEY } from '@/modules/chat/agent/interactive'
import { toolPhaseOf } from '@/modules/chat/agent/agentMessages'
import { toolMap } from '@/modules/tool'

const props = defineProps({
  content: {
    type: Object as PropType<ToolCallContent>,
    required: true
  }
})

const bridge = inject(INTERACTIVE_KEY)

const toolCallName = computed(() => props.content.data.toolCallName)
const label = computed(() => toolMap[toolCallName.value]?.label ?? toolCallName.value)

// 卡片自持解析自身参数：并行审批下不依赖桥的单激活位（pending.args 只对激活项成立）
const selfArgs = computed<Record<string, unknown>>(() => {
  try {
    return JSON.parse(props.content.data.args ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
})

const formattedArgs = computed(() => {
  const raw = props.content.data.args
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
})

const toolCallId = computed(() => props.content.data.toolCallId)

/** 「此目录以后都允许」勾选状态；带 path 参数的确认卡片才展示 */
const rememberDir = ref(false)
const confirmPath = computed(() => {
  const path = selfArgs.value.path
  return typeof path === 'string' && path ? path : ''
})

const approve = () => {
  if (rememberDir.value && confirmPath.value) {
    bridge?.resolve(toolCallId.value, {
      approved: true,
      allowDir: window.preload.path.dirname(confirmPath.value)
    })
    return
  }
  bridge?.resolve(toolCallId.value, true)
}

const reject = () => {
  bridge?.resolve(toolCallId.value, false)
}

// 纯状态驱动：confirm 相 = 等待用户决策（出按钮，数据自持不依赖桥激活匹配）；
// pending / executing = 执行期占位。块级四态由执行器独占推进，消息级收尾不再触碰
const phase = computed(() => toolPhaseOf(props.content))
const isInteractive = computed(() => phase.value === 'confirm' && !!bridge)
const isExecuting = computed(() => phase.value === 'pending' || phase.value === 'executing')
// 无桥环境（桥被禁用 / 异常水合）的兜底占位
const showExecutingFallback = computed(() => phase.value === 'confirm' && !bridge)
</script>
<style scoped lang="less">
.confirm-chat-tool {
  margin: var(--td-comp-margin-xs) 0;
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-border);
  padding: var(--td-comp-paddingTB-s) var(--td-comp-paddingLR-s);

  .confirm-row {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
  }

  .confirm-icon {
    flex-shrink: 0;
    color: var(--td-warning-color);
    font-size: var(--td-font-size-title-medium);
  }

  .confirm-info {
    min-width: 0;
    flex: 1;
  }

  .confirm-title {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .confirm-name {
    font: var(--td-font-body-small);
    font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
    color: var(--td-text-color-placeholder);
  }

  .confirm-args {
    margin-top: var(--td-comp-margin-s);
    padding: var(--td-comp-paddingTB-xs) var(--td-comp-paddingLR-s);
    border-radius: var(--td-radius-small);
    background: var(--td-bg-color-secondary);
    font: var(--td-font-body-small);
    font-family: var(--td-font-family-mono, 'Cascadia Code', 'Fira Code', 'Consolas', monospace);
    color: var(--td-text-color-primary);
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;

    pre {
      margin: 0;
    }
  }

  .confirm-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--td-comp-margin-s);
    margin-top: var(--td-comp-margin-s);
  }

  .confirm-remember {
    margin-right: auto;
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }

  .confirm-executing {
    display: flex;
    align-items: center;
    gap: var(--td-comp-margin-s);
    color: var(--td-text-color-placeholder);
    font: var(--td-font-body-small);
  }
}
</style>
