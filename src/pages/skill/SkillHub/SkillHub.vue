<template>
  <div class="skill-hub">
    <div class="skill-hub__toolbar">
      <t-input
        v-model="keyword"
        clearable
        placeholder="搜索 Skill 名称、描述..."
        class="skill-hub__search"
        @enter="handleSearch"
      >
        <template #prefix-icon>
          <search-icon />
        </template>
        <template #suffix>
          <t-button size="small" variant="text" @click="handleSearch">搜索</t-button>
        </template>
      </t-input>
      <t-select
        v-model="sortBy"
        :options="sortOptions"
        size="medium"
        class="skill-hub__sort"
        @change="handleSearch"
      />
      <t-button variant="outline" shape="square" @click="load">
        <template #icon>
          <refresh-icon />
        </template>
      </t-button>
    </div>

    <div class="skill-hub__body">
      <t-loading :loading="loading" size="small" class="skill-hub__loading">
        <div v-if="list.length > 0" class="skill-hub__grid">
          <skill-hub-card
            v-for="item in list"
            :key="item.slug"
            :skill="item"
            @download="openSkillHubDownload(item)"
            @detail="openSkillHubDetail(item)"
          />
        </div>
        <empty-result v-else-if="!loading" title="暂无 Skill" tip="试试换个关键词搜索" />
      </t-loading>
    </div>

    <div v-if="total > 0" class="skill-hub__pager">
      <t-pagination
        v-model:current="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-size-options="[12, 24, 48]"
        show-jumper
        @change="load"
        @page-size-change="handlePageSizeChange"
      />
    </div>
  </div>
</template>
<script lang="ts" setup>
import { RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
import EmptyResult from '@/components/Result/EmptyResult.vue'
import { MessageUtil } from '@/utils/modal'
import { skillHubApiSkills, type ApiSkill } from '@/modules/skillhub'
import SkillHubCard from './components/SkillHubCard.vue'
import { openSkillHubDownload } from './modals/skillhub-func'
import { openSkillHubDetail } from './components/SkillHubDetail'

const loading = ref(false)
const list = ref<Array<ApiSkill>>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(24)
const keyword = ref('')
const sortBy = ref('downloads')

const sortOptions = [
  { label: '下载量', value: 'downloads' },
  { label: '收藏数', value: 'stars' },
  { label: '最近更新', value: 'updated_at' }
]

const load = async () => {
  loading.value = true
  try {
    const data = await skillHubApiSkills({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      sortBy: sortBy.value,
      order: 'desc'
    })
    list.value = data.skills ?? []
    total.value = data.total ?? 0
  } catch (e) {
    MessageUtil.error('加载失败', e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  load()
}

const handlePageSizeChange = () => {
  page.value = 1
  load()
}

watchDebounced(
  keyword,
  () => {
    handleSearch()
  },
  { debounce: 400 }
)

onMounted(load)
</script>
<style scoped lang="less">
.skill-hub {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background-color: var(--td-bg-color-container);

  &__toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--td-component-border);
  }

  &__search {
    flex: 1;
    min-width: 0;
  }

  &__sort {
    width: 140px;
    flex-shrink: 0;
  }

  &__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
  }

  &__loading {
    min-height: 200px;
    width: 100%;

    :deep(.empty-result-container) {
      height: auto;
      min-height: 240px;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 12px;
  }

  &__pager {
    display: flex;
    justify-content: flex-end;
    padding: 8px 12px;
    flex-shrink: 0;
    border-top: 1px solid var(--td-component-border);
  }
}
</style>
