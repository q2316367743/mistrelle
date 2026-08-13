/**
 * SlideNode id 生命周期：确保每个节点都有稳定 id（**顶层字段 node.id，与 tag 并列**）。
 * - id 是纯 JSON 层引用标识：不进 attr、不进 POM XML（jsonToPomXml 不写 id），
 *   只服务渲染进程的节点映射 / 引用与 ppt_edit_element 精准编辑
 * - 所有节点（含 Li/Td/TimelineItem 等子元素）都可携带 id，无需担心 POM 未知属性硬错误
 * - attr.id（FlowNode 必填 id / 旧文件 Arrow 端点 id）是 POM 功能型标识，原样保留透传 XML
 */
import type { SlideNode } from './pptTypes'
import { nanoid } from 'nanoid'

/** 生成短随机 id（n- + 10 位 nanoid，URL 安全）；撞名概率极低，仍由 ensureNodeIds 去重兜底 */
export const genNodeId = (): string => `n-${nanoid(10)}`

/**
 * 深遍历为缺失 id 的节点补齐顶层 node.id，并保证**同页内** id 唯一（跨页允许重复——
 * ppt_edit_element 用 (slideId, nodeId) 定位）。
 * attr.id **不删除**：它是 POM 功能型标识（FlowNode 必填的流程节点 id / 旧文件 Arrow 端点 id），
 * 原样透传 XML；顶层 node.id 只是 JSON 层引用标识（jsonToPomXml 不写它进 XML）。
 * 就地变异入参；幂等（已有 id 的节点不动）。
 */
export const ensureNodeIds = (page: SlideNode[]): void => {
  const seen = new Set<string>()
  const walk = (node: SlideNode) => {
    // 兼容旧文件：attr.id（POM 时代产物）复用为顶层 node.id，使引用 / 精准编辑可命中
    if (!node.id && node.attr.id) node.id = node.attr.id
    if (!node.id) {
      node.id = genNodeId()
      while (seen.has(node.id)) node.id = genNodeId()
    }
    seen.add(node.id)
    if (Array.isArray(node.child)) node.child.forEach(walk)
  }
  page.forEach(walk)
}

/** 深遍历收集页内节点摘要（AI 引用 / 工具返回用）：{id, tag, text} */
export interface PptNodeInfo {
  id: string
  tag: string
  /** 文本节点内容（Text / 形状文本），非文本节点为空串 */
  text: string
}

/** 按 id 深搜页内节点（返回节点引用；未找到返回 null）。优先匹配顶层 node.id，回退 attr.id */
export const findNodeById = (page: SlideNode[], nodeId: string): SlideNode | null => {
  let found: SlideNode | null = null
  const walk = (node: SlideNode) => {
    if (found) return
    if (node.id === nodeId || node.attr.id === nodeId) {
      found = node
      return
    }
    if (Array.isArray(node.child)) node.child.forEach(walk)
  }
  page.forEach(walk)
  return found
}

/** ppt_edit_element 的 patch 载荷：attr 合并 / text 覆盖 / child 替换（三选任意组合） */
export interface PptElementPatch {
  /** 要合并或覆盖的节点属性（点表示法键，如 fontSize / border.color；id 由系统管理，忽略该键） */
  attr?: Record<string, string | number | boolean>
  /** 文本内容（仅 Text 等 child 为字符串的节点） */
  text?: string
  /** 替换子元素数组（SlideNode JSON） */
  child?: SlideNode[]
}

/**
 * 轻量结构校验（ppt_edit_element 用）：child 数组必须满足 SlideNode 形状
 * （id?/tag 字符串 + attr 对象 + child 为字符串或同构数组），attr 值仅允许 string / number / boolean。
 * 不做逐 tag 严格校验（严格校验由 prepareElements 在整页写入时执行）；
 * 返回错误文本数组，空数组表示通过。
 */
export const validateNodeTree = (nodes: unknown[]): string[] => {
  const isAttrValue = (v: unknown): boolean =>
    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

  const check = (node: unknown, path: string): string[] => {
    if (!node || typeof node !== 'object' || Array.isArray(node))
      return [`${path} 必须是 SlideNode 对象`]
    const { tag, attr, child } = node as { tag?: unknown; attr?: unknown; child?: unknown }
    if (typeof tag !== 'string') return [`${path}.tag 必须是字符串`]
    if (!attr || typeof attr !== 'object' || Array.isArray(attr)) return [`${path}.attr 必须是对象`]
    const attrErrors = Object.entries(attr as Record<string, unknown>).flatMap(([key, value]) =>
      isAttrValue(value) ? [] : [`${path}.attr.${key} 只允许 string / number / boolean`]
    )
    if (attrErrors.length) return attrErrors
    if (child === undefined) return []
    if (typeof child === 'string') return []
    if (Array.isArray(child)) return child.flatMap((c, i) => check(c, `${path}.child[${i}]`))
    return [`${path}.child 必须是字符串或子元素数组`]
  }
  return nodes.flatMap((n, i) => check(n, `child[${i}]`))
}
