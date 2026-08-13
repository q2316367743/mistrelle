/**
 * PPT 预览 SVG → 节点 id 绑定（渲染进程，纯 DOM 操作，不注入脚本）：
 * pptx-glimpse 生成的 SVG 顶层 <g> 按 POM 文档前序排列（含各节点背景 / 边线 / 阴影形状），
 * 本模块把每个顶层分组对齐到 JSON 树中对应节点并注入 data-node-id，
 * 实现"点击节点 → 引用节点 id → ppt_batch_edit 精准编辑"。
 *
 * 对齐策略 = 确定性形状计数 + 文本校验（校准自 POM 10.3.0 + pptx-glimpse 3.2.8 实测）：
 * - 容器（VStack/HStack/Layer）：无内容形状，按 attrs 推导背景形状数
 *   （backgroundColor/backgroundGradient → 1；backgroundImage → 1；border/阴影合并 1；每侧边线 → 1；
 *   根节点（页面顶层）的 backgroundColor 转幻灯片背景 → 不计）
 * - 简单节点（Text/Shape/Icon/Image/Svg/Table/Chart/Ul/Ol/Line）：bg + 1 个内容形状；
 *   Text/Shape 的内容形状用 <text> 文本校验（Ul 文本含项目符号前缀不可预测，跳过校验）
 * - 复合节点（Timeline/Flow/Tree/Matrix/Pyramid/ProcessArrow）：组数不定，
 *   以"下一个 Text/Shape 文本锚点"为界整体绑定到复合节点 id（点击任意部位引用整节点）
 * - 含 zIndex（破坏前序）/ Arrow（延迟重排）的页无法保序 → 整页不可点
 * - 任一校验失败 → 整页标记 pickable:false（保持 <img> 外观，仅禁交互，不误导）
 */
import { ensureNodeIds } from './pptNodeId'
import type { PptNodeInfo } from './pptNodeId'
import type { SlideNode } from './pptTypes'

/** 复杂结构节点：组数不可简单推导，按锚点分段 */
const COMPOSITE_TAGS = new Set(['Timeline', 'Flow', 'Tree', 'Matrix', 'Pyramid', 'ProcessArrow'])

/** 文本可校验的简单节点（内容形状的 <text> 文本应与 child 字符串一致） */
const TEXT_VERIFY_TAGS = new Set(['Text', 'Shape'])

/** 归一化文本用于校验：折叠空白（换行 / 多空格 → 单空格）后 trim */
const normalizeText = (text: string): string => text.replace(/\s+/g, ' ').trim()

/** 按 attrs 推导节点的背景形状数（含边框 / 阴影 / 边线；根节点 backgroundColor 转幻灯片背景） */
const countBgGroups = (node: SlideNode, isRoot: boolean): number => {
  const a = node.attr
  let count = 0
  const hasFillBg = Boolean(a.backgroundColor || a.backgroundGradient)
  const hasUniformBorder = Boolean(a['border.color'])
  const hasShadow = Boolean(a['shadow.type'] || a['shadow.blur'])
  // 首个背景形状合并：填充 + 统一边框 + 阴影（根节点 backgroundColor 走幻灯片背景，不计）
  if ((!isRoot && hasFillBg) || hasUniformBorder || hasShadow) count += 1
  if (!isRoot && a['backgroundImage.src']) count += 1
  for (const side of ['borderTop', 'borderRight', 'borderBottom', 'borderLeft']) {
    if (a[`${side}.color`]) count += 1
  }
  return count
}

/** 节点的内容文本（文本节点返回 child 字符串；非文本节点返回 null） */
const nodeText = (node: SlideNode): string | null =>
  typeof node.child === 'string' ? node.child : null

/** 规划单元：一个 JSON 节点在 SVG 中占用的形状序列 */
interface PlanUnit {
  node: SlideNode
  /** 复合节点：锚点分段，不做逐组对齐 */
  composite: boolean
  /** 该单元预期消耗的形状组数（bg + 内容；复合节点为 0，实际按锚点消费） */
  groupCount: number
  /** 内容形状预期文本（可校验时非 null） */
  expectedText: string | null
}

/** 镜像 POM 前序发射顺序构建规划（复合节点不展开子结构） */
const buildPlan = (slide: SlideNode[]): PlanUnit[] => {
  const plan: PlanUnit[] = []
  const walk = (nodes: SlideNode[], isRoot: boolean) => {
    for (const node of nodes) {
      if (COMPOSITE_TAGS.has(node.tag)) {
        plan.push({ node, composite: true, groupCount: 0, expectedText: null })
        continue
      }
      const container = node.tag === 'VStack' || node.tag === 'HStack' || node.tag === 'Layer'
      const bgCount = countBgGroups(node, isRoot)
      if (container) {
        plan.push({ node, composite: false, groupCount: bgCount, expectedText: null })
        if (Array.isArray(node.child)) walk(node.child, false)
      } else {
        const text = TEXT_VERIFY_TAGS.has(node.tag) ? nodeText(node) : null
        plan.push({
          node,
          composite: false,
          groupCount: bgCount + 1,
          expectedText: text ? normalizeText(text) : null
        })
      }
    }
  }
  walk(slide, true)
  return plan
}

/** 从解析后的 SVG 中取顶层形状分组（跳过背景与 defs；<a> 超链接包装解包） */
const collectTopGroups = (svgEl: SVGSVGElement): Element[] => {
  const children = Array.from(svgEl.children).filter((el) => el.tagName !== 'defs')
  // 第一个元素固定为幻灯片背景（rect / image），跳过
  return children.slice(1).map((el) => (el.tagName === 'a' ? (el.firstElementChild ?? el) : el))
}

/** 分组文本（textContent 汇总 <text>/<tspan>） */
const groupText = (el: Element): string => normalizeText(el.textContent ?? '')

/** 页内是否含破坏保序的属性（zIndex / Arrow） */
const hasOrderBreaking = (slide: SlideNode[]): boolean => {
  let broken = false
  const walk = (nodes: SlideNode[]) => {
    for (const node of nodes) {
      if (node.attr.zIndex !== undefined || node.tag === 'Arrow') {
        broken = true
        return
      }
      if (Array.isArray(node.child)) walk(node.child)
    }
  }
  walk(slide)
  return broken
}

/**
 * 把页 SVG 顶层分组对齐到 JSON 节点，就地注入 data-node-id。
 * @param svgEl 经 DOMParser 解析后的 <svg> 根元素（脚本不执行，安全）
 * @param slide 当前页的 SlideNode[]（就地补 id）
 * @returns pickable（页可点选）+ nodeInfos（id → 节点摘要，供回填引用）
 */
export const mapSlideGroups = (
  svgEl: SVGSVGElement,
  slide: SlideNode[]
): { pickable: boolean; nodeInfos: Map<string, PptNodeInfo> } => {
  const fail = (): { pickable: boolean; nodeInfos: Map<string, PptNodeInfo> } => ({
    pickable: false,
    nodeInfos: new Map()
  })
  if (hasOrderBreaking(slide) || slide.length === 0) return fail()

  ensureNodeIds(slide) // 兜底：映射前确保节点有 id（含旧文件）
  const groups = collectTopGroups(svgEl)
  const plan = buildPlan(slide)
  const bindings: Array<{ id: string; tag: string; text: string } | undefined> = new Array(
    groups.length
  ).fill(undefined)

  /** 从 gi 开始找文本等于 targetText 的分组索引（找不到返回 -1） */
  const findAnchor = (gi: number, targetText: string): number => {
    for (let i = gi; i < groups.length; i++) if (groupText(groups[i]) === targetText) return i
    return -1
  }

  let gi = 0
  let ok = true
  for (let pi = 0; pi < plan.length; pi++) {
    const unit = plan[pi]
    const id = unit.node.id ?? ''
    const info = { id, tag: unit.node.tag, text: nodeText(unit.node) ?? '' }
    if (unit.composite) {
      // 复合节点：整体绑定到节点 id，消费到下一个 Text/Shape 锚点（或组尾）
      const anchor = plan
        .slice(pi + 1)
        .find((u) => !u.composite && u.expectedText !== null)?.expectedText
      const start = gi
      if (anchor == null) {
        for (let i = start; i < groups.length; i++) bindings[i] = info
        gi = groups.length
      } else {
        const stop = findAnchor(start, anchor)
        if (stop === -1) {
          ok = false
          break
        }
        for (let i = start; i < stop; i++) bindings[i] = info
        gi = stop
      }
      continue
    }
    // 容器 / 简单节点：按预期组数消费（容器无内容形状，简单节点 bg + 1）
    const end = gi + unit.groupCount
    if (end > groups.length) {
      ok = false
      break
    }
    for (let i = gi; i < end; i++) bindings[i] = info
    if (
      unit.expectedText !== null &&
      end > gi &&
      groupText(groups[end - 1]) !== unit.expectedText
    ) {
      ok = false
      break
    }
    gi = end
  }
  if (!ok || gi !== groups.length) return fail()

  const nodeInfos = new Map<string, PptNodeInfo>()
  groups.forEach((group, i) => {
    const binding = bindings[i]
    if (binding && binding.id) {
      group.setAttribute('data-node-id', binding.id)
      nodeInfos.set(binding.id, binding)
    }
  })
  return { pickable: true, nodeInfos }
}
