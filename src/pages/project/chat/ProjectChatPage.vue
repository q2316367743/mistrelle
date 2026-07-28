<template>
  <l-chat-engine
    v-if="storageKey"
    class="project-chat-page"
    :storage-key="storageKey"
    :chat-id="taskId"
    :sandbox-dir="sandboxDir"
    height="calc(100vh - 125px)"
  />
  <loading-result v-else title="正在加载中" />
</template>
<script lang="ts" setup>
import { buildProjectTaskContentPath, buildProjectTaskSandboxPath } from '@/modules/project'

const route = useRoute()

const projectId = computed(() => String(route.params.id))
const taskId = computed(() => String(route.params.chatId))

const storageKey = computed(() =>
  projectId.value && taskId.value ? buildProjectTaskContentPath(projectId.value, taskId.value) : ''
)

const sandboxDir = computed(() =>
  projectId.value && taskId.value ? buildProjectTaskSandboxPath(projectId.value, taskId.value) : ''
)
</script>
<style lang="less" scoped>
.project-chat-page {
  padding: 0 !important;
}
</style>
