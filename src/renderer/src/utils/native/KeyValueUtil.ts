/**
 * 键值存储（renderer 侧）：基于 localStorage 的同步 KV。
 *
 * utools dbStorage 的 Electron 替代：localStorage 天然同步且持久化
 * （默认 session 自动落盘到 userData/Local Storage/），无需 IPC。
 * localStorage 仅支持字符串，对象 / 数组走 JSON 序列化。
 */
export const KeyValueUtil = {
  getItem: <T>(key: string): T | null => {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      // 历史脏数据：按字符串返回
      return raw as T
    }
  },
  setItem: <T>(key: string, value: T) => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key)
  }
}
