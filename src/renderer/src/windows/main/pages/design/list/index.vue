<template>
  <div class="h-100vh overflow-y-auto">
    <section class="style-hero">
      <div class="style-hero__left">
        <h1 class="style-hero__title">设计风格</h1>
        <p class="style-hero__subtitle">沉淀统一的设计语言，让 AI 生成始终保持一致的视觉风格</p>
        <t-badge :count="stylesLocked ? '会员' : 0">
          <t-button theme="primary" size="large" :disabled="stylesLocked" @click="handleAdd">
            <template #icon><AddIcon /></template>
            新建风格
          </t-button>
        </t-badge>
      </div>
    </section>

    <section class="style-section">
      <div
        class="sticky top-0 left-0 right-0 z-99 px-24px"
        style="background-color: var(--td-bg-color-container)"
      >
        <t-tabs v-model="activeTab" class="style-tabs" @change="onTabChange">
          <t-tab-panel value="local" label="本地" />
          <t-tab-panel value="online" :disabled="stylesLocked">
            <template #label>
              <t-badge :count="stylesLocked ? '会员' : 0" :offset="[0, -2]" size="small">
                <span
                  :style="{
                    color: stylesLocked
                      ? 'var(--td-text-color-disabled)'
                      : 'var(--td-text-color-primary)'
                  }"
                >
                  在线
                </span>
              </t-badge>
            </template>
          </t-tab-panel>
        </t-tabs>
      </div>

      <div class="style-section__header">
        <h2 class="style-section__title">
          {{ activeTab === 'local' ? '全部风格' : '在线风格库' }}
        </h2>
        <div class="style-section__actions">
          <t-select
            v-model="category"
            :options="filterOptions"
            clearable
            placeholder="全部分组"
            class="style-section__filter"
          />
          <t-input v-model="keyword" clearable placeholder="搜索风格" class="style-section__search">
            <template #prefix-icon><SearchIcon /></template>
          </t-input>
        </div>
      </div>

      <template v-if="activeTab === 'local'">
        <template v-if="groupedLocal.length > 0">
          <div v-for="group in groupedLocal" :key="group.category" class="style-group">
            <h3 class="style-group__title">{{ group.label }}</h3>
            <div class="style-grid">
              <design-style-card
                v-for="s in group.items"
                :key="s.id"
                :style="s"
                @open="handleOpenLocal(s.id)"
                @edit="handleEdit(s.id)"
                @delete="handleDelete(s.id)"
              />
            </div>
          </div>
        </template>
        <t-empty
          v-else
          title="暂无设计风格"
          description="点击右上角新建，或从内置预设中挑选"
          class="style-section__empty"
        />
      </template>

      <template v-else-if="stylesLocked">
        <t-empty
          title="在线设计风格为会员功能"
          :description="STYLES_LOCKED_MSG"
          class="style-section__empty"
        />
      </template>

      <div v-else-if="onlineLoading" class="style-section__loading">
        <t-loading size="large" text="加载在线风格…" />
      </div>

      <t-empty
        v-else-if="onlineError"
        title="加载失败"
        :description="onlineError"
        class="style-section__empty"
      >
        <t-button theme="primary" @click="loadOnline">重试</t-button>
      </t-empty>

      <template v-else>
        <template v-if="groupedOnline.length > 0">
          <div v-for="group in groupedOnline" :key="group.category" class="style-group">
            <h3 class="style-group__title">{{ group.label }}</h3>
            <div class="style-grid">
              <online-design-style-card
                v-for="s in group.items"
                :key="s.id"
                :style="s"
                :downloaded="isDownloaded(s.id)"
                @open="handleOpenOnline(s.id)"
                @download="downloadToLocal(s.id)"
              />
            </div>
          </div>
        </template>
        <t-empty
          v-else
          title="暂无在线风格"
          description="管理端上架后将在此展示"
          class="style-section__empty"
        />
      </template>
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AddIcon, SearchIcon } from 'tdesign-icons-vue-next'
import {
  DESIGN_STYLE_CATEGORY_OPTIONS,
  groupDesignStylesByCategory,
  normalizeDesignStyleCategory
} from '@/entity'
import { useAuthStore, useDesignStyleStore } from '@/windows/main/store'
import { MessageBoxUtil, MessageUtil } from '@/utils/modal'
import DesignStyleCard from './components/DesignStyleCard.vue'
import OnlineDesignStyleCard from './components/OnlineDesignStyleCard.vue'
import { openDesignStylePut } from './modals/DesignStylePutDialog'
import { useOnlineDesignStyles } from './useOnlineDesignStyles'

defineOptions({ name: 'DesignListPage' })
const router = useRouter()
const store = useDesignStyleStore()
const stylesLocked = computed(() => !useAuthStore().features.extendedDesignStyles)
const STYLES_LOCKED_MSG = '自定义设计风格为会员功能，可在 设置 → 账户 开通'

const activeTab = ref<'local' | 'online'>('local')
const keyword = ref('')
const category = ref('')
const filterOptions = [{ label: '全部分组', value: '' }, ...DESIGN_STYLE_CATEGORY_OPTIONS]

const {
  onlineList,
  onlineLoading,
  onlineError,
  loadOnline,
  downloadToLocal,
  ensureLoaded,
  isDownloaded
} = useOnlineDesignStyles(stylesLocked)

const filterItems = <
  T extends { name: string; description: string; tags: string[]; category: string }
>(
  items: T[]
): T[] => {
  const text = keyword.value.trim().toLowerCase()
  return items.filter((s) => {
    if (category.value && normalizeDesignStyleCategory(s.category) !== category.value) {
      return false
    }
    if (!text) return true
    return (
      s.name.toLowerCase().includes(text) ||
      s.description.toLowerCase().includes(text) ||
      s.tags.some((t) => t.toLowerCase().includes(text))
    )
  })
}

const groupedLocal = computed(() => groupDesignStylesByCategory(filterItems(store.all)))
const groupedOnline = computed(() => groupDesignStylesByCategory(filterItems(onlineList.value)))

const onTabChange = (val: string | number) => {
  ensureLoaded(val === 'online')
}

const handleAdd = () => openDesignStylePut()
const handleOpenLocal = (id: string) => router.push(`/design/detail/${id}`)
const handleOpenOnline = (id: string) => router.push(`/design/online/${id}`)

const handleEdit = (id: string) => {
  if (stylesLocked.value) {
    MessageUtil.warning(STYLES_LOCKED_MSG)
    return
  }
  openDesignStylePut(id)
}

const handleDelete = async (id: string) => {
  if (stylesLocked.value) {
    MessageUtil.warning(STYLES_LOCKED_MSG)
    return
  }
  const s = store.getById(id)
  if (!s) return
  try {
    await MessageBoxUtil.confirm(`确认删除设计风格「${s.name}」？删除后不可恢复`, '删除风格')
    await store.remove(id)
    MessageUtil.success('删除成功')
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="less">
.style-hero {
  padding: 32px 24px;
  background: var(--td-bg-color-container);
  border-bottom: 1px solid var(--td-component-stroke);

  &__title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--td-text-color-primary);
  }

  &__subtitle {
    margin: 8px 0 20px;
    font: var(--td-font-body-medium);
    color: var(--td-text-color-secondary);
  }
}

.style-section {
  :deep(.t-tabs__nav-wrap) {
    -webkit-app-region: no-drag;
  }
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 16px 0;
    padding: 0 24px;
  }

  &__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__filter {
    width: 160px;
  }

  &__search {
    width: 240px;
  }

  &__empty {
    margin-top: 40px;
  }

  &__loading {
    display: flex;
    justify-content: center;
    padding: 64px 0;
  }
}

.style-tabs {
  margin-bottom: 0;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.style-group {
  padding: 0 24px;
  & + & {
    margin-top: 28px;
  }

  &__title {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }
}
</style>
