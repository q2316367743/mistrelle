/**
 * HTML 模板渲染服务（main 进程）：读取 resources/templates 下的 EJS 模板并渲染。
 * - 模板目录与 drizzle 迁移同源（electron-vite main publicDir = resources/，
 *   dev 下自 out/main 相对回源、打包后随应用分发），路径解析与 db/client.ts 同款。
 * - 模板字符串按名缓存在内存；EJS 默认 <%= %> 转义，模板侧禁止 <%- %> 输出不可信文本。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ejs from 'ejs'

const TEMPLATE_DIR = join(__dirname, '../../resources/templates')
const cache = new Map<string, string>()

const loadTemplate = (name: string): string => {
  const hit = cache.get(name)
  if (hit) return hit
  const template = readFileSync(join(TEMPLATE_DIR, `${name}.ejs`), 'utf-8')
  cache.set(name, template)
  return template
}

/** 渲染指定模板（name 仅允许小写字母 / 数字 / 连字符，防路径穿越） */
export function renderTemplate(name: string, data: Record<string, unknown>): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`非法模板名：${name}`)
  }
  return ejs.render(loadTemplate(name), data)
}
