<template>
  <div class="skill-local">
    <skill-side-list
      :list="list"
      :agents="agents"
      :loading="loading"
      :selected-key="selectedKey"
      @select="selectSkill"
      @create="handleCreate"
      @refresh="load"
      @manage="openAgentManage(loadAgents)"
    />
    <skill-detail
      :skill="selected"
      :content="content"
      :files="files"
      :detail-loading="detailLoading"
      @open-folder="handleOpenFolder"
      @remove="handleRemove"
      @reload-files="handleReloadFiles"
      @open-file="openSkillFileView"
    />
  </div>
</template>
<script lang="ts" setup>
import {
  LocalSkill,
  LocalSkillFile,
  SkillAgent,
  localSkillContentGet,
  localSkillFiles,
  localSkillList,
  skillAgentList
} from '@/modules/skill'
import { openAgentManage, openSkillFileView, openSkillPut, openSkillRemove } from './modals/skill-func'
import SkillSideList from './components/SkillSideList.vue'
import SkillDetail from './components/SkillDetail.vue'
import { MessageUtil } from '@/utils/modal'

const loading = ref(false)
const detailLoading = ref(false)
const list = ref<Array<LocalSkill>>([])
const agents = ref<Array<SkillAgent>>([])
const selected = ref<LocalSkill | null>(null)
const content = ref('')
const files = ref<Array<LocalSkillFile>>([])

const selectedKey = computed(() =>
  selected.value ? selected.value.agentKey + '/' + selected.value.dirName : ''
)

const load = async () => {
  loading.value = true
  try {
    list.value = await localSkillList()
    if (selected.value) {
      const key = selected.value.agentKey + '/' + selected.value.dirName
      const next = list.value.find((e) => e.agentKey + '/' + e.dirName === key)
      if (next) {
        selected.value = next
        await loadDetail(next)
      } else {
        selected.value = null
        content.value = ''
        files.value = []
      }
    }
  } catch (e) {
    MessageUtil.error('加载失败', e)
  } finally {
    loading.value = false
  }
}

const loadAgents = () => {
  agents.value = skillAgentList()
  load()
}

const loadDetail = async (skill: LocalSkill) => {
  detailLoading.value = true
  try {
    const [md, fileList] = await Promise.all([localSkillContentGet(skill), localSkillFiles(skill)])
    content.value = md
    files.value = fileList
  } catch (e) {
    MessageUtil.error('加载详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

const selectSkill = (skill: LocalSkill) => {
  selected.value = skill
  loadDetail(skill)
}

const handleCreate = () => openSkillPut(load)

const handleOpenFolder = () => {
  if (!selected.value) return
  window.preload.inject.shell.showItemInFolder(selected.value.path)
}

const handleRemove = () => {
  if (!selected.value) return
  openSkillRemove(selected.value, async () => {
    selected.value = null
    content.value = ''
    files.value = []
    await load()
  })
}

const handleReloadFiles = () => {
  if (selected.value) loadDetail(selected.value)
}

onMounted(loadAgents)
</script>
<style scoped lang="less">
.skill-local {
  display: flex;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--td-component-border);
  border-radius: var(--td-radius-medium);
  background-color: var(--td-bg-color-container);
}
</style>
