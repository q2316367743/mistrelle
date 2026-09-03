export const Constant = {
  // 插件的ID
  uid: 'zimjyydo',
  // 项目名称，英文名称
  id: 'mistrelle',
  // 项目中文名称
  name: '半窗烟雨',
  // 版本
  version: '1.0.0',
  // 作者
  author: '落雨不悔',
  // 仓库
  repo: ''
}

export const LOADING_TEXTS = [
  '正在努力思考中…',
  '正在思考人生…',
  '正在分析数据…',
  '正在翻阅知识库…',
  '正在构思回答…',
  '正在连接神经元…',
  '正在给大脑加个速…',
  '正在整理思维碎片…',
  '正在召唤灵感精灵…',
  '正在穿越信息海洋…',
  '正在拼凑答案碎片…',
  '正在向宇宙发送请求…',
  '正在喂饱神经网络…',
  '正在泡一杯电子咖啡…',
  '正在给逻辑链条上油…',
  '正在唤醒沉睡的知识…',
  '正在把问号拉直成感叹号…',
  '正在用算法按摩脑细胞…',
  '正在调取平行宇宙的答案…',
  '正在把0和1排成队…'
]

export const appData = window.preload.path.join(
  window.preload.inject.os.getPath('appData'),
  Constant.id
)

// ~/.mistrelle
export const dataFolder = window.preload.path.join(
  window.preload.inject.os.getPath('home'),
  `.${Constant.id}`
)

/**
 * 聊天沙盒与产物根目录：~/.mistrelle/workspace
 * （聊天列表与消息体已迁 SQLite，index.json / message/*.json 由迁移脚本处理；
 *  此目录仍用于各聊天的 outputs/inputs/tmp 产物）
 */
export const getDataForWorkspace = () => {
  return window.preload.path.join(dataFolder, 'workspace')
}

// ~/.mistrelle/design
export const getAppData2Design = () => {
  return window.preload.path.join(dataFolder, 'design')
}

// ~/.mistrelle/soul：记忆系统（长期记忆 / 每日短期记忆 / 记忆状态）+ 个性化设定文件
export const getSoulDir = () => window.preload.path.join(dataFolder, 'soul')

// soul/ 下的个性化设定文件（IDENTITY.md / DESIGN.md / WRITE.md / AGENT.md / USER.md）
export const getSoulFilePath = (fileName: string) =>
  window.preload.path.join(getSoulDir(), fileName)

// 长期记忆：~/.mistrelle/soul/MEMORY.md
export const getSoulMemoryPath = () => window.preload.path.join(getSoulDir(), 'MEMORY.md')

// 长期记忆覆写前备份（单代）：~/.mistrelle/soul/MEMORY.md.bak
export const getSoulMemoryBackupPath = () =>
  window.preload.path.join(getSoulDir(), 'MEMORY.md.bak')

// 每日短期记忆目录：~/.mistrelle/soul/memory/YYYY-MM-DD.md
export const getSoulMemoryDir = () => window.preload.path.join(getSoulDir(), 'memory')

// 指定日期的短期记忆文件
export const getSoulMemoryDayPath = (date: string) =>
  window.preload.path.join(getSoulMemoryDir(), `${date}.md`)

// 记忆系统状态：~/.mistrelle/soul/state.json
export const getSoulStatePath = () => window.preload.path.join(getSoulDir(), 'state.json')

// AI 模型配置文件路径：~/.mistrelle/setting/model.json
export const getModelPath = () => window.preload.path.join(dataFolder, 'setting', 'model.json')

// AI Agent 配置文件路径：~/.mistrelle/setting/agent.json
export const getAgentPath = () => window.preload.path.join(dataFolder, 'setting', 'agent.json')

// 账户配置文件路径：~/.mistrelle/setting/account.json（整文件 safeStorage 加密存储）
export const getAccountPath = () => window.preload.path.join(dataFolder, 'setting', 'account.json')

// 设置-网络配置文件路径：~/.mistrelle/setting/network.json
export const getSettingNetworkPath = () =>
  window.preload.path.join(dataFolder, 'setting', 'network.json')

// 设置-全局配置文件路径：~/.mistrelle/setting/global.json
export const getSettingGlobalPath = () =>
  window.preload.path.join(dataFolder, 'setting', 'global.json')

// 设置-安全配置文件路径：~/.mistrelle/setting/secure.json
export const getSettingSecurePath = () =>
  window.preload.path.join(dataFolder, 'setting', 'secure.json')

// 设置-默认模型配置文件路径：~/.mistrelle/setting/default.json
export const getSettingDefaultPath = () =>
  window.preload.path.join(dataFolder, 'setting', 'default.json')

// 设置-Skill 启用配置文件路径：~/.mistrelle/setting/skill.json
export const getSettingSkillPath = () =>
  window.preload.path.join(dataFolder, 'setting', 'skill.json')

// 打开过的 AI 工作空间路径历史：~/.mistrelle/data/workspace-history.json
export const getWorkspaceHistoryPath = () =>
  window.preload.path.join(dataFolder, 'data', 'workspace-history.json')

// 缓存类数据根目录：~/.mistrelle/cache（可再生、可整体清理，不污染数据根目录）
export const getCacheDir = () => window.preload.path.join(dataFolder, 'cache')

// 单个工具结果的最大字节数，超出则截断，避免超大输出撑爆上下文窗口
export const MAX_TOOL_RESULT_BYTES = 128 * 1024

// 模型未配置上下文窗口（AiModel.context）时的兜底值，用于 token 占用百分比展示
export const DEFAULT_CONTEXT_WINDOW = 192_000

// 单轮对话内 agent loop 允许的最大工具迭代次数，避免模型持续调用工具造成死循环
export const MAX_AGENT_STEPS = 75

// 子 Agent 独立步数预算：其上下文与主 Agent 隔离，复杂调研需要更多步数才能收尾
export const MAX_SUB_AGENT_STEPS = 100
