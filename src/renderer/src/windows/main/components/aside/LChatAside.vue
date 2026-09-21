<template>
  <sub-agent-aside
    v-if="subAgent"
    :sub-agent="subAgent"
    :messages="subAgentMessages"
    @close="$emit('close-sub-agent')"
  />
  <!-- 场景侧边栏由注册表直出：resolveScene 穷尽解析，无 v-if 链即无静默空白兜底问题 -->
  <component :is="scene.aside" v-else v-bind="sceneProps" @view-agent="onViewAgent" />
</template>
<script lang="ts" setup>
import { computed } from 'vue'
import type { ChatMessage, TodoItem } from '@/domain'
import type { ChatStatus, ChatType, DesignScene, WritingScene } from '@/windows/main/modules/chat'
import type { AgentHistoryItem } from '@/windows/main/components/AgentHistoryList.vue'
import type { SubAgentInfo } from '@/windows/main/modules/chat/agent/agentMessages'
import { resolveScene } from '@/windows/main/modules/chat/scenes'
import SubAgentAside from './SubAgentAside.vue'

const props = withDefaults(
  defineProps<{
    type: ChatType
    writingScene?: WritingScene
    designScene?: DesignScene
    messages: ChatMessage[]
    workspace?: string
    sandbox?: string
    status: ChatStatus
    todos: TodoItem[]
    agentHistory: AgentHistoryItem[]
    activeAgentId: string
    /** 正在侧栏查看的子 Agent；给出时优先渲染子 Agent 面板，隐藏原会话面板 */
    subAgent?: SubAgentInfo
    /** 子 Agent 面板展示的消息（运行中实时 / 已完成磁盘快照） */
    subAgentMessages?: ChatMessage[]
    fullscreen?: boolean
  }>(),
  {
    type: 'office',
    writingScene: 'article',
    designScene: 'canvas',
    messages: () => [],
    workspace: '',
    sandbox: '',
    status: 'idle',
    todos: () => [],
    agentHistory: () => [],
    activeAgentId: 'main',
    subAgentMessages: () => [],
    fullscreen: false
  }
)

const emit = defineEmits<{
  (e: 'view-agent', subAgentId: string): void
  (e: 'close-sub-agent'): void
}>()

/** 当前叶子场景定义（type / 子场景创建后锁定，运行期不变） */
const scene = computed(() => resolveScene(props.type, props.writingScene, props.designScene))

/** 统一状态包 → 场景 asideProps 映射器挑选（防未声明 props 落到根元素 DOM 属性） */
const sceneProps = computed(() =>
  scene.value.asideProps?.({
    messages: props.messages,
    workspace: props.workspace,
    sandbox: props.sandbox,
    status: props.status,
    todos: props.todos,
    agentHistory: props.agentHistory,
    activeAgentId: props.activeAgentId,
    fullscreen: props.fullscreen,
    writingScene: props.writingScene,
    designScene: props.designScene
  })
)
const onViewAgent = (subAgentId: string) => emit('view-agent', subAgentId)
</script>
