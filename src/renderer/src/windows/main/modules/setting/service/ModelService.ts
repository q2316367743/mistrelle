import { AiProvide } from '@/entity'
import { getModelPath } from '@/global/Constant'

// AI 模型配置文件：~/.mistrelle/model.json

/**
 * 读取全部模型提供方；文件不存在时返回空数组
 */
export const modelList = async (): Promise<Array<AiProvide>> => {
  const path = getModelPath()
  if (!(window.preload.fs.existsSync(path))) return []
  return JSON.parse(await window.preload.fs.readTextFile(path))
}

/**
 * 全量写入模型提供方列表
 * 内置供应商（builtin 标记）为运行时注入、不落盘，落盘前剔除防污染 model.json
 */
export const modelSave = async (list: Array<AiProvide>) => {
  const persist = list.filter((item) => !item.builtin)
  await window.preload.fs.writeTextFile(getModelPath(), JSON.stringify(persist))
}
