<template>
  <page-layout title="资源管理">
    <div class="asset-page">
      <div class="asset-subtitle">
        <span>统一管理本地资源库（~/.mistrelle/assets），字体可被设计画布直接使用</span>
        <t-tag variant="light" theme="primary" class="subtitle-tag">资源库</t-tag>
      </div>

      <t-tabs v-model="activeTab" placement="top">
        <t-tab-panel value="font" label="字体">
          <div class="font-toolbar">
            <t-button theme="primary" variant="outline" @click="openFolder">
              <template #icon><FolderOpenIcon /></template>
              打开字体目录
            </t-button>
            <t-button theme="primary" @click="addFont">
              <template #icon><AddIcon /></template>
              添加字体
            </t-button>
            <t-radio-group
              v-model="sourceFilter"
              theme="button"
              variant="default-filled"
              class="font-toolbar__radio"
            >
              <t-radio-button value="all">全部</t-radio-button>
              <t-radio-button value="system">系统字体</t-radio-button>
              <t-radio-button value="library">资源库</t-radio-button>
            </t-radio-group>
            <t-button theme="primary" variant="text" class="ml-auto" @click="reload">
              <template #icon><RefreshIcon /></template>
              刷新
            </t-button>
          </div>

          <div class="font-filterbar">
            <t-select
              v-model="filter.type"
              :options="FONT_TYPE_SELECT"
              size="small"
              placeholder="类型"
            />
            <t-select
              v-model="filter.style"
              :options="FONT_STYLE_SELECT"
              size="small"
              placeholder="风格"
            />
            <t-select
              v-model="filter.weight"
              :options="FONT_WEIGHT_SELECT"
              size="small"
              placeholder="字重"
            />
            <t-select
              v-model="filter.license"
              :options="FONT_LICENSE_SELECT"
              size="small"
              placeholder="授权"
            />
            <t-select
              v-model="filter.language"
              :options="FONT_LANG_SELECT"
              size="small"
              placeholder="语言"
            />
            <t-button v-if="hasFilter" variant="text" theme="primary" @click="resetFilter"
              >重置</t-button
            >
            <span class="font-filterbar__count"
              >{{ tableData.length }} / {{ fonts.length }} 个字体</span
            >
          </div>

          <t-table
            :data="tableData"
            :columns="columns"
            :loading="loading"
            row-key="name"
            size="medium"
            :pagination="pagination"
            hover
            max-height="calc(100vh - 326px)"
            :table-layout="'fixed'"
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
              <t-button variant="text" theme="primary" @click="editFont(row)">编辑</t-button>
              <t-button
                v-if="row.source === 'library'"
                variant="text"
                theme="danger"
                @click="removeFont(row)"
              >
                删除
              </t-button>
            </template>
          </t-table>
        </t-tab-panel>

        <t-tab-panel value="image" label="插图素材">
          <t-empty description="插图素材管理即将上线，敬请期待" class="mt-15vh" />
        </t-tab-panel>
      </t-tabs>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { AddIcon, FolderOpenIcon, RefreshIcon } from 'tdesign-icons-vue-next'
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

const activeTab = ref('font')
const fonts = ref<FontItem[]>([])
const loading = ref(false)
/** 来源筛选：all 全部 / system 系统字体 / library 我上传的 */
const sourceFilter = ref<'all' | 'system' | 'library'>('library')

const FILTER_DIM_KEYS = ['type', 'style', 'weight', 'license', 'language'] as const
const filter = reactive<FontMetaFilter>({
  type: '全部',
  style: '全部',
  weight: '全部',
  license: '全部',
  language: '全部'
})
const hasFilter = computed(() => FILTER_DIM_KEYS.some((k) => filter[k] && filter[k] !== '全部'))

const resetFilter = () => {
  for (const k of FILTER_DIM_KEYS) filter[k] = '全部'
}

/** 过滤后展平 meta 到顶层，便于表格直接读 type/weight/language 列 */
const tableData = computed(() =>
  filterFontsByMeta(fonts.value, filter)
    .filter((f) => sourceFilter.value === 'all' || f.source === sourceFilter.value)
    .map((f) => ({ ...f, ...f.meta }))
)

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
  const files = window.preload.inject.dialog.open({
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

  .t-select {
    width: 110px;
  }

  &__count {
    margin-left: auto;
    font-size: 12px;
    color: var(--td-text-color-secondary);
    white-space: nowrap;
  }
}
</style>
