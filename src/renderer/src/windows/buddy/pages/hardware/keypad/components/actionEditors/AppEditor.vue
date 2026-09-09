<template>
  <t-select
    :value="model?.path ?? ''"
    filterable
    creatable
    clearable
    placeholder="选择应用，或输入路径回车"
    :loading="loading"
    @change="onPathChange"
  >
    <template #valueDisplay="{ value }">
      <span v-if="typeof value === 'string' && value" class="app-value">
        <img
          v-if="!failedIcons[value]"
          class="app-value__icon"
          :src="appIconHref(value)"
          alt=""
          @error="markFailed(value)"
        />
        <span class="app-value__name">{{ appDisplayName(value) }}</span>
      </span>
    </template>
    <t-option v-for="item in apps" :key="item.path" :value="item.path" :label="item.name">
      <div class="app-option">
        <img
          v-if="!failedIcons[item.path]"
          class="app-option__icon"
          :src="appIconHref(item.path)"
          alt=""
          @error="markFailed(item.path)"
        />
        <span v-else class="app-option__fallback">{{ item.name.slice(0, 1).toUpperCase() }}</span>
        <span class="app-option__name">{{ item.name }}</span>
      </div>
    </t-option>
  </t-select>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadAppAction } from '@common/types/keypad'
import { appDisplayName, appIconHref } from '../iconHref'
import { useKeypad } from '../../useKeypad'

defineOptions({ name: 'KeypadAppEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

const { apps, loadApps } = useKeypad()

/** 本编辑器只服务 app 动作（父级按注册表分发，运行时恒为 app） */
const model = computed(
  (): KeypadAppAction | null => (props.action.type === 'app' ? props.action : null)
)

const loading = ref(false)

onMounted(async () => {
  loading.value = true
  await loadApps()
  loading.value = false
})

/** 图标加载失败（未缓存且提取失败）→ 下拉项回退首字母、选中项只显示名称 */
const failedIcons = reactive<Record<string, boolean>>({})

function markFailed(path: string): void {
  failedIcons[path] = true
}

/** 选择/创建/清空都回写 path（空串不合法，保存按钮由预校验禁用） */
function onPathChange(value: unknown): void {
  const path = typeof value === 'string' ? value : ''
  if (model.value) emit('change', { ...model.value, path })
}
</script>

<style scoped lang="less">
/* 选中项：应用图标 + 名称（替代裸路径文本） */
.app-value {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;

  &__icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
  }

  &__name {
    font: var(--td-font-body-medium);
    color: var(--td-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.app-option {
  display: flex;
  align-items: center;
  gap: 8px;

  &__icon {
    width: 18px;
    height: 18px;
    object-fit: contain;
    flex-shrink: 0;
  }

  &__fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: var(--td-radius-small);
    font: var(--td-font-body-small);
    color: var(--td-text-color-anti);
    background: var(--td-brand-color);
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
