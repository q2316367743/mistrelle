/**
 * 软件登记（伙伴窗口红绿灯「软件页签」）：
 * SOFTWARE_REGISTRY 决定页签与顺序，SoftwareTabs 的 PANELS 决定各软件的专属面板组件；
 * 灯态选项是硬件层共享数据（与软件无关），一并在此外置。
 * 新增软件 = registry 加一项 + PANELS 登记专属面板 + channels 类型全集 + main 侧默认配置。
 */

/** 软件页签项 */
export interface SoftwareTabItem {
  name: SoftwareName
  label: string
}

export const SOFTWARE_REGISTRY: readonly SoftwareTabItem[] = [
  { name: 'opencode', label: 'Opencode' }
]

/** 灯态选项（''=不响应），供各软件面板的绑定下拉使用 */
export interface LightStateOption {
  value: LightState | ''
  label: string
  /** 展示色（tdesign token） */
  color?: string
}

export const LIGHT_STATE_OPTIONS: readonly LightStateOption[] = [
  { value: '', label: '不响应' },
  { value: 'ro', label: '红灯常亮', color: 'var(--td-error-color)' },
  { value: 'rs', label: '红灯闪烁', color: 'var(--td-error-color)' },
  { value: 'go', label: '绿灯常亮', color: 'var(--td-success-color)' },
  { value: 'gs', label: '绿灯闪烁', color: 'var(--td-success-color)' },
  { value: 'yo', label: '黄灯常亮', color: 'var(--td-warning-color)' },
  { value: 'ys', label: '黄灯闪烁', color: 'var(--td-warning-color)' }
]
