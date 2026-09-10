<template>
  <div class="claude-panel">
    <t-alert v-if="status !== 'ready'" theme="warning" class="gate-alert" :message="gateText">
      <template #operation>
        <t-link theme="primary" @click="goIntegrations">
          {{ status === 'missing' ? '去安装集成' : '去更新钩子' }}
        </t-link>
      </template>
    </t-alert>
    <div class="software-head">
      <div class="desc">AI 编程 agent（终端），事件经 hooks 配置上报</div>
      <t-switch
        :value="enabled"
        :disabled="notInstalled || !config || saving"
        @change="(value) => setEnabled('claude', value === true)"
      />
    </div>
    <div class="hint">仅 Claude Code hooks 覆盖的事件会上报；一种灯态只能被一个事件绑定，修改即时生效。</div>
    <div v-for="group in HOOK_GROUPS" :key="group.title" class="binding-group">
      <div class="group-title">{{ group.title }}</div>
      <div v-for="item in eventOptions(group.events)" :key="item.value" class="binding-row">
        <div class="event">
          <span class="name">{{ item.value }}</span>
          <span class="label">{{ item.label }}</span>
        </div>
        <t-select
          class="state-select"
          :value="currentValue(item.value)"
          :options="stateOptions(item.value)"
          :disabled="notInstalled || !enabled || saving"
          @change="(value) => bindEvent('claude', item.value, toState(value))"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { LightState } from '@common/types/trafficLight'
import { LightStateOptions } from '@common/types/trafficLight'
import {
  BuddyEventOptions,
  BUDDY_EVENT_GROUPS,
  type BuddyEventName
} from '@common/types/buddyEvent'
import { CommonSelect } from '@/domain'
import { useRouter } from 'vue-router'
import { useTrafficLight } from '../../useTrafficLight'
import { useIntegrations } from '@/windows/buddy/pages/settings/integrations/useIntegrations'
import { HOOK_PLATFORM_EVENTS } from '@/windows/buddy/pages/settings/integrations/registry'

defineOptions({ name: 'ClaudePanel' })

/** 事件分组过滤到 hooks 系平台能上报的子集（其余事件不投递，不提供绑定） */
const HOOK_GROUPS = BUDDY_EVENT_GROUPS.map((group) => ({
  title: group.title,
  events: group.events.filter((event) => HOOK_PLATFORM_EVENTS.includes(event))
})).filter((group) => group.events.length > 0)

const router = useRouter()
const { config, saving, bindEvent, setEnabled } = useTrafficLight()
const { statusOf } = useIntegrations()

const softwareConfig = computed(() => config.value?.config.claude)
const enabled = computed(() => softwareConfig.value?.enabled ?? false)

/** 接入状态：未安装置灰启用与绑定，待更新仅提醒不置灰（旧版钩子功能仍正常） */
const status = computed(() => statusOf('claude'))
const notInstalled = computed(() => status.value === 'missing')

const gateText = computed(() =>
  status.value === 'missing'
    ? 'Claude Code 钩子配置未安装，事件无法点亮信号灯；安装后新开会话生效，若提示审查 hooks 变更请确认。'
    : 'Claude Code 钩子脚本有更新，建议更新以保持事件上报正常。'
)

/** 前往「设置-应用集成」安装/更新钩子配置 */
function goIntegrations(): void {
  void router.push('/settings/integrations')
}

/** 组事件列表 → 下拉行数据（label 取 Buddy 事件词汇表映射） */
function eventOptions(events: readonly BuddyEventName[]): Array<CommonSelect<BuddyEventName>> {
  return events.map((value) => ({
    value,
    label: BuddyEventOptions.find((opt) => opt.value === value)?.label ?? value
  }))
}

function currentValue(event: BuddyEventName): LightState | '' {
  return softwareConfig.value?.bindings[event] ?? ''
}

/** 下拉选项（''=不响应 + 全部灯态）；已被其它事件占用的灯态置 disabled（状态绑定唯一） */
function stateOptions(event: BuddyEventName): Array<CommonSelect<LightState | ''>> {
  const bindings = softwareConfig.value?.bindings ?? {}
  const takenBy = new Set<LightState>()
  for (const [key, state] of Object.entries(bindings)) {
    if (state && key !== event) takenBy.add(state)
  }
  const options: Array<CommonSelect<LightState | ''>> = [
    { value: '', label: '不响应' },
    ...LightStateOptions
  ]
  return options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    disabled: opt.value !== '' && takenBy.has(opt.value)
  }))
}

/** 下拉值归一为灯态（未知/空 → 不响应） */
function toState(value: unknown): LightState | '' {
  if (typeof value !== 'string' || !value) return ''
  const hit = LightStateOptions.find((opt) => opt.value === value)
  return hit ? hit.value : ''
}
</script>

<style scoped lang="less">
.gate-alert {
  margin-bottom: 8px;
}

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

.binding-group {
  & + .binding-group {
    margin-top: 8px;
  }

  .group-title {
    padding: 8px 0 4px;
    font: var(--td-font-body-small);
    font-weight: 600;
    color: var(--td-text-color-tertiary);
  }
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
