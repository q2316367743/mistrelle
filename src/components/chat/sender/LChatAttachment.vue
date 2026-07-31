<template>
  <div class="flex gap-8px items-center">
    <t-popup v-model:visible="show" trigger="click" placement="top-left">
      <t-button shape="circle" variant="text">
        <template #icon>
          <add-icon
            :style="{ transform: show ? 'rotate(45deg)' : '', transition: 'all 200ms ease-in-out' }"
          />
        </template>
      </t-button>
      <template #content>
        <div class="l-chat-attachment">
          <!-- 左侧导航 -->
          <div class="l-chat-attachment__nav">
            <div
              v-for="item in panelItems"
              :key="item.value"
              class="l-chat-attachment__nav-item"
              :class="{ 'is-active': activePanel === item.value }"
              @click="activePanel = item.value"
            >
              <component :is="item.icon" class="l-chat-attachment__nav-icon" />
              <span class="l-chat-attachment__nav-label">{{ item.label }}</span>
            </div>
          </div>

          <!-- 右侧内容 -->
          <div class="l-chat-attachment__body">
            <!-- 搜索栏 -->
            <div v-if="showSearch" class="l-chat-attachment__search">
              <search-icon class="l-chat-attachment__search-icon" />
              <input
                v-model="keyword"
                class="l-chat-attachment__search-input"
                :placeholder="searchPlaceholder"
              />
            </div>

            <!-- 列表内容 -->
            <div class="l-chat-attachment__content">
              <!-- 技能面板 -->
              <template v-if="activePanel === 'skill'">
                <div
                  v-for="item in filteredSkills"
                  :key="item.path"
                  class="l-chat-attachment__row"
                  @click="selectSkill(item)"
                >
                  <span class="l-chat-attachment__row-avatar">{{ item.name.charAt(0) }}</span>
                  <div class="l-chat-attachment__row-info" :title="item.name">
                    <span class="l-chat-attachment__row-name">{{ item.name }}</span>
                    <span class="l-chat-attachment__row-desc">{{
                      item.description || item.dirName
                    }}</span>
                  </div>
                </div>
                <div v-if="filteredSkills.length === 0" class="l-chat-attachment__empty">
                  暂无匹配结果
                </div>
              </template>

              <!-- 工具面板 -->
              <template v-else-if="activePanel === 'tool'">
                <template v-for="group in filteredToolGroups" :key="group.group">
                  <div class="l-chat-attachment__group-title">{{ group.group }}</div>
                  <div
                    v-for="tool in group.children"
                    :key="tool.value"
                    class="l-chat-attachment__row"
                    @click="selectTool(tool, group.group)"
                  >
                    <span class="l-chat-attachment__row-avatar is-tool">{{
                      String(tool.label).charAt(0)
                    }}</span>
                    <div class="l-chat-attachment__row-info" :title="tool.label">
                      <span class="l-chat-attachment__row-name">{{ tool.label }}</span>
                      <span class="l-chat-attachment__row-desc">{{ tool.value }}</span>
                    </div>
                  </div>
                </template>
                <div v-if="filteredToolGroups.length === 0" class="l-chat-attachment__empty">
                  暂无匹配结果
                </div>
              </template>

              <!-- 专家面板 -->
              <template v-else-if="activePanel === 'expert'">
                <template v-for="group in groupedAgents" :key="group.category">
                  <div class="l-chat-attachment__group-title">{{ group.label }}</div>
                  <div
                    v-for="item in group.children"
                    :key="item.id"
                    :class="['l-chat-attachment__row', { 'is-active': item.id === agent }]"
                    :title="item.name"
                    @click="selectAgent(item.id)"
                  >
                    <span class="l-chat-attachment__row-avatar is-expert">{{
                      item.name.charAt(0)
                    }}</span>
                    <span class="l-chat-attachment__row-name-inline">{{ item.name }}</span>
                  </div>
                </template>
                <div v-if="groupedAgents.length === 0" class="l-chat-attachment__empty">
                  暂无匹配结果
                </div>
                <button class="l-chat-attachment__more-btn" @click="goToAgentPage">
                  <arrow-right-icon />召唤更多专家
                </button>
              </template>

              <!-- 模式面板 -->
              <template v-else-if="activePanel === 'mode'">
                <div class="l-chat-attachment__mode-desc">{{ currentModeDesc }}</div>
                <div
                  v-for="item in modeToggleOptions"
                  :key="item.value"
                  class="l-chat-attachment__mode-row"
                  :title="item.label"
                  @click="selectMode(item.value)"
                >
                  <span class="l-chat-attachment__mode-label">{{ item.label }}</span>
                  <span class="l-chat-attachment__mode-en">{{ item.en }}</span>
                  <span
                    class="l-chat-attachment__mode-switch"
                    :class="{ 'is-on': currentMode === item.value }"
                  />
                </div>
              </template>

              <!-- 添加文件 -->
              <template v-else-if="activePanel === 'file'">
                <template v-if="projectFiles.length > 0">
                  <div class="l-chat-attachment__group-title">项目资产</div>
                  <div
                    v-for="file in projectFiles"
                    :key="file.path"
                    class="l-chat-attachment__row"
                    @click="selectRefItem(file)"
                  >
                    <file-icon class="l-chat-attachment__row-icon" />
                    <div class="l-chat-attachment__row-info" :title="file.name">
                      <span class="l-chat-attachment__row-name">{{ file.name }}</span>
                      <span class="l-chat-attachment__row-desc">{{ file.relativePath }}</span>
                    </div>
                  </div>
                </template>
                <template v-if="workspaceDir">
                  <div class="l-chat-attachment__group-title">工作空间</div>
                  <div
                    v-if="canBackWorkspace"
                    class="l-chat-attachment__row"
                    @click="backWorkspaceDir"
                  >
                    <folder-icon class="l-chat-attachment__row-icon" />
                    <div class="l-chat-attachment__row-info">
                      <span class="l-chat-attachment__row-name">返回上级</span>
                      <span class="l-chat-attachment__row-desc">{{ workspaceRelativeDir }}</span>
                    </div>
                  </div>
                  <div v-if="workspaceFiles.loading" class="l-chat-attachment__empty">
                    加载中...
                  </div>
                  <template v-else>
                    <div
                      v-for="item in workspaceFiles.items"
                      :key="item.path"
                      class="l-chat-attachment__row"
                      @click="selectWorkspaceItem(item)"
                    >
                      <component
                        :is="item.isDirectory ? FolderIcon : FileIcon"
                        class="l-chat-attachment__row-icon"
                      />
                      <div class="l-chat-attachment__row-info">
                        <span class="l-chat-attachment__row-name">{{ item.name }}</span>
                        <span class="l-chat-attachment__row-desc">{{
                          workspaceItemDesc(item)
                        }}</span>
                      </div>
                    </div>
                    <div v-if="workspaceFiles.items.length === 0" class="l-chat-attachment__empty">
                      当前目录暂无文件
                    </div>
                  </template>
                </template>
                <div class="l-chat-attachment__group-title">本地文件</div>
                <div class="l-chat-attachment__row" @click="selectRefFile">
                  <file-add-icon class="l-chat-attachment__row-icon" />
                  <div class="l-chat-attachment__row-info">
                    <span class="l-chat-attachment__row-name">从本地选择</span>
                    <span class="l-chat-attachment__row-desc">从文件系统选择文件</span>
                  </div>
                </div>
              </template>

              <!-- 引用文件 -->
              <template v-else-if="activePanel === 'ref-file'">
                <div class="l-chat-attachment__row" @click="selectRefFile">
                  <folder-icon class="l-chat-attachment__row-icon" />
                  <div class="l-chat-attachment__row-info">
                    <span class="l-chat-attachment__row-name">从本地选择</span>
                    <span class="l-chat-attachment__row-desc">从文件系统选择文件</span>
                  </div>
                </div>
                <div v-if="sandboxFiles.loading" class="l-chat-attachment__empty">加载中...</div>
                <template v-else>
                  <div v-if="sandboxFiles.inputs.length > 0" class="l-chat-attachment__group-title">
                    输入 (inputs)
                  </div>
                  <div
                    v-for="file in sandboxFiles.inputs"
                    :key="file.path"
                    class="l-chat-attachment__row"
                    @click="selectSandboxFile(file)"
                  >
                    <file-icon class="l-chat-attachment__row-icon" />
                    <div class="l-chat-attachment__row-info" :title="file.name">
                      <span class="l-chat-attachment__row-name">{{ file.name }}</span>
                      <span class="l-chat-attachment__row-desc">{{ file.relativePath }}</span>
                    </div>
                  </div>
                  <div
                    v-if="sandboxFiles.outputs.length > 0"
                    class="l-chat-attachment__group-title"
                  >
                    输出 (outputs)
                  </div>
                  <div
                    v-for="file in sandboxFiles.outputs"
                    :key="file.path"
                    class="l-chat-attachment__row"
                    @click="selectSandboxFile(file)"
                  >
                    <file-icon class="l-chat-attachment__row-icon" />
                    <div class="l-chat-attachment__row-info">
                      <span class="l-chat-attachment__row-name">{{ file.name }}</span>
                      <span class="l-chat-attachment__row-desc">{{ file.relativePath }}</span>
                    </div>
                  </div>
                  <div
                    v-if="sandboxFiles.inputs.length === 0 && sandboxFiles.outputs.length === 0"
                    class="l-chat-attachment__empty"
                  >
                    暂无文件
                  </div>
                </template>
              </template>
            </div>

            <!-- 底部操作区 -->
            <div v-if="showFooter" class="l-chat-attachment__footer">
              <template v-if="activePanel === 'skill'">
                <button class="l-chat-attachment__footer-btn" @click="emit('addLocalSkill')">
                  <upload-icon />从本地添加技能
                </button>
                <button class="l-chat-attachment__footer-btn" @click="goToSkillPage">
                  管理技能
                </button>
              </template>
              <template v-else>
                <button class="l-chat-attachment__footer-btn" @click="emitManage">
                  管理{{ activePanelLabel }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </template>
    </t-popup>
    <t-tag
      v-if="selectedAgent"
      closable
      theme="primary"
      variant="light-outline"
      @close="selectAgent('')"
    >
      <template #icon> <ai-education-icon /> </template>
      {{ selectedAgent.name }}
    </t-tag>
  </div>
</template>

<script lang="ts" setup>
import {
  AiEducationIcon,
  ArrowRightIcon,
  FileAddIcon,
  FileIcon,
  FolderIcon,
  SearchIcon,
  UploadIcon,
  CodeIcon,
  LightbulbIcon,
  ToolsIcon,
  AddIcon
} from 'tdesign-icons-vue-next'
import type { Component } from 'vue'
import { localSkillList, type LocalSkill } from '@/modules/skill'
import { toolOptions } from '@/modules/tool'
import { useAiAgentStore } from '@/store'
import { AI_AGENT_CATEGORIES } from '@/entity/ai'
import type { ToolSuggestionItem } from './mentionSuggestion'
import { CommonSelect } from '@/domain'
import { loadChatFiles, type ChatFileRef } from '@/utils/chatSender'

/** 面板类型 */
type PanelType = 'skill' | 'tool' | 'expert' | 'mode' | 'file' | 'ref-file'

/** 导航项定义 */
interface NavItem {
  value: PanelType
  label: string
  icon: Component
}

/** 模式切换项 */
interface ModeToggleOption {
  value: string
  label: string
  en: string
}

// ─── Props & Emits ───────────────────────────────────────
const props = withDefaults(
  defineProps<{
    agent?: string
    mode?: string
    sandboxDir?: string
    workspaceDir?: string
    projectFiles?: ChatFileRef[]
  }>(),
  {
    agent: '',
    mode: '',
    sandboxDir: '',
    workspaceDir: '',
    projectFiles: () => []
  }
)
const emit = defineEmits<{
  'update:agent': [agentId: string]
  'update:mode': [mode: string]
  addSkill: [skill: LocalSkill]
  addTool: [tool: ToolSuggestionItem]
  addRefFile: [file: ChatFileRef]
  addLocalSkill: []
}>()

// ─── Router ──────────────────────────────────────────────
const router = useRouter()

// ─── State ────────────────────────────────────────────────
const activePanel = ref<PanelType>('skill')
const keyword = ref('')
const skills = ref<LocalSkill[]>([])
const show = ref(false)
const sandboxFiles = ref<{ inputs: ChatFileRef[]; outputs: ChatFileRef[]; loading: boolean }>({
  inputs: [],
  outputs: [],
  loading: false
})
const workspaceCurrentDir = ref('')
const workspaceFiles = ref<{ items: FileItem[]; loading: boolean }>({ items: [], loading: false })

watch(
  () => props.sandboxDir,
  async (dir) => {
    if (!dir) {
      sandboxFiles.value = { inputs: [], outputs: [], loading: false }
      return
    }
    sandboxFiles.value = { ...sandboxFiles.value, loading: true }
    const inputsDir = window.preload.path.join(dir, 'inputs')
    const outputsDir = window.preload.path.join(dir, 'outputs')
    const [inputs, outputs] = await Promise.all([
      loadChatFiles(inputsDir),
      loadChatFiles(outputsDir)
    ])
    sandboxFiles.value = { inputs, outputs, loading: false }
  },
  { immediate: true }
)

// ─── Computed ─────────────────────────────────────────────
const agents = computed(() => useAiAgentStore().all)
const selectedAgent = computed(() => agents.value.find((item) => item.id === props.agent))
const currentMode = computed(() => props.mode || 'craft')
const projectFiles = computed(() => props.projectFiles)
const workspaceDir = computed(() => props.workspaceDir)
const canBackWorkspace = computed(() => {
  if (!workspaceCurrentDir.value || !props.workspaceDir) return false
  return (
    window.preload.path.resolve(workspaceCurrentDir.value) !==
    window.preload.path.resolve(props.workspaceDir)
  )
})
const workspaceRelativeDir = computed(() => {
  if (!workspaceCurrentDir.value || !props.workspaceDir) return ''
  return (
    relativeFromRoot(workspaceCurrentDir.value, props.workspaceDir) ||
    window.preload.path.basename(props.workspaceDir)
  )
})

/** 导航项配置（左侧） */
const panelItems: NavItem[] = [
  { value: 'file', label: '添加文件', icon: FileAddIcon },
  { value: 'ref-file', label: '引用对话中的文件', icon: FolderIcon },
  { value: 'mode', label: '模式', icon: CodeIcon },
  { value: 'expert', label: 'Agent', icon: AiEducationIcon },
  { value: 'skill', label: '技能', icon: LightbulbIcon },
  { value: 'tool', label: '工具', icon: ToolsIcon }
]

/** 当前面板标签名 */
const activePanelLabel = computed(
  () => panelItems.find((item) => item.value === activePanel.value)?.label ?? ''
)

/** 是否显示搜索栏 */
const showSearch = computed(() => ['skill', 'tool', 'expert'].includes(activePanel.value))

/** 是否显示底部操作区 */
const showFooter = computed(() => ['skill', 'tool', 'expert'].includes(activePanel.value))

/** 搜索占位文字 */
const searchPlaceholder = computed(() => {
  const map: Record<string, string> = { skill: '搜索技能', tool: '搜索工具', expert: '搜索专家' }
  return map[activePanel.value] ?? '搜索'
})

/** 当前模式描述文字 */
const currentModeDesc = computed(() => {
  const map: Record<string, string> = {
    craft: '当前为默认模式，可高效执行并完成任务。',
    plan: '当前为规划模式，会先制定方案再执行。',
    ask: '当前为咨询模式，仅回答问题不执行操作。'
  }
  return map[currentMode.value] ?? '当前为默认模式，可高效执行并完成任务。'
})

/** 过滤后的技能列表 */
const filteredSkills = computed(() => {
  if (!keyword.value) return skills.value
  const kw = keyword.value.toLowerCase()
  return skills.value.filter((s) =>
    `${s.name} ${s.dirName} ${s.description}`.toLowerCase().includes(kw)
  )
})

/** 过滤后的工具分组 */
const filteredToolGroups = computed(() => {
  if (!keyword.value) return toolOptions
  const kw = keyword.value.toLowerCase()
  return toolOptions
    .map((group) => ({
      ...group,
      children: group.children.filter((t) =>
        `${String(t.label)} ${String(t.value)}`.toLowerCase().includes(kw)
      )
    }))
    .filter((g) => g.children.length > 0)
})

/** 按分类分组的 Agent 列表 */
const groupedAgents = computed(() => {
  let list = agents.value
  const kw = keyword.value.toLowerCase()
  if (kw) {
    list = list.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(kw))
  }
  const groups: Array<{ category: string; label: string; children: typeof list }> = []
  const uncategorized: typeof list = []
  for (const cat of AI_AGENT_CATEGORIES) {
    const children = list.filter((a) => a.category === cat.value)
    if (children.length > 0) {
      groups.push({ category: cat.value, label: cat.label, children })
    }
  }
  const others = list.filter((a) => !a.category)
  if (others.length > 0) {
    groups.push({ category: '', label: '其他', children: others })
  }
  return groups
})

/** 模式切换选项 */
const modeToggleOptions: ModeToggleOption[] = [
  { value: 'plan', label: '计划', en: 'Plan' },
  { value: 'ask', label: '仅问答', en: 'Ask' }
]

// ─── 选择动作 ─────────────────────────────────────────────
const selectSkill = (skill: LocalSkill) => {
  emit('addSkill', skill)
  keyword.value = ''
  show.value = false
}

const selectTool = (tool: CommonSelect, group: string) => {
  emit('addTool', { id: String(tool.value), label: String(tool.label), group })
  keyword.value = ''
  show.value = false
}

const selectAgent = (agentId: string) => {
  emit('update:agent', agentId)
  keyword.value = ''
  show.value = false
}

const clearAgent = () => emit('update:agent', '')

const selectMode = (mode: string) => {
  emit('update:mode', currentMode.value === mode ? 'craft' : mode)
  keyword.value = ''
}

const selectRefFile = () => {
  const paths = window.preload.inject.dialog.open({ properties: ['openFile'] })
  if (!paths || paths.length === 0) return
  const filePath = paths[0]
  const name = filePath.split('/').pop() || filePath.split('\\').pop() || 'file'
  emit('addRefFile', { name, path: filePath, relativePath: name })
  show.value = false
}

const selectSandboxFile = (file: ChatFileRef) => {
  emit('addRefFile', file)
  show.value = false
}

const selectRefItem = (file: ChatFileRef) => {
  emit('addRefFile', file)
  show.value = false
}

const selectWorkspaceItem = async (item: FileItem) => {
  if (item.isDirectory) {
    await loadWorkspaceDir(item.path)
    return
  }
  if (!item.isFile) return
  selectRefItem({
    name: item.name,
    path: item.path,
    relativePath: relativeFromRoot(item.path, props.workspaceDir)
  })
}

const backWorkspaceDir = async () => {
  if (!canBackWorkspace.value) return
  await loadWorkspaceDir(window.preload.path.dirname(workspaceCurrentDir.value))
}

const loadWorkspaceDir = async (dir: string) => {
  if (!props.workspaceDir || !dir) return
  workspaceCurrentDir.value = dir
  workspaceFiles.value = { ...workspaceFiles.value, loading: true }
  try {
    const items = (await window.preload.fs.readDir(dir))
      .filter((item) => !item.name.startsWith('.'))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    workspaceFiles.value = { items, loading: false }
  } catch {
    workspaceFiles.value = { items: [], loading: false }
  }
}

const workspaceItemDesc = (item: FileItem) =>
  item.isDirectory ? '目录' : relativeFromRoot(item.path, props.workspaceDir)

const relativeFromRoot = (filePath: string, rootDir: string): string => {
  if (!rootDir) return filePath
  const root = window.preload.path.resolve(rootDir)
  const full = window.preload.path.resolve(filePath)
  const prefix = root.endsWith(window.preload.path.sep) ? root : `${root}${window.preload.path.sep}`
  if (full === root) return ''
  return full.startsWith(prefix)
    ? full.slice(prefix.length).split(window.preload.path.sep).join('/')
    : full
}

/** 跳转到专家管理页面 */
const goToAgentPage = () => router.push('/agent')
const goToSkillPage = () => router.push('/skill')

const emitManage = () => {
  if (activePanel.value === 'expert') {
    goToAgentPage()
  }
}

// ─── Lifecycle ───────────────────────────────────────────
onMounted(async () => {
  skills.value = await localSkillList()
})

watch(
  () => [props.workspaceDir, activePanel.value, show.value],
  async () => {
    if (!show.value || activePanel.value !== 'file' || !props.workspaceDir) {
      workspaceCurrentDir.value = ''
      workspaceFiles.value = { items: [], loading: false }
      return
    }
    await loadWorkspaceDir(props.workspaceDir)
  }
)
</script>

<style scoped lang="less">
.l-chat-attachment {
  display: flex;
  width: 480px;
  height: 380px;
  overflow: hidden;
}

/* ─── 左侧导航 ──────────────────────────────────── */
.l-chat-attachment__nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 160px;
  flex-shrink: 0;
  padding: 6px;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 1px solid var(--td-component-border);
}

.l-chat-attachment__nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--td-radius-medium);
  color: var(--td-text-color-primary);
  font-size: var(--td-font-size-body-medium);
  text-align: left;
  cursor: pointer;
  transition:
    background 150ms,
    color 150ms;

  &:hover,
  &.is-active {
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
  }
}

.l-chat-attachment__nav-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.l-chat-attachment__nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── 右侧内容区 ────────────────────────────────── */
.l-chat-attachment__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

/* ─── 搜索栏 ────────────────────────────────────── */
.l-chat-attachment__search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 8px 0;
  padding: 0 10px;
  height: 32px;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background: var(--td-bg-color-input);
  transition: border-color 150ms;

  &:focus-within {
    border-color: var(--td-brand-color);
  }
}

.l-chat-attachment__search-icon {
  font-size: 14px;
  color: var(--td-text-color-placeholder);
  flex-shrink: 0;
}

.l-chat-attachment__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--td-text-color-primary);
  font-size: var(--td-font-size-body-medium);

  &::placeholder {
    color: var(--td-text-color-placeholder);
  }
}

/* ─── 列表内容 ──────────────────────────────────── */
.l-chat-attachment__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.l-chat-attachment__group-title {
  padding: 6px 4px 2px;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-small);
  font-weight: 500;
}

.l-chat-attachment__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background 150ms;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }

  &.is-active {
    background: var(--td-brand-color-light);
  }
}

.l-chat-attachment__row-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--td-radius-circle);
  background: var(--td-brand-color-light);
  color: var(--td-brand-color);
  font-size: var(--td-font-size-body-medium);
  font-weight: 600;
  flex-shrink: 0;

  &.is-tool {
    background: var(--td-success-color-light);
    color: var(--td-success-color);
  }

  &.is-expert {
    background: var(--td-warning-color-light);
    color: var(--td-warning-color);
  }
}

.l-chat-attachment__row-icon {
  font-size: 20px;
  color: var(--td-brand-color);
  flex-shrink: 0;
}

.l-chat-attachment__row-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.l-chat-attachment__row-name-inline {
  overflow: hidden;
  color: var(--td-text-color-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.l-chat-attachment__row-name {
  overflow: hidden;
  color: var(--td-text-color-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.l-chat-attachment__row-desc {
  overflow: hidden;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-small);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.l-chat-attachment__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-medium);
}

/* ─── 专家面板：召唤更多专家 ─────────────────────── */
.l-chat-attachment__more-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 10px;
  margin-top: 4px;
  border: none;
  border-top: 1px solid var(--td-component-stroke);
  border-radius: 0;
  background: transparent;
  color: var(--td-text-color-secondary);
  font-size: var(--td-font-size-body-medium);
  cursor: pointer;
  transition: color 150ms;

  &:hover {
    color: var(--td-text-color-primary);
  }
}

/* ─── 模式面板 ──────────────────────────────────── */
.l-chat-attachment__mode-desc {
  padding: 4px 6px 12px;
  color: var(--td-text-color-secondary);
  font-size: var(--td-font-size-body-medium);
  line-height: 1.5;
}

.l-chat-attachment__mode-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 6px;
  border-radius: var(--td-radius-medium);
  cursor: pointer;
  transition: background 150ms;

  &:hover {
    background: var(--td-bg-color-container-hover);
  }
}

.l-chat-attachment__mode-label {
  color: var(--td-text-color-primary);
  font-size: var(--td-font-size-body-medium);
  font-weight: 500;
}

.l-chat-attachment__mode-en {
  color: var(--td-text-color-placeholder);
  font-size: var(--td-font-size-body-small);
  margin-left: 2px;
}

.l-chat-attachment__mode-switch {
  margin-left: auto;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--td-component-stroke);
  position: relative;
  transition: background 200ms;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--td-bg-color-container);
    box-shadow: var(--td-shadow-inset-top);
    transition: transform 200ms;
  }

  &.is-on {
    background: var(--td-brand-color);

    &::after {
      transform: translateX(16px);
    }
  }
}

/* ─── 底部操作区 ────────────────────────────────── */
.l-chat-attachment__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid var(--td-component-border);
}

.l-chat-attachment__footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: none;
  border-radius: var(--td-radius-medium);
  background: transparent;
  color: var(--td-text-color-secondary);
  font-size: var(--td-font-size-body-small);
  cursor: pointer;
  transition:
    background 150ms,
    color 150ms;

  &:hover {
    background: var(--td-bg-color-container-hover);
    color: var(--td-text-color-primary);
  }
}
</style>
