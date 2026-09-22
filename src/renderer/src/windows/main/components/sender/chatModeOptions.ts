import type { Component } from 'vue'
import { ChatIcon, EditIcon, LightbulbIcon, SecuredIcon } from 'tdesign-icons-vue-next'
import type { AiChatMode } from '@/entity'

/**
 * 权限模式（AiChatMode）的展示元数据：发送栏权限模式下拉与工具条触发器共用的单一事实源。
 * 文案粒度对齐 zcode：主标题为档位名，副标题为一句话说明。
 */
export interface ChatModeOption {
  value: AiChatMode
  label: string
  desc: string
  icon: Component
  /** tdesign 主题色，用于下拉项与触发器图标的着色 */
  theme: 'default' | 'primary' | 'success' | 'warning'
}

/** 缺省档位（变更前确认）：模式值异常时回退，避免触发器空展示 */
const FALLBACK_OPTION: ChatModeOption = {
  value: 0,
  label: '变更前确认',
  desc: '改文件前先问我。',
  icon: ChatIcon,
  theme: 'default'
}

export const DEFAULT_CHAT_MODE: AiChatMode = FALLBACK_OPTION.value

/** 下拉展示顺序：由严到宽（计划模式最严、完全访问最宽） */
export const CHAT_MODE_OPTIONS: ChatModeOption[] = [
  {
    value: 1,
    label: '计划模式',
    desc: '编辑前先出计划。',
    icon: LightbulbIcon,
    theme: 'primary'
  },
  FALLBACK_OPTION,
  { value: 3, label: '自动编辑', desc: '自动编辑文件。', icon: EditIcon, theme: 'success' },
  { value: 2, label: '完全访问', desc: '减少确认次数。', icon: SecuredIcon, theme: 'warning' }
]

export const getChatModeOption = (mode: AiChatMode): ChatModeOption =>
  CHAT_MODE_OPTIONS.find((item) => item.value === mode) ?? FALLBACK_OPTION
