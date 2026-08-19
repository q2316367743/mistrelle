/**
 * 本地 JSON 文件读写（~/.mistrelle/ 下单域文件，全量覆写，无乐观锁）
 */

/** 读取 JSON 文件；文件不存在时返回 null（不预写空文件） */
export const readJsonFile = async <T>(path: string): Promise<T | null> => {
  if (!window.preload.fs.existsSync(path)) return null
  return JSON.parse(await window.preload.fs.readTextFile(path))
}

/** 全量覆写 JSON 文件 */
export const writeJsonFile = async <T>(path: string, value: T): Promise<void> => {
  await window.preload.fs.writeTextFile(path, JSON.stringify(value))
}
