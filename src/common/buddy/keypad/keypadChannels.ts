/**
 * 小键盘（keypad）IPC 通道常量（main / preload 共用）。
 * 通道命名沿用 'domain:action' 约定；域类型与名称映射在 @common/types/keypad，
 * 配置由 main 进程持有，落盘 ~/.mistrelle/buddy/keypad.json。
 */

export const KeypadChannels = {
  /** 读取整份配置（含 lastPort 与键位绑定） */
  getConfig: 'keypad:getConfig',
  /** 全量保存键位绑定表（main 归一化清洗后落盘） */
  saveBindings: 'keypad:saveBindings',
  /** 保存键盘样式布局（main 校验白名单后落盘） */
  saveLayout: 'keypad:saveLayout',
  /** 本机应用目录（应用下拉选项源；main 扫描系统应用清单） */
  listApps: 'keypad:listApps',
  /** 连接串口（9600；成功即记忆 lastPort 并广播运行态） */
  connect: 'keypad:connect',
  /** 断开当前连接（同时释放按住中的组合键） */
  disconnect: 'keypad:disconnect',
  /** 读取运行态（连接/按下/权限） */
  getState: 'keypad:getState',
  /** 主进程 → 渲染层：运行态变化（连接/断开/意外断开/按下变化） */
  state: 'keypad:state'
} as const
