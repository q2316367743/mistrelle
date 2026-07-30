import { defineStore } from 'pinia'
import { AiAgent, AiAgentForm } from '@/entity/ai'
import { listByAsync, saveListByAsync } from '@/utils/native'
import { LocalNameEnum } from '@/global/LocalNameEnum'
import { useLog } from '@/hooks/UseLog'
import { useSnowflake } from '@/hooks'
import { CommonSelect } from '@/domain'

/**
 * 内置 Agent 常量。由代码预置、只读，不可编辑或删除。
 * agent-create 绑定「专家管理」工具集（@/modules/tool/components/agent）实现真正的增改查落库；
 * skill-create 依赖对话默认常驻的 shell/file/skill 工具集（defaultTools），无需重复声明。
 */
const BUILTIN_AGENTS: ReadonlyArray<AiAgent> = [
  {
    id: 'builtin:agent-create',
    name: '专家创建助手',
    description: '通过对话创建或修改 AI 专家（Agent）：设计身份、性格与工具，确认后直接落库保存。',
    identity: [
      '你是一个「专家创建助手」，负责帮助使用者创建和维护本系统的 AI 专家（Agent）。',
      '你熟悉本系统的专家配置结构，一个专家包含以下字段：',
      '- name：专家名称',
      '- description：一句话描述其擅长领域',
      '- identity（身份）：定义专家是谁、角色定位与能力边界',
      '- personality（性格）：语气、行为准则',
      '- aboutMe（关于我）：需要记住的用户信息',
      '- tools（工具）：可启用的工具名列表',
      '- model（默认模型）与 placeholder（输入框占位文案）',
      '- think（是否深度思考）',
      '',
      '你拥有以下专属工具，必须通过它们完成实际操作：',
      '- list_tools：查询系统全部可分配工具（分组、说明、风险级），为专家选 tools 前必须先调用',
      '- list_agents：查询全部专家概要，创建前先查重、修改前先定位目标 id',
      '- get_agent：按 id 查询专家完整配置，修改前必须先调用以获取现状',
      '- create_agent：创建并保存新专家，成功后返回 id',
      '- update_agent：按 id 修改已有专家，只传需要变更的字段；内置专家只读不可改',
      '',
      '你的工作方式：',
      '1. 先用简短提问澄清使用者的真实目标、使用场景与期望产出；',
      '2. 若专家需要额外工具能力，先调用 list_tools 了解可选工具，只从返回结果中挑选；对话常驻的基础工具（shell/文件/http/skill）无需声明；',
      '3. 产出完整的专家配置草案（各字段内容与选定工具及理由），向使用者展示并确认；',
      '4. 确认后调用 create_agent / update_agent 落库，并回告结果与专家 id；',
      '5. 修改场景必须先 get_agent 获取当前配置，只改需要改的字段，不要覆盖使用者未提及的内容。'
    ].join('\n'),
    personality:
      '严谨、耐心、结构化。先理解需求再动手；不臆造不存在的工具名（tools 字段只填系统已注册的工具名，不确定时留空）；落库前必须经使用者确认；用中文、条理清晰。',
    aboutMe: '',
    tools: ['list_tools', 'list_agents', 'get_agent', 'create_agent', 'update_agent'],
    model: '',
    placeholder: '描述你想要创建的专家，例如：一个能帮我审代码的资深前端工程师',
    think: true,
    category: 'built-in',
    top: false,
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'builtin:skill-create',
    name: '技能创建助手',
    description: '帮助你创建 Skill（技能包）：规划能力边界、生成 SKILL.md 及配套脚本/参考文件。',
    identity: [
      '你是一个「技能创建助手」，专门帮助使用者创建本系统的 Skill（技能包）。',
      '一个 Skill 是一个带 SKILL.md 的能力包：SKILL.md 以 YAML frontmatter（name / description / 触发方式等）开头，后接 Markdown 指令正文。',
      '你熟悉技能目录结构，可调用 load_skill 参考已有技能、用文件/脚本工具在工作空间写出 SKILL.md 与配套文件。',
      '',
      '你的工作方式：先澄清技能要解决的任务、触发场景与输入/产出，再产出清晰可执行的技能定义；必要时直接落地为文件，让能力可被复用。'
    ].join('\n'),
    personality:
      '务实、模块化、可复用优先。强调能力边界清晰、指令无歧义、示例充分；不臆造工具；用中文；引导使用者把能力沉淀为可复用技能。',
    aboutMe: '',
    tools: [],
    model: '',
    placeholder: '描述你想创建的技能，例如：一个把网页内容转成结构化摘要的技能',
    think: true,
    category: 'built-in',
    top: false,
    builtin: true,
    createdAt: 0,
    updatedAt: 0
  }
]

/** 内置 Agent 的 id 集合，用于快速判定只读项 */
const BUILTIN_IDS: ReadonlySet<string> = new Set(BUILTIN_AGENTS.map((e) => e.id))

export const useAiAgentStore = defineStore('ai-agent', () => {
  const logger = useLog({ name: 'store:ai-agent' })

  const state = ref(new Array<AiAgent>())
  const rev = ref<string>()

  /** 内置 Agent + 用户自建 Agent，供列表与选择器统一消费 */
  const all = computed<Array<AiAgent>>(() => [...BUILTIN_AGENTS, ...state.value])

  const options = computed<Array<CommonSelect>>(() => {
    return all.value.map((e) => ({ label: e.name, value: e.id }))
  })

  const init = async () => {
    const res = await listByAsync<AiAgent>(LocalNameEnum.LIST_AI_AGENT)
    state.value = res.list
    rev.value = res.rev
  }

  init().then(() => logger.debug('AI 分组初始化成功'))

  /**
   * 新增或更新 Agent，返回落库后的 agent id。
   * 内置 Agent 只读：传入内置 id 时直接返回该 id，不做任何写入。
   */
  const put = async (form: AiAgentForm, id?: string): Promise<string> => {
    // 内置 Agent 只读，拒绝写入
    if (id && BUILTIN_IDS.has(id)) return id
    let resultId = id
    let add = true
    if (id) {
      const index = state.value.findIndex((item) => item.id === id)
      if (index > -1) {
        state.value[index] = {
          ...state.value[index],
          ...form,
          updatedAt: Date.now()
        }
        add = false
      }
    }
    if (add) {
      resultId = useSnowflake().nextId()
      state.value.push({
        ...form,
        id: resultId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        top: false
      })
    }
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_AGENT, state.value, rev.value)
    // add 分支必然已赋值 resultId；更新分支 id 必存在
    return resultId as string
  }

  const remove = async (id: string) => {
    // 内置 Agent 只读，拒绝删除
    if (BUILTIN_IDS.has(id)) return
    state.value = state.value.filter((item) => item.id !== id)
    rev.value = await saveListByAsync(LocalNameEnum.LIST_AI_AGENT, state.value, rev.value)
  }

  const getById = (id?: string): AiAgent | undefined => {
    if (!id) return undefined
    return all.value.find((item) => item.id === id)
  }

  return {
    state,
    all,
    options,
    put,
    remove,
    getById
  }
})
