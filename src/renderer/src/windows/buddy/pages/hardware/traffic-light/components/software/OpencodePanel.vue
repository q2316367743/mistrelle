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
    <div class="install-row">
      <span class="status" :data-status="installStatus">{{ installText }}</span>
      <t-button
        v-if="installStatus !== 'ready'"
        size="small"
        variant="outline"
        :loading="installing"
        @click="install"
      >
        {{ installStatus === 'outdated' ? '更新插件' : '安装插件' }}
      </t-button>
    </div>
    <div class="hint">一种灯态只能被一个事件绑定；未绑定的事件不点亮，修改即时生效。</div>
    <div v-for="group in BUDDY_EVENT_GROUPS" :key="group.title" class="binding-group">
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
          :disabled="!enabled || saving"
          @change="(value) => bindEvent('opencode', item.value, toState(value))"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  LightStateOptions,
  type LightState,
  type PlatformConfigStatus
} from '@common/types/trafficLight'
import {
  BuddyEventOptions,
  BUDDY_EVENT_GROUPS,
  type BuddyEventName
} from '@common/types/buddyEvent'
import { CommonSelect } from '@/domain'
import { useTrafficLight } from '../../useTrafficLight'

defineOptions({ name: 'OpencodePanel' })

const { config, saving, platformStatus, bindEvent, setEnabled, installPlatform } = useTrafficLight()

const softwareConfig = computed(() => config.value?.config.opencode)
const enabled = computed(() => softwareConfig.value?.enabled ?? false)

const installing = ref(false)
const installStatus = computed<PlatformConfigStatus>(
  () => platformStatus.value?.status ?? 'missing'
)

/** 各安装态的说明文案（missing/outdated 提供一键安装入口） */
const INSTALL_TEXT: Record<PlatformConfigStatus, string> = {
  missing: '事件接入插件未安装，安装后 opencode 事件才能点亮信号灯',
  outdated: '事件接入插件有更新，建议更新以保持事件上报正常',
  ready: '事件接入插件已安装，事件可点亮信号灯'
}
const installText = computed(() => INSTALL_TEXT[installStatus.value])

/** 安装/更新内置插件到 opencode 插件目录（成功提示与状态刷新在 useTrafficLight 内） */
async function install(): Promise<void> {
  installing.value = true
  try {
    await installPlatform('opencode')
  } finally {
    installing.value = false
  }
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

.install-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);

  .status {
    font: var(--td-font-body-small);
    color: var(--td-text-color-secondary);

    &[data-status='ready'] {
      color: var(--td-success-color-7);
    }

    &[data-status='outdated'] {
      color: var(--td-warning-color-7);
    }
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
