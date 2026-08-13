/**
 * PPT 批量操作执行器（ppt_batch_edit 工具用，纯页面逻辑、不涉及文件 I/O）：
 * 仿 canvas CanvasStore.batchEdit —— 5 种 op（insert / copy / update / move / delete）顺序执行，
 * 单个操作非法只让该操作失败（错误写入 results），其余照常执行并整体生效。
 * - as 绑定名：同批内 insert / copy 可声明，后续 op 用 parent:"@绑定名" 引用刚创建的节点（仅本批有效）
 * - parent 目标："root"（页根）| 容器节点 id | "@绑定名"
 * - 每批 ≤ 15 个操作（上限由 ppt_batch_edit 工具 / schema 拦截，此处不重复校验长度）
 */
import type { SlideNode } from './pptTypes'
import type { PptElementPatch, PptNodeInfo } from './pptNodeId'
import { cloneNodeWithNewIds, ensureNodeIds, findNodeById, findNodeWithParent } from './pptNodeId'
import { validatePptBatchOp } from './pptSchemas'
import { cloneDeep } from 'es-toolkit'

/** attr 值规范化：落盘前统一转为字符串（存储契约 attr: Record<string, string>），递归子树 */
const normalizeAttrValues = (node: SlideNode): void => {
  for (const [key, value] of Object.entries(node.attr)) {
    if (typeof value !== 'string') node.attr[key] = String(value)
  }
  if (Array.isArray(node.child)) node.child.forEach(normalizeAttrValues)
}

/** 节点摘要（返回给 AI 引用 id） */
const nodeInfo = (node: SlideNode): PptNodeInfo => ({
  id: node.id ?? '',
  tag: node.tag,
  text: typeof node.child === 'string' ? node.child : ''
})

/**
 * 解析插入 / 移动的目标父列表："root" → 页根数组；节点 id → 该容器的 child 数组；"@绑定名" → 绑定容器。
 * 目标不是容器（child 为文本）时报错，引导 AI 换父。
 */
const resolveParentList = (
  page: SlideNode[],
  parentRef: string,
  bindings: Map<string, string>
): SlideNode[] => {
  if (parentRef === 'root') return page
  if (parentRef.startsWith('@')) {
    const id = bindings.get(parentRef.slice(1))
    if (!id) throw new Error(`未找到绑定名 ${parentRef}（as 绑定仅本批内有效，需先 insert / copy 声明）`)
    return resolveParentList(page, id, bindings)
  }
  const target = findNodeById(page, parentRef)
  if (!target) throw new Error(`未找到父节点 ${parentRef}（需为容器节点 id 或 "root"）`)
  if (!Array.isArray(target.child)) {
    throw new Error(`父节点 ${parentRef}（${target.tag}）不是容器（child 为文本），无法插入子元素`)
  }
  return target.child
}

/** 解析节点引用（update / move / delete / copy 的 id 字段）："@绑定名" → 绑定节点 id；其余原样返回 */
const resolveTargetId = (ref: string, bindings: Map<string, string>): string => {
  if (!ref.startsWith('@')) return ref
  const id = bindings.get(ref.slice(1))
  if (!id) throw new Error(`未找到绑定名 ${ref}（as 绑定仅本批内有效，需先 insert / copy 声明）`)
  return id
}

/** 应用补丁：attr 点表示法合并 / text 覆盖 / child 替换（child 补 id 并规范化 attr 值） */
const applyPatch = (node: SlideNode, patch: PptElementPatch, potentialIssues: string[]): void => {
  if (patch.attr) {
    for (const [key, value] of Object.entries(patch.attr)) {
      if (key === 'id') {
        potentialIssues.push(`patch 尝试修改 id（${String(value)}）已被忽略：id 由系统管理`)
        continue
      }
      node.attr[key] = String(value)
    }
  }
  if (patch.text !== undefined) {
    if (typeof node.child !== 'string') {
      throw new Error(
        `节点「${node.id}」（${node.tag}）不是文本节点，无法用 text 更新；如需改内容请用 child 数组替换`
      )
    }
    node.child = patch.text
  }
  if (patch.child !== undefined) {
    ensureNodeIds(patch.child)
    patch.child.forEach(normalizeAttrValues)
    node.child = patch.child
  }
}

/** 宽松操作载荷（executeOp 内部用；op 结构精确性由 validatePptBatchOp 保证） */
interface PptBatchOp {
  op: string
  as?: string
  parent?: string
  id?: string
  index?: number
  node?: SlideNode
  patch?: PptElementPatch
  overrides?: PptElementPatch
}

const executeOp = (
  page: SlideNode[],
  op: PptBatchOp,
  bindings: Map<string, string>,
  potentialIssues: string[]
): unknown => {
  switch (op.op) {
    case 'insert': {
      if (op.parent == null || op.node == null) throw new Error('insert 缺少 parent 或 node')
      const parent = resolveParentList(page, op.parent, bindings)
      ensureNodeIds([op.node])
      normalizeAttrValues(op.node)
      parent.push(op.node)
      if (op.as) bindings.set(op.as, op.node.id ?? '')
      return nodeInfo(op.node)
    }
    case 'copy': {
      if (op.id == null || op.parent == null) throw new Error('copy 缺少 id 或 parent')
      const source = findNodeById(page, resolveTargetId(op.id, bindings))
      if (!source) throw new Error(`未找到被复制节点 ${op.id}`)
      const clone = cloneNodeWithNewIds(source)
      if (op.overrides) applyPatch(clone, op.overrides, potentialIssues)
      const parent = resolveParentList(page, op.parent, bindings)
      normalizeAttrValues(clone)
      parent.push(clone)
      if (op.as) bindings.set(op.as, clone.id ?? '')
      return nodeInfo(clone)
    }
    case 'update': {
      if (op.id == null || op.patch == null) throw new Error('update 缺少 id 或 patch')
      const target = findNodeById(page, resolveTargetId(op.id, bindings))
      if (!target) {
        throw new Error(`未找到更新目标 ${op.id}（该节点可能已被删除 / 移动，请先 ppt_get_nodes 重读）`)
      }
      // 深拷贝后校验补丁，通过再写回（失败整体拒绝该操作，不影响其他操作）
      const draft = cloneDeep(target)
      applyPatch(draft, op.patch, potentialIssues)
      Object.assign(target, draft)
      return nodeInfo(target)
    }
    case 'move': {
      if (op.id == null) throw new Error('move 缺少 id')
      const found = findNodeWithParent(page, resolveTargetId(op.id, bindings))
      if (!found) throw new Error(`未找到节点 ${op.id}`)
      // 先解析目标父列表（可能抛错），再移除 / 插入，避免解析失败残留已删节点
      const target = op.parent != null ? resolveParentList(page, op.parent, bindings) : found.parent
      const index = op.index ?? target.length
      found.parent.splice(found.index, 1)
      target.splice(Math.max(0, Math.min(index, target.length)), 0, found.node)
      return nodeInfo(found.node)
    }
    case 'delete': {
      if (op.id == null) throw new Error('delete 缺少 id')
      const found = findNodeWithParent(page, resolveTargetId(op.id, bindings))
      if (!found) throw new Error(`未找到节点 ${op.id}`)
      found.parent.splice(found.index, 1)
      return { success: true }
    }
    default:
      throw new Error('未知操作类型')
  }
}

/**
 * 顺序执行批量操作（≤15 个由工具层 / schema 拦截）。单个操作非法只让该操作失败，
 * 其余照常执行并整体生效（结果随 JSON 一并落盘）。
 * 返回 results（成功为节点摘要 / {success: true}，失败为 {error}）+ potentialIssues（提示性警告）。
 */
export const executePptBatchOps = (
  page: SlideNode[],
  ops: unknown[]
): { results: unknown[]; potentialIssues: string[] } => {
  const results: unknown[] = []
  const potentialIssues: string[] = []
  const bindings = new Map<string, string>()
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]
    try {
      const opErrors = validatePptBatchOp(op)
      if (opErrors.length) throw new Error(opErrors.join('；'))
      results.push(executeOp(page, op as PptBatchOp, bindings, potentialIssues))
    } catch (err) {
      results.push({ error: `第 ${i + 1} 个操作失败：${err instanceof Error ? err.message : String(err)}` })
    }
  }
  return { results, potentialIssues }
}
