<template>
  <div class="side-menu-node">
    <template v-if="item.children?.length">
      <button
        class="menu-item"
        :class="{ active }"
        type="button"
        @click="expanded = !expanded"
      >
        <component :is="item.icon" v-if="item.icon" class="menu-icon" />
        <span>{{ item.label }}</span>
        <chevron-right-icon class="ml-auto chevron" :class="{ expanded }" />
      </button>
      <transition name="submenu" @enter="onEnter" @after-enter="onAfterEnter" @leave="onLeave">
        <div v-if="expanded" class="submenu">
          <SideMenuNode v-for="child in item.children" :key="child.label" :item="child" />
        </div>
      </transition>
    </template>

    <button v-else class="menu-item" :class="{ active }" type="button" @click="goTo">
      <component :is="item.icon" v-if="item.icon" class="menu-icon" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { ChevronRightIcon } from 'tdesign-icons-vue-next'
import type { SideMenuItem } from './SideMenu.vue'

const props = defineProps<{ item: SideMenuItem }>()

const router = useRouter()
const route = useRoute()

function isItemActive(item: SideMenuItem): boolean {
  if (item.to) {
    const match = item.match ?? 'exact'
    if (match === 'prefix' ? route.path.startsWith(item.to) : route.path === item.to) return true
  }
  if (item.activePaths?.some((p) => route.path.startsWith(p))) return true
  return !!item.children?.some(isItemActive)
}

const active = computed(() => isItemActive(props.item))
// 当前路由落在某子项时，默认展开该父级（深链接进入也能看到对应子菜单）
const expanded = ref(active.value && !!props.item.children?.length)

function goTo() {
  if (!props.item.to) return
  if (route.path !== props.item.to) router.push(props.item.to)
}

function onEnter(el: Element) {
  const node = el as HTMLElement
  node.style.height = '0'
  node.style.opacity = '0'
  void node.offsetHeight
  node.style.height = `${node.scrollHeight}px`
  node.style.opacity = '1'
}

function onAfterEnter(el: Element) {
  const node = el as HTMLElement
  node.style.height = 'auto'
  node.style.opacity = ''
}

function onLeave(el: Element) {
  const node = el as HTMLElement
  node.style.height = `${node.scrollHeight}px`
  node.style.opacity = '1'
  void node.offsetHeight
  node.style.height = '0'
  node.style.opacity = '0'
}
</script>

<style scoped lang="less">
.side-menu-node {
  display: flex;
  flex-direction: column;
}

.menu-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--td-comp-margin-s);
  width: calc(100% - 16px);
  min-width: 204px;
  min-height: var(--td-comp-size-m);
  padding: 0 var(--td-comp-paddingLR-s);
  color: var(--td-text-color-primary);
  font: var(--td-font-body-medium);
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--td-radius-small);
  outline: none;
  cursor: pointer;
  transition:
    background var(--fluent-transition-fast),
    border-color var(--fluent-transition-fast),
    box-shadow var(--fluent-transition-fast),
    color var(--fluent-transition-fast);

  &:hover {
    background: var(--fluent-item-hover);
  }

  &:focus-visible {
    box-shadow: var(--fluent-focus-ring);
  }

  &.active {
    color: var(--td-text-color-brand);
    background: var(--fluent-item-selected);
    border-color: var(--fluent-sidebar-border);

    &:hover {
      background: var(--fluent-item-selected);
    }

    &::before {
      background: var(--fluent-item-selected-border);
    }
  }

  &::before {
    position: absolute;
    left: 0;
    width: 3px;
    height: 18px;
    content: '';
    background: transparent;
    border-radius: var(--td-radius-round);
    transition: background var(--fluent-transition-fast);
  }

  &:disabled {
    color: var(--td-text-color-disabled);
    cursor: not-allowed;

    &:hover {
      background: transparent;
    }

    &::before {
      background: transparent;
    }
  }
}

.submenu {
  position: relative;
  padding-left: 16px;
  overflow: hidden;
  transition:
    height var(--fluent-transition-fast),
    opacity var(--fluent-transition-fast);
}

.chevron {
  flex: 0 0 auto;
  transition: transform 200ms ease-in-out;

  &.expanded {
    transform: rotate(90deg);
  }
}

.menu-icon {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
}
</style>
