<template>
  <t-select
    :value="model?.path ?? ''"
    filterable
    creatable
    clearable
    placeholder="选择应用，或输入路径回车"
    :loading="loading"
    size="small"
    @change="onPathChange"
  >
    <t-option v-for="item in apps" :key="item.path" :value="item.path" :label="item.name">
      <div class="app-option">
        <img
          v-if="!failedIcons[item.path]"
          class="app-option__icon"
          :src="iconHref(item.path)"
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
import { EVENT_SERVER_ORIGIN } from '@common/server/eventServer'
import type { KeypadAction, KeypadAppAction } from '@common/types/keypad'
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

/** 图标经本地事件服务的图标面取 PNG；失败回退首字母占位 */
const failedIcons = reactive<Record<string, boolean>>({})

function iconHref(path: string): string {
  return `${EVENT_SERVER_ORIGIN}/icon/app?path=${encodeURIComponent(path)}`
}

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
