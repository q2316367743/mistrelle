<template>
  <page-layout title="AI 设置">
    <div class="ai-setting-layout">
      <setting-ai-sidebar
        :selected-id="selectedId"
        @add="handleAdd"
        @select="selectItem"
        @enable="handleProvideEnableChange"
        @delete="handleDelete"
      />

      <!-- 右侧：编辑面板 -->
      <div class="ai-setting-main">
        <template v-if="!selectedId && !isCreating">
          <t-empty description="请选择一个提供方或新增" />
        </template>
        <!-- 内置供应商（服务端中转站）：只读展示 + 刷新模型列表 -->
        <builtin-provider-panel
          v-else-if="isBuiltinSelected"
          :name="builtinItem?.name ?? ''"
          :models="builtinModels"
          :refreshing="store.refreshingBuiltin"
          :signed-in="isSignedIn"
          @refresh="handleRefreshBuiltin"
        />
        <!-- 自定义供应商：表单 + 模型管理 -->
        <provider-editor
          v-else
          :form="form"
          :saving="saving"
          :fetching="modelsApi.fetching.value"
          :name-presets="PROVIDER_NAME_PRESETS"
          :provider-presets="PROVIDER_PRESETS"
          @save="handleSave"
          @fetch-models="modelsApi.fetchModels(form)"
          @add-model="modelsApi.addModel"
          @edit-model="modelsApi.editModel"
          @delete-model="modelsApi.deleteModel"
          @toggle-model="modelsApi.toggleModel"
        />
      </div>
    </div>
  </page-layout>
</template>

<script lang="ts" setup>
import { useSettingAiStore, useAuthStore, BUILTIN_PROVIDER_ID } from '@/store'
import { AiProvideFormat } from '@/entity'
import { MessageUtil } from '@/utils/modal'
import { openLogin } from '@/components/modals/LoginDialog'
import { PROVIDER_NAME_PRESETS, PROVIDER_PRESETS } from './providerPresets'
import { useProviderModels } from './useProviderModels'
import SettingAiSidebar from './components/SettingAiSidebar.vue'
import BuiltinProviderPanel from './components/BuiltinProviderPanel.vue'
import ProviderEditor, { type ProviderFormData } from './components/ProviderEditor.vue'

const store = useSettingAiStore()
const authStore = useAuthStore()

/** 已登录（登录守卫用） */
const isSignedIn = computed(() => authStore.status === 'signed-in')
const relayEnabled = computed(() => store.relayEnabled)

// ---------- 左侧列表 ----------

const selectedId = ref<string>('')
const isCreating = ref(false)

// ---------- 右侧表单 ----------

const form = reactive<ProviderFormData>({
  id: '',
  name: '',
  baseUrl: '',
  key: '',
  format: 'chat',
  models: []
})

/** 内置供应商项（恒存在） */
const builtinItem = computed(() => store.items.find((i) => i.builtin))
const isBuiltinSelected = computed(() => selectedId.value === BUILTIN_PROVIDER_ID)
const builtinModels = computed(() => builtinItem.value?.models ?? [])

// 选中提供方：填充表单
function selectItem(id: string) {
  if (id === selectedId.value) {
    // 取消选中：内置供应商不可取消，保持选中态
    if (id === BUILTIN_PROVIDER_ID) return
    selectedId.value = ''
    isCreating.value = true
    Object.assign(form, { id: '', name: '', baseUrl: '', key: '', models: [], format: 'chat' })
    return
  }
  selectedId.value = id
  // 内置供应商：进入只读面板，不清表单
  if (id === BUILTIN_PROVIDER_ID) {
    isCreating.value = false
    return
  }
  const item = store.items.find((i) => i.id === id)
  if (item) {
    isCreating.value = false
    Object.assign(form, {
      id: item.id,
      name: item.name,
      baseUrl: item.baseUrl,
      key: item.key,
      models: item.models.map((m) => ({ ...m })),
      format: (item.format || 'chat') as AiProvideFormat
    })
  }
}

// 初始化：数据加载完成后选中第一个（内置恒首项）
watch(
  () => store.items.length,
  (len) => {
    if (!selectedId.value && !isCreating.value && len > 0) {
      selectItem(store.items[0].id)
    }
  },
  { immediate: true }
)

// 免费档（thirdPartyRelay 关闭）：启用项自动切回内置，且强制选中内置
watch(
  () => relayEnabled.value,
  (enabled) => {
    if (!enabled && selectedId.value !== BUILTIN_PROVIDER_ID) {
      selectItem(BUILTIN_PROVIDER_ID)
    }
  },
  { immediate: true }
)

// ---------- 登录守卫（未登录点模型设置 / 意外进入本页） ----------

const router = useRouter()

async function guardLogin(): Promise<boolean> {
  if (isSignedIn.value) return true
  if (authStore.status === 'unknown') {
    // 启动中 / 服务端不可达：先尝试刷新凭证，再按结果判定
    await authStore.refresh()
  }
  if (isSignedIn.value) return true
  MessageUtil.warning('请先登录后使用 AI 设置')
  // 未登录返回首页登录：弹登录框；登录成功回本页（已在 /setting/ai），关闭则回首页
  openLogin(
    () => {
      void store.refreshBuiltinModels().catch(() => undefined)
    },
    () => router.push('/new')
  )
  return false
}

onMounted(() => {
  void guardLogin()
})

// ---------- 内置供应商操作 ----------

async function handleRefreshBuiltin() {
  if (!isSignedIn.value) {
    MessageUtil.warning('请先登录后获取内置模型列表')
    return
  }
  try {
    await store.refreshBuiltinModels()
    MessageUtil.success('模型列表已更新')
  } catch (e) {
    MessageUtil.error('获取内置模型失败: ' + (e as Error).message)
  }
}

// ---------- 保存 ----------

const saving = ref(false)

async function handleSave() {
  if (!form.name) {
    MessageUtil.warning('请输入提供方名称')
    return
  }
  if (!form.baseUrl) {
    MessageUtil.warning('请输入接口地址')
    return
  }
  if (!form.key) {
    MessageUtil.warning('请输入密钥')
    return
  }
  saving.value = true
  try {
    await store.put({
      id: form.id || undefined,
      name: form.name,
      baseUrl: form.baseUrl,
      key: form.key,
      models: form.models,
      format: form.format,
      enable: form.id
        ? (store.items.find((item) => item.id === form.id)?.enable ?? true)
        : true
    })
    if (isCreating.value) {
      const added = store.items.find(
        (item) => item.name === form.name && item.baseUrl === form.baseUrl
      )
      if (added) selectItem(added.id)
      isCreating.value = false
    }
    MessageUtil.success('保存成功')
  } catch (e) {
    MessageUtil.error('保存失败: ' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

// ---------- 新增提供方 ----------

function handleAdd() {
  isCreating.value = true
  Object.assign(form, { id: '', name: '', baseUrl: '', key: '', models: [], format: 'chat' })
  selectedId.value = ''
}

// ---------- 启用 / 删除提供方 ----------

async function handleProvideEnableChange(id: string, val: boolean) {
  const item = store.items.find((i) => i.id === id)
  if (!item || item.builtin) return
  await store.put({
    id: item.id,
    name: item.name,
    baseUrl: item.baseUrl,
    key: item.key,
    models: item.models,
    format: item.format,
    enable: val
  })
}

async function handleDelete(id: string) {
  await store.remove(id)
  if (selectedId.value === id) {
    if (store.items.length > 0) {
      selectItem(store.items[0].id)
    } else {
      selectedId.value = ''
    }
  }
}

// ---------- 模型管理（composable） ----------

const modelsApi = useProviderModels({
  models: form.models,
  onSaved: handleSave
})
</script>

<style scoped lang="less">
.ai-setting-layout {
  display: flex;
  height: calc(100vh - 57px);
  gap: 16px;
}

.ai-setting-main {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding-right: 24px;
  padding-bottom: 24px;
  z-index: 1;
}
</style>
