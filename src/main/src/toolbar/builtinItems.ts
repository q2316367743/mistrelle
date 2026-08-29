/**
 * 工作条内置应用：目前仅 AI 主窗口一项；激活分发逻辑见 toolbarIpc（按 target）。
 */
import type { ToolbarItem } from '~/ipc/toolbarChannels'

export function getBuiltinItems(): ToolbarItem[] {
  return [
    {
      type: 'builtin',
      name: 'AI',
      target: 'ai',
      icon: ''
    }
  ]
}
