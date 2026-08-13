/**
 * SlideNode id 生命周期：确保每个节点都有稳定 id（**顶层字段 node.id，与 tag 并列**）。
 * - id 是纯 JSON 层引用标识：不进 attr、不进 POM XML（jsonToPomXml 不写 id），
 *   只服务渲染进程的节点映射 / 引用与 ppt_batch_edit 的 update 等精准编辑
 * - 所有节点（含 Li/Td/TimelineItem 等子元素）都可携带 id，无需担心 POM 未知属性硬错误
 * - attr.id（FlowNode 必填 id / Arrow 端点 id）是 POM 功能型标识，原样保留透传 XML
 * - 批量操作辅助（findNodeWithParent / cloneNodeWithNewIds）供 pptBatchOps 使用
 */
import type { SlideNode } from './pptTypes'
import { nanoid } from 'nanoid'
import { cloneDeep } from 'es-toolkit'

/** 生成短随机 id（n- + 10 位 nanoid，URL 安全）；撞名概率极低，仍由 ensureNodeIds 去重兜底 */
export const genNodeId = (): string => `n-${nanoid(10)}`

/**
 * 深遍历为缺失 id 的节点补齐顶层 node.id，并保证**同页内** id 唯一（跨页允许重复——
 * ppt_batch_edit 用 (slideId, nodeId) 定位）。attr.id **不删除**：它是 POM 功能型标识
 * （FlowNode 必填的流程节点 id / Arrow 端点 id），原样透传 XML；顶层 node.id 只是 JSON 层
 * 引用标识（jsonToPomXml 不写它进 XML）。就地变异入参；幂等（已有 id 的节点不动）。
 */
export const ensureNodeIds = (page: SlideNode[]): void => {
  const seen = new Set<string>()
  const walk = (node: SlideNode) => {
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

/** 深遍历页内节点 → 摘要数组（id + tag + 文本，AI 引用节点用；仅收录带顶层 id 的节点） */
export const collectPageNodes = (page: SlideNode[]): PptNodeInfo[] => {
  const infos: PptNodeInfo[] = []
  const walk = (node: SlideNode) => {
    if (node.id) {
      infos.push({
        id: node.id,
        tag: node.tag,
        text: typeof node.child === 'string' ? node.child : ''
      })
    }
    if (Array.isArray(node.child)) node.child.forEach(walk)
  }
  page.forEach(walk)
  return infos
}

/** 按 id 过滤页内节点树（保留命中节点的祖先结构，未命中子树裁剪） */
export const filterNodesByIds = (nodes: SlideNode[], ids: string[]): SlideNode[] => {
  const wanted = new Set(ids)
  const walk = (list: SlideNode[]): SlideNode[] =>
    list.flatMap((n) => {
      if (wanted.has(n.id ?? '')) return [n]
      if (Array.isArray(n.child)) {
        const kept = walk(n.child)
        return kept.length ? [{ ...n, child: kept }] : []
      }
      return []
    })
  return walk(nodes)
}

/** 按 id 深搜页内节点（返回节点引用；未找到返回 null）。只匹配顶层 node.id */
export const findNodeById = (page: SlideNode[], nodeId: string): SlideNode | null => {
  let found: SlideNode | null = null
  const walk = (node: SlideNode) => {
    if (found) return
    if (node.id === nodeId) {
      found = node
      return
    }
    if (Array.isArray(node.child)) node.child.forEach(walk)
  }
  page.forEach(walk)
  return found
}

/** 节点位置：节点引用 + 所在子元素数组 + 索引（move / delete 操作用） */
export interface PptNodeLocation {
  node: SlideNode
  parent: SlideNode[]
  index: number
}

/** 按 id 深搜页内节点及其所在位置（含其父数组 / 兄弟索引）；未找到返回 null */
export const findNodeWithParent = (page: SlideNode[], nodeId: string): PptNodeLocation | null => {
  const index = page.findIndex((n) => n.id === nodeId)
  if (index >= 0) return { node: page[index], parent: page, index }
  for (const child of page) {
    if (Array.isArray(child.child)) {
      const found = findNodeWithParent(child.child, nodeId)
      if (found) return found
    }
  }
  return null
}

/** 深拷贝节点并重生成整棵子树顶层 id（copy 操作用）；attr.id 原样保留（POM 功能标识） */
export const cloneNodeWithNewIds = (node: SlideNode): SlideNode => {
  const clone = cloneDeep(node)
  const walk = (n: SlideNode) => {
    n.id = genNodeId()
    if (Array.isArray(n.child)) n.child.forEach(walk)
  }
  walk(clone)
  return clone
}

/** ppt_batch_edit 的 update / copy.overrides 补丁载荷：attr 合并 / text 覆盖 / child 替换（任意组合） */
export interface PptElementPatch {
  /** 要合并或覆盖的节点属性（点表示法键，如 fontSize / border.color；id 由系统管理，忽略该键） */
  attr?: Record<string, string | number | boolean>
  /** 文本内容（仅 Text 等 child 为字符串的节点） */
  text?: string
  /** 替换子元素数组（SlideNode JSON） */
  child?: SlideNode[]
}
