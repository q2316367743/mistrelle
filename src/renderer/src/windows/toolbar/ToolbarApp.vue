<template>
  <div class="toolbar-shell">
    <div class="toolbar-card">
      <div class="search-bar">
        <t-input
          ref="inputRef"
          v-model="query"
          class="search-input"
          size="large"
          borderless
          clearable
          placeholder="搜索应用（名称 / 拼音 / 首字母）"
          @keydown="onKeydown"
        >
          <template #prefixIcon><search-icon /></template>
        </t-input>
      </div>
      <div ref="listRef" class="result-area">
        <div v-if="loading" class="state-wrap">
          <t-loading text="正在加载应用…" size="small" />
        </div>
        <t-list v-else-if="results.length" class="app-list">
          <t-list-item
            v-for="(item, index) in results"
            :key="`${item.type}:${item.target}`"
            class="app-item"
            :class="{ active: index === activeIndex }"
            @mouseenter="activeIndex = index"
            @click="activate(item)"
          >
            <div class="item-main">
              <img
                v-if="iconOf(item) && !failedIcons.has(item.target)"
                class="app-icon"
                :src="iconOf(item)"
                alt=""
                @error="onIconError(item)"
              />
              <t-avatar v-else shape="round" size="28px" class="app-icon-fallback">
                {{ item.name.slice(0, 1) }}
              </t-avatar>
              <span class="app-name">{{ item.name }}</span>
              <t-tag v-if="item.type === 'builtin'" size="small" theme="primary" variant="light">
                内置
              </t-tag>
            </div>
          </t-list-item>
        </t-list>
        <div v-else class="state-wrap">
          <t-empty
            :description="loadError ? '应用列表加载失败' : '未找到匹配的应用'"
            :type="loadError ? 'fail' : 'empty'"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { SearchIcon } from 'tdesign-icons-vue-next'
import type { InputProps } from 'tdesign-vue-next'
import { useAppSearch } from './useAppSearch'

const { query, results, loading, loadError, ensureItems } = useAppSearch()

const inputRef = ref()
const listRef = ref<HTMLElement>()
const activeIndex = ref(0)

// 应用项图标经 mistrelle://icon/<target> 协议加载（协议 handler 串行取图防 getFileIcon
// 并发崩溃；浏览器按需请求 + 自发缓存），加载失败记入失败集回退首字母头像
const failedIcons = reactive(new Set<string>())

function iconOf(item: ToolbarItem): string {
  if (item.icon) return item.icon // 内置应用自带图标
  return `mistrelle://icon/${encodeURIComponent(item.target)}`
}

function onIconError(item: ToolbarItem): void {
  failedIcons.add(item.target)
}

watch(query, () => {
  activeIndex.value = 0
})

// 键盘上下选择时保持高亮项可见
watch(activeIndex, () => {
  listRef.value
    ?.querySelector('.app-item.active')
    ?.scrollIntoView({ block: 'nearest' })
})

function onWindowFocus(): void {
  // 每次唤起重置搜索状态并聚焦输入框
  query.value = ''
  activeIndex.value = 0
  inputRef.value?.focus?.()
}

/** 激活条目：应用启动 / 内置功能分发（均在主进程），随后隐藏工作条 */
async function activate(item: ToolbarItem): Promise<void> {
  await window.workbar.activate(item)
  await window.workbar.hide()
}

const onKeydown: InputProps['onKeydown'] = (_value, { e }) => {
  if (e.isComposing) return // 输入法组词过程不响应导航键
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    const item = results.value[activeIndex.value]
    if (item) void activate(item)
  } else if (e.key === 'Escape') {
    void window.workbar.hide()
  }
}

onMounted(() => {
  window.addEventListener('focus', onWindowFocus)
  void ensureItems()
  inputRef.value?.focus?.()
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus)
})
</script>

<style scoped lang="less">
.toolbar-shell {
  box-sizing: border-box;
  height: 100vh;
  padding: 8px;
  background: transparent;
}

.toolbar-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-component-stroke);
  border-radius: 12px;
  box-shadow: var(--td-shadow-2);
}

.search-bar {
  flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid var(--td-component-stroke);
}

.result-area {
  flex: 1;
  padding: 6px;
  overflow-y: auto;
}

.state-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.app-item {
  padding: 0;
  border-radius: 8px;
  cursor: pointer;

  &.active {
    background: var(--td-bg-color-secondarycontainer);
  }
}

.item-main {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 8px;
}

.app-icon {
  flex: none;
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.app-icon-fallback {
  flex: none;
  font-size: 14px;
}

.app-name {
  overflow: hidden;
  flex: 1;
  color: var(--td-text-color-primary);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
