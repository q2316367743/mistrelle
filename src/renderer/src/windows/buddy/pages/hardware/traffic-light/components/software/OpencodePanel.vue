<template>
  <div class="opencode-panel">
    <div class="software-head">
      <div class="desc">AI 编程 agent，事件经自定义协议上报</div>
      <t-switch
        :value="enabled"
        :disabled="!config || saving"
        @change="(value) => setEnabled('opencode', value === true)"
      />
    </div>
    <div class="hint">一种灯态只能被一个事件绑定；未绑定的事件不点亮，修改即时生效。</div>
    <div v-for="item in EVENTS" :key="item.event" class="binding-row">
      <div class="event">
        <span class="name">{{ item.event }}</span>
        <span class="label">{{ item.label }}</span>
      </div>
      <t-select
        class="state-select"
        :value="currentValue(item.event)"
        :options="stateOptions(item.event)"
        :disabled="!enabled || saving"
        @change="(value) => bindEvent('opencode', item.event, toState(value))"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { LIGHT_STATE_OPTIONS } from '../../softwareRegistry'
import { useTrafficLight } from '../../useTrafficLight'

defineOptions({ name: 'OpencodePanel' })

const { config, saving, bindEvent, setEnabled } = useTrafficLight()

const softwareConfig = computed(() => config.value?.config.opencode)
const enabled = computed(() => softwareConfig.value?.enabled ?? false)

/** Opencode 事件目录（与 channels 的 OpencodeEventName 全集一致；本面板可按 Opencode 特性自由演化 UI） */
const EVENTS: Array<{ event: OpencodeEventName; label: string }> = [
  { event: 'message.part.updated', label: '正在回复（流式输出）' },
  { event: 'tool.execute.before', label: '开始执行工具' },
  { event: 'tool.execute.after', label: '工具执行结束' },
  { event: 'session.idle', label: '回复完成 / 等待输入' },
  { event: 'permission.asked', label: '等待授权确认' },
  { event: 'session.error', label: '会话出错' }
]

function currentValue(event: OpencodeEventName): LightState | '' {
  return softwareConfig.value?.bindings[event] ?? ''
}

/** 已被其它事件占用的灯态置为 disabled（状态绑定唯一） */
function stateOptions(event: OpencodeEventName) {
  const bindings = softwareConfig.value?.bindings ?? {}
  const takenBy = new Set<LightState>()
  for (const [key, state] of Object.entries(bindings)) {
    if (state && key !== event) takenBy.add(state)
  }
  return LIGHT_STATE_OPTIONS.map((opt) => ({
    label: opt.label,
    value: opt.value,
    disabled: opt.value !== '' && takenBy.has(opt.value)
  }))
}

/** 下拉值归一为灯态（未知/空 → 不响应） */
function toState(value: unknown): LightState | '' {
  if (typeof value !== 'string' || !value) return ''
  const hit = LIGHT_STATE_OPTIONS.find((opt) => opt.value === value)
  return hit ? hit.value : ''
}
</script>

<style scoped lang="less">
.software-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0 12px;

  .desc {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);
  }
}

.hint {
  margin-bottom: 8px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-placeholder);
}

.binding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;

  & + .binding-row {
    border-top: 1px solid var(--td-component-stroke);
  }

  .event {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;

    .name {
      font-family: var(--td-font-family-code);
      font-size: var(--td-font-size-body-small);
      color: var(--td-text-color-primary);
    }

    .label {
      font: var(--td-font-body-small);
      color: var(--td-text-color-secondary);
    }
  }

  .state-select {
    width: 160px;
    flex-shrink: 0;
  }
}
</style>
