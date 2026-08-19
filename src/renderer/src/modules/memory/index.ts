import { useLog } from '@/hooks/UseLog'
import { runConsolidation } from './MemoryConsolidator'

export * from './MemoryConstant'
export * from './MemoryPrompt'
export * from './MemoryService'
export * from './MemoryExtractor'
export * from './MemoryConsolidator'
export * from './memoryTool'

const logger = useLog({ name: 'modules:memory' })

/** 启动延迟：错开应用启动高峰（store 初始化、会话水合等） */
const STARTUP_DELAY = 15_000

/** 运行中跨天检查间隔：覆盖夜间应用常开、跨零点未重启的场景 */
const CONSOLIDATE_CHECK_INTERVAL = 60 * 60 * 1000

let initialized = false

/**
 * 初始化记忆系统：启动延迟检查 + 每小时检查长期记忆合并。
 * 定时器常驻安装（合并内部自行判断开关与待合并内容，无待合并时仅一次目录读），
 * 设置页切换开关无需重新初始化。会话提取钩子由 ChatSessionManager 按需调用，不在此安装。
 */
export const initMemorySystem = (): void => {
  if (initialized) return
  initialized = true
  setTimeout(() => void runConsolidation(), STARTUP_DELAY)
  setInterval(() => void runConsolidation(), CONSOLIDATE_CHECK_INTERVAL)
  logger.info('记忆系统已初始化（合并检查：启动 15 秒后 + 每小时）')
}
