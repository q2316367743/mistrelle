/**
 * Buddy 事件词汇表（跨设备共享契约）：外部软件（opencode 等）的原生事件经接入插件
 * 白名单过滤后，投递到本地事件服务 /buddy/event?platform=<软件>&event=<本词汇表事件>；
 * 红绿灯 / ESP32 LCD 等 buddy 设备统一消费这套事件。
 * 事件命名以 opencode bus 事件为蓝本（同名白名单，新增软件接入时沿用此词汇表扩展）。
 * 红绿灯「事件→灯态」绑定、配置归一化均以本全集为准。
 */
import { CommonSelect } from './CommonSelect'

/** Buddy 事件名（opencode bus 事件蓝本，排除 tui / lsp 等硬件无关事件） */
export type BuddyEventName =
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'session.diff'
  | 'session.status'
  | 'session.idle'
  | 'session.compacted'
  | 'session.error'
  | 'message.updated'
  | 'message.removed'
  | 'message.part.updated'
  | 'message.part.removed'
  | 'file.edited'
  | 'file.watcher.updated'
  | 'permission.asked'
  | 'permission.updated'
  | 'permission.replied'
  | 'tool.execute.before'
  | 'tool.execute.after'
  | 'command.executed'
  | 'todo.updated'
  | 'pty.exited'
  | 'vcs.branch.updated'
  | 'installation.update.available'

/** Buddy 事件名称映射 */
export const BuddyEventOptions: Array<CommonSelect<BuddyEventName>> = [
  { value: 'session.created', label: '新会话' },
  { value: 'session.updated', label: '会话元数据更新' },
  { value: 'session.deleted', label: '会话删除' },
  { value: 'session.diff', label: '会话文件差异' },
  { value: 'session.status', label: '会话状态变化' },
  { value: 'session.idle', label: '会话空闲' },
  { value: 'session.compacted', label: '上下文已压缩' },
  { value: 'session.error', label: '会话出错' },
  { value: 'message.updated', label: '消息更新' },
  { value: 'message.removed', label: '消息删除' },
  { value: 'message.part.updated', label: '消息流式输出' },
  { value: 'message.part.removed', label: '消息片段删除' },
  { value: 'file.edited', label: 'Agent 编辑文件' },
  { value: 'file.watcher.updated', label: '文件系统变更' },
  { value: 'permission.asked', label: '等待授权' },
  { value: 'permission.updated', label: '权限请求更新' },
  { value: 'permission.replied', label: '权限已回复' },
  { value: 'tool.execute.before', label: '开始执行工具' },
  { value: 'tool.execute.after', label: '工具执行结束' },
  { value: 'command.executed', label: '斜杠命令执行' },
  { value: 'todo.updated', label: '待办更新' },
  { value: 'pty.exited', label: '终端会话退出' },
  { value: 'vcs.branch.updated', label: '分支变更' },
  { value: 'installation.update.available', label: '有可用更新' }
]

/** Buddy 事件全集（运行时白名单校验用，派生自 BuddyEventOptions） */
export const BUDDY_EVENT_NAMES: readonly BuddyEventName[] = BuddyEventOptions.map(
  (opt) => opt.value
)

/** 事件名白名单校验（事件投递接口与配置归一化共用） */
export function isBuddyEvent(value: string): value is BuddyEventName {
  return (BUDDY_EVENT_NAMES as readonly string[]).includes(value)
}

/** 事件分组（红绿灯绑定界面按组渲染，组并集须覆盖全集） */
export const BUDDY_EVENT_GROUPS: ReadonlyArray<{ title: string; events: readonly BuddyEventName[] }> = [
  {
    title: '会话',
    events: [
      'session.created',
      'session.updated',
      'session.deleted',
      'session.diff',
      'session.status',
      'session.idle',
      'session.compacted',
      'session.error'
    ]
  },
  {
    title: '消息',
    events: ['message.updated', 'message.removed', 'message.part.updated', 'message.part.removed']
  },
  { title: '文件', events: ['file.edited', 'file.watcher.updated'] },
  { title: '权限', events: ['permission.asked', 'permission.updated', 'permission.replied'] },
  { title: '工具', events: ['tool.execute.before', 'tool.execute.after'] },
  {
    title: '其他',
    events: [
      'command.executed',
      'todo.updated',
      'pty.exited',
      'vcs.branch.updated',
      'installation.update.available'
    ]
  }
]
