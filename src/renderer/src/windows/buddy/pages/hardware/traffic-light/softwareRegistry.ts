/**
 * 软件登记（伙伴窗口红绿灯「软件页签」）：
 * SOFTWARE_REGISTRY 决定页签与顺序，SoftwareTabs 的 PANELS 决定各软件的专属面板组件。
 * 新增软件 = registry 加一项 + PANELS 登记专属面板 + @common/types/trafficLight 类型全集 + main 侧默认配置。
 */
import type { SoftwareName } from '@common/types/trafficLight'

/** 软件页签项 */
export interface SoftwareTabItem {
  name: SoftwareName
  label: string
}

export const SOFTWARE_REGISTRY: readonly SoftwareTabItem[] = [
  { name: 'opencode', label: 'Opencode' },
  { name: 'zcode', label: 'ZCode' },
  { name: 'claude', label: 'Claude Code' },
  { name: 'codex', label: 'Codex' }
]
