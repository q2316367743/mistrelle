<template>
  <div v-if="requests.length > 0" class="permission-panel">
    <div class="panel-title">待审批请求（{{ requests.length }}）</div>
    <div v-for="request in requests" :key="request.requestId" class="request-item">
      <div class="request-main">
        <div class="request-title">{{ request.title || request.type }}</div>
        <div class="request-meta">
          <span class="mono">{{ request.type }}</span>
          <span>{{ formatTime(request.createdAt) }}</span>
          <span>等待处理，超时后由软件内置询问接管</span>
        </div>
      </div>
      <div class="actions">
        <t-button
          size="small"
          theme="success"
          variant="outline"
          :loading="deciding === request.requestId"
          @click="onDecide(request, 'allow')"
        >
          允许
        </t-button>
        <t-button
          size="small"
          theme="danger"
          variant="outline"
          :loading="deciding === request.requestId"
          @click="onDecide(request, 'deny')"
        >
          拒绝
        </t-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { PermissionDecision, PermissionRequestInfo } from '@common/types/permissionRequest'
import { usePermissionRequests } from '../usePermissionRequests'

defineOptions({ name: 'PermissionRequestPanel' })

const props = defineProps<{ source: string }>()

const { pending, decide } = usePermissionRequests()

/** 只展示本接入来源的待审请求 */
const requests = computed<PermissionRequestInfo[]>(() =>
  pending.value.filter((item) => item.source === props.source)
)

const deciding = ref<string | null>(null)

async function onDecide(request: PermissionRequestInfo, decision: PermissionDecision): Promise<void> {
  deciding.value = request.requestId
  try {
    await decide(request.requestId, decision)
  } finally {
    deciding.value = null
  }
}

function formatTime(createdAt: number): string {
  return new Date(createdAt).toLocaleTimeString('zh-CN', { hour12: false })
}
</script>

<style scoped lang="less">
.permission-panel {
  margin-top: 12px;
  padding: 8px 12px;
  border: 1px solid var(--td-warning-color-3);
  border-radius: 6px;
  background: var(--td-bg-color-secondarycontainer);
}

.panel-title {
  margin-bottom: 4px;
  font: var(--td-font-body-small);
  font-weight: 600;
  color: var(--td-warning-color-7);
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;

  & + .request-item {
    border-top: 1px solid var(--td-component-stroke);
  }
}

.request-main {
  min-width: 0;
}

.request-title {
  font: var(--td-font-body-small);
  font-weight: 500;
  color: var(--td-text-color-primary);
  word-break: break-all;
}

.request-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
  font: var(--td-font-body-small);
  color: var(--td-text-color-tertiary);

  .mono {
    font-family: var(--td-font-family-code);
  }
}

.actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}
</style>
