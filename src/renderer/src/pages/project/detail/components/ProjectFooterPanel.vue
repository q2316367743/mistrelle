<template>
  <l-chat-sender @send="handleSend" />
</template>
<script lang="ts" setup>
import { ChatRequestParams, useChatName } from '@/modules/chat'
import { projectTaskCreate, projectTaskList, projectTaskIndexSave } from '@/modules/project'
import { useLog } from '@/hooks/UseLog'

const route = useRoute()
const router = useRouter()
const logger = useLog({ name: 'project-footer' })

const projectId = computed(() => String(route.params.id))

const handleSend = async (params: ChatRequestParams) => {
  const taskId = await projectTaskCreate(projectId.value, params)
  // 异步生成名称，不阻塞跳转
  const preview = params.message.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as { data: string }).data)
    .join('')
  useChatName(preview)
    .then(async (name) => {
      const list = await projectTaskList(projectId.value)
      const idx = list.findIndex((e) => e.id === taskId)
      if (idx >= 0) {
        list[idx] = { ...list[idx], name, updatedAt: Date.now() }
        await projectTaskIndexSave(projectId.value, list)
      }
    })
    .catch((e) => logger.error('项目任务命名失败', e))
  await router.push(`/project/${projectId.value}/chat/${taskId}`)
}
</script>
