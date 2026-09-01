<template>
  <page-layout title="字体管理">
    <template #extra>
      <div class="font-toolbar">
        <t-radio-group v-model="sourceFilter" theme="button" variant="default-filled">
          <t-radio-button value="all">全部</t-radio-button>
          <t-radio-button value="system">系统字体</t-radio-button>
          <t-radio-button value="library">资源库</t-radio-button>
        </t-radio-group>
        <t-button theme="primary" variant="outline" shape="square" @click="openFolder">
          <template #icon><FolderOpenIcon /></template>
        </t-button>
        <t-badge :count="fontsLocked ? '会员' : 0">
          <t-button theme="primary" :disabled="fontsLocked" @click="addFont">
            <template #icon><AddIcon /></template>
            添加字体
          </t-button>
        </t-badge>
      </div>
    </template>

    <div class="font-filterbar px-8px">
      <div class="flex gap-8px shrink-0">
        <t-input
          v-model="keyword"
          clearable
          placeholder="搜索字体名称"
          class="font-filterbar__search"
        >
          <template #prefix-icon><SearchIcon /></template>
        </t-input>
        <t-select
          v-model="filter.type"
          :options="FONT_TYPE_SELECT"
          placeholder="类型"
          class="w-80px shrink-0"
          clearable
        />
        <t-select
          v-model="filter.style"
          :options="FONT_STYLE_SELECT"
          placeholder="风格"
          class="w-90px shrink-0"
          clearable
        />
        <t-select
          v-model="filter.weight"
          :options="FONT_WEIGHT_SELECT"
          placeholder="字重"
          class="w-90px shrink-0"
          clearable
        />
        <t-select
          v-model="filter.license"
          :options="FONT_LICENSE_SELECT"
          placeholder="授权"
          class="w-120px shrink-0"
          clearable
        />
        <t-select
          v-model="filter.language"
          :options="FONT_LANG_SELECT"
          placeholder="语言"
          class="w-120px shrink-0"
          clearable
        />
      </div>
      <t-button theme="primary" variant="text" class="ml-auto" @click="reload">
        <template #icon><RefreshIcon /></template>
        刷新
      </t-button>
    </div>

    <t-table
      :data="tableData"
      :columns="columns"
      :loading="loading"
      row-key="name"
      size="medium"
      :pagination="pagination"
      hover
      max-height="calc(100vh - 160px)"
      :table-layout="'fixed'"
      class="px-8px"
    >
      <template #source="{ row }">
        <t-tag :theme="row.source === 'library' ? 'primary' : 'default'" variant="light">
          {{ row.source === 'library' ? '资源库' : '系统' }}
        </t-tag>
      </template>
      <template #preview="{ row }">
        <font-preview-text :font="row" />
      </template>
      <template #op="{ row }">
        <t-button
          variant="text"
          theme="primary"
          :disabled="row.source === 'library' && fontsLocked"
          @click="editFont(row)"
        >
          编辑
        </t-button>
        <t-button
          v-if="row.source === 'library'"
          variant="text"
          theme="danger"
          :disabled="fontsLocked"
          @click="removeFont(row)"
        >
          删除
        </t-button>
      </template>
    </t-table>
  </page-layout>
</template>

<script lang="ts" setup>
import { AddIcon, FolderOpenIcon, RefreshIcon, SearchIcon } from 'tdesign-icons-vue-next'
import { MessageUtil } from '@/utils/modal'
import {
  FONT_LANG_SELECT,
  FONT_LICENSE_SELECT,
  FONT_STYLE_SELECT,
  FONT_TYPE_SELECT,
  FONT_WEIGHT_SELECT,
  filterFontsByMeta,
  type FontMetaFilter
} from '@/utils/fontMeta'
import { openFontMetaDialog } from './modals/FontMetaDialog'
import FontPreviewText from '@/components/FontPreviewText.vue'
import { clearFontPreviewCache } from '@/utils/fontPreview'
import { FontItem, FontItemWithMeta } from '@/domain/FontItem'
import { useAuthStore } from '@/store'

const authStore = useAuthStore()
/** 资源库字体（自定义字体）为会员功能：非会员可见但锁定添加/编辑/删除 */
const fontsLocked = computed(() => !authStore.features.customFonts)

const fonts = ref<FontItem[]>([])
const loading = ref(false)
const keyword = ref('')
/** 来源筛选：all 全部 / system 系统字体 / library 我上传的 */
const sourceFilter = ref<'all' | 'system' | 'library'>('library')

const filter = reactive<FontMetaFilter>({
  type: '',
  style: '',
  weight: '',
  license: '',
  language: ''
})

/** 过滤后展平 meta 到顶层，便于表格直接读 type/weight/language 列 */
const tableData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return filterFontsByMeta(fonts.value, filter)
    .filter((f) => sourceFilter.value === 'all' || f.source === sourceFilter.value)
    .filter((f) => !kw || f.name.toLowerCase().includes(kw))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((f) => ({ ...f, ...f.meta }))
})

const pagination = computed(() => ({
  defaultCurrent: 1,
  defaultPageSize: 20,
  total: tableData.value.length,
  showJumper: true
}))

const columns = computed(() => [
  { colKey: 'name', title: '字体名称', ellipsis: true, minWidth: 180 },
  { colKey: 'preview', title: '预览', width: 220 },
  { colKey: 'source', title: '来源', width: 90 },
  { colKey: 'type', title: '类型', width: 80 },
  { colKey: 'weight', title: '字重', width: 80 },
  { colKey: 'language', title: '语言', width: 90 },
  { colKey: 'op', title: '操作', width: 160 }
])

const reload = async () => {
  loading.value = true
  try {
    clearFontPreviewCache()
    fonts.value = await window.preload.font.listFonts()
  } catch (e) {
    MessageUtil.error('获取字体列表失败', e)
  } finally {
    loading.value = false
  }
}

const openFolder = () => {
  window.preload.inject.shell.openPath(window.preload.font.getAssetsDir())
}

const addFont = async () => {
  const files = await window.preload.inject.dialog.open({
    title: '选择字体文件',
    filters: [{ name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc', 'otc'] }],
    properties: ['openFile', 'multiSelections']
  })
  if (!files?.length) return
  openFontMetaDialog({ files, onSuccess: reload })
}

const editFont = (font: FontItemWithMeta) => {
  openFontMetaDialog({ font, onSuccess: reload })
}

const removeFont = async (font: FontItem) => {
  const { MessageBoxUtil } = await import('@/utils/modal')
  try {
    await MessageBoxUtil.confirm(`确认删除字体「${font.name}」？`, '删除字体')
  } catch {
    return
  }
  const result = await window.preload.font.removeFont(font.name)
  if ('error' in result && result.error) {
    MessageUtil.error(result.error)
    return
  }
  MessageUtil.success(`已删除「${font.name}」`)
  await reload()
}

onMounted(reload)
</script>

<style scoped lang="less">
.asset-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 16px 16px;
}

.asset-subtitle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--td-text-color-secondary);

  .subtitle-tag {
    flex: none;
  }
}

.font-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;

  &__radio {
    margin-left: 12px;
  }
}

.font-filterbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;

  &__count {
    margin-left: auto;
    font-size: 12px;
    color: var(--td-text-color-secondary);
    white-space: nowrap;
  }
}
</style>
