<template>
  <div class="permission-editor">
    <t-radio-group :value="model?.decision" variant="default-filled" @change="onDecisionChange">
      <t-radio-button value="allow">允许最近请求</t-radio-button>
      <t-radio-button value="deny">拒绝最近请求</t-radio-button>
    </t-radio-group>
    <div class="permission-editor__hint">对最近一条待审批权限请求生效；无待审请求时按键为空操作</div>
  </div>
</template>

<script lang="ts" setup>
import type { KeypadAction, KeypadPermissionAction } from '@common/types/keypad'
import { isPermissionDecision } from '@common/types/permissionRequest'

defineOptions({ name: 'KeypadPermissionEditor' })

const props = defineProps<{ action: KeypadAction }>()
const emit = defineEmits<{ change: [action: KeypadAction] }>()

/** 本编辑器只服务 permission 动作（父级按注册表分发，运行时恒为 permission） */
const model = computed(
  (): KeypadPermissionAction | null => (props.action.type === 'permission' ? props.action : null)
)

function onDecisionChange(value: unknown): void {
  if (typeof value !== 'string' || !isPermissionDecision(value) || !model.value) return
  emit('change', { ...model.value, decision: value })
}
</script>

<style scoped lang="less">
.permission-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__hint {
    font: var(--td-font-body-small);
    color: var(--td-text-color-tertiary);
  }
}
</style>
