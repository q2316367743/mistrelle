<template>
  <page-layout title="自我">
    <div class="ego-page">
      <div ref="listRef" class="list-area">
        <t-empty
          v-if="items.length === 0"
          title="还没有碎碎念"
          description="在下方输入，记录此刻的想法"
        />
        <t-timeline v-else layout="vertical" mode="alternate" label-align="left" theme="dot">
          <t-timeline-item
            v-for="trace in items"
            :key="trace"
            :label="prettyTraceTime(trace)"
            dot-color="primary"
          >
            <trace-item :trace="trace" @delete="handleDelete" />
          </t-timeline-item>
        </t-timeline>
      </div>
      <div class="input-area">
        <div class="input-wrapper">
          <t-textarea
            v-model="content"
            :autosize="{ minRows: 3, maxRows: 8 }"
            placeholder="记录此刻的想法..."
            class="ego-textarea"
          />
          <t-button
            theme="primary"
            :loading="submitting"
            class="send-btn"
            shape="square"
            @click="handleAdd"
          >
            <template #icon>
              <send-icon />
            </template>
          </t-button>
        </div>
      </div>
    </div>
  </page-layout>
</template>
<script lang="ts" setup>
import { useNoteTraceStore } from '@/store/note/NoteTraceStore'
import { prettyTraceTime } from '@/utils/lang/FormatUtil'
import { SendIcon } from 'tdesign-icons-vue-next'
import TraceItem from '@/pages/note/ego/components/TraceItem.vue'

const noteTraceStore = useNoteTraceStore()
const content = ref('')
const submitting = ref(false)
const listRef = ref<HTMLElement>()
const items = computed(() => noteTraceStore.state)


const scrollToBottom = () => {
  const el = listRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

const handleAdd = async () => {
  const text = content.value.trim()
  if (!text) return
  submitting.value = true
  try {
    await noteTraceStore.add(text)
    content.value = ''
    await nextTick()
    scrollToBottom()
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: number) => {
  await noteTraceStore.deleteOne(id)
}

</script>
<style scoped lang="less">
.ego-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.input-area {
  flex-shrink: 0;
  padding: 12px 24px 24px;
  background: var(--fluent-acrylic-bg);
  backdrop-filter: var(--fluent-acrylic-blur);
  border-top: 1px solid var(--fluent-border-subtle);
}

.input-wrapper {
  position: relative;
}

.send-btn {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 1;
}
</style>
