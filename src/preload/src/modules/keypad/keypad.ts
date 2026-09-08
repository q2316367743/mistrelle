/**
 * 小键盘桥（preload）：keypad 域的 IPC 薄封装 + 运行态推送订阅。
 * 配置读写、连接编排、按键解析、模拟按键都在 main（keypadService 单例），渲染层只调用类型化方法。
 */
import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { KeypadChannels } from '@common/buddy/keypad/keypadChannels'
import type { KeypadBinding, KeypadConfig, KeypadResult, KeypadState } from '@common/types/keypad'

export const keypadApi = {
  /** 读取整份配置（含 lastPort 与键位绑定） */
  getConfig: (): Promise<KeypadConfig> => ipcRenderer.invoke(KeypadChannels.getConfig),
  /** 全量保存键位绑定表；main 归一化清洗后落盘 */
  saveBindings: (bindings: Record<string, KeypadBinding>): Promise<KeypadResult> =>
    ipcRenderer.invoke(KeypadChannels.saveBindings, bindings),
  /** 连接串口（9600 固定波特率；成功即记忆 lastPort 并广播运行态） */
  connect: (path: string): Promise<KeypadResult> =>
    ipcRenderer.invoke(KeypadChannels.connect, path),
  /** 断开当前连接（同时释放按住中的组合键） */
  disconnect: (): Promise<void> => ipcRenderer.invoke(KeypadChannels.disconnect),
  /** 读取运行态（连接/按下/权限） */
  getState: (): Promise<KeypadState> => ipcRenderer.invoke(KeypadChannels.getState),
  /** 订阅运行态变化推送；返回取消订阅函数 */
  onState: (callback: (state: KeypadState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: KeypadState): void => callback(state)
    ipcRenderer.on(KeypadChannels.state, listener)
    return () => {
      ipcRenderer.removeListener(KeypadChannels.state, listener)
    }
  }
}
