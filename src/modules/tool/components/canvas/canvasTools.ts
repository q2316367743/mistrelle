import type { ToolFunction } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { isPathUnder } from '@/utils/sandbox'
import {
  buildCanvasOutputsDir,
  getCanvasStore,
  parseCanvasVersion,
  computeNodeBounds,
  exportCanvasPng,
  normalizeRegion,
  type CanvasExportRegion,
  CanvasBatchOp,
  CanvasDoc,
  CanvasNode,
  CanvasToolContext,
  computeLayoutBounds,
  batchOpSchema,
  ensureFontsForDoc,
  CANVAS_GUIDELINES,
  CANVAS_GUIDELINE_TOPICS
} from '@/modules/canvas'

const ctxError = (): never => {
  throw new Error('画布工具缺少沙盒目录上下文')
}

const storeOf = (ctx: CanvasToolContext) => getCanvasStore(ctx.getSandboxDir() || ctxError())

/** 返回画布工具实例（按 chat sandboxDir 绑定），供 ChatTypeConfig 场景级注入 */
export const createCanvasTools = (ctx: CanvasToolContext): ToolFunction[] => {
  const store = () => storeOf(ctx)

  return [
    {
      name: 'canvas_list',
      label: '列出画布',
      description:
        '列出当前聊天 outputs/ 目录下全部画布（canvas-{version}.canvas），含版本号与标题',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => store().refreshFiles()
    },
    {
      name: 'canvas_read',
      label: '读取画布 JSON',
      description: '读取指定版本画布文件的完整 JSON 内容，供分析设计，不改变当前画布',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '画布版本号（canvas_list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        const content = await store().read(version)
        if (content === null)
          return { error: `未找到画布 canvas-${version}（可能不是 schema 2 模型）` }
        return { content }
      }
    },
    {
      name: 'canvas_create',
      label: '创建画布',
      description:
        '创建新画布（自动分配 canvas-{下一个版本号}）并设为当前画布，返回画布文档。常用比例：海报 3:4 1080×1440、电影海报 2:3、专辑封面 1:1 1000×1000、公众号封面 2.35:1 900×383、小红书 3:4 1242×1660、知识卡片 4:3',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '画布标题（可选，用于侧边栏辨识）' },
          width: { type: 'number', description: '画布宽度' },
          height: { type: 'number', description: '画布高度' },
          background: {
            type: 'string',
            description: '背景颜色，默认 #ffffff；深色作品建议直接给深色背景'
          },
          palette: {
            type: 'object',
            description:
              '可选：初始调色板，token名 → 颜色，如 {"主色":"#E63946","中性色":"#1D3557"}'
          }
        },
        required: ['width', 'height']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { title, width, height, background, palette } = params[0] as {
          title?: string
          width: number
          height: number
          background?: string
          palette?: Record<string, string>
        }
        return store().create({ title, width, height, background, palette })
      }
    },
    {
      name: 'canvas_open',
      label: '打开画布',
      description: '打开指定版本画布为当前画布，后续 batch_edit 等操作都作用于它',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '画布版本号（canvas_list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        const doc = await store().open(version)
        if (!doc) return { error: `未找到画布 canvas-${version}（可能不是 schema 2 模型）` }
        return doc
      }
    },
    {
      name: 'canvas_delete',
      label: '删除画布',
      description: '删除指定版本画布文件',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '画布版本号（canvas_list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'dangerous',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        await store().delete(version)
        return { success: true }
      }
    },
    {
      name: 'canvas_save',
      label: '保存画布',
      description: '将当前画布保存到文件（通常无需显式调用：每次变更会自动保存）',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'sensitive',
      handler: async () => store().save()
    },
    {
      name: 'canvas_export',
      label: '导出画布图片',
      description:
        '将当前画布（或指定版本）渲染为 PNG 图片并保存到本地，返回保存路径。缺省导出整张画布（尺寸 = 画布 doc 宽高，越界元素自动裁剪）；若设计内容在画布内的某个容器 / 卡片中，用 node 或 region 指定导出区域，保证导出尺寸与设计尺寸一致。用于目测整体视觉效果；核对元素精确位置 / 尺寸 / 间距请用 canvas_inspect，无需先导出',
      parameters: {
        type: 'object',
        properties: {
          version: { type: 'number', description: '画布版本号（缺省导出当前画布）' },
          path: {
            type: 'string',
            description:
              'PNG 保存路径（缺省保存到沙盒 outputs/canvas-{version}.png；父目录不存在会自动创建）'
          },
          node: {
            type: 'string',
            description:
              '导出指定节点的包围盒（含全部子树），用于「设计在画布内某容器 / 卡片」时按设计区域导出，尺寸 = 该节点包围盒'
          },
          region: {
            type: 'object',
            description: '导出指定矩形区域（画布绝对坐标），用于精确控制导出范围；与 node 二选一',
            properties: {
              x: { type: 'number', description: '区域左上角 x（画布绝对坐标）' },
              y: { type: 'number', description: '区域左上角 y（画布绝对坐标）' },
              width: { type: 'number', description: '区域宽度' },
              height: { type: 'number', description: '区域高度' }
            }
          }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { version, path, node, region } = params[0] as {
          version?: number
          path?: string
          node?: string
          region?: CanvasExportRegion
        }
        const sandboxDir = ctx.getSandboxDir() || ctxError()
        let doc: CanvasDoc | null
        if (version != null) {
          const content = await store().read(version)
          if (content === null) return { error: `未找到画布 canvas-${version}` }
          doc = JSON.parse(content) as CanvasDoc
        } else {
          doc = store().current.value
        }
        if (!doc) {
          return { error: '当前没有打开的画布，请先 canvas_create 或 canvas_open，或指定 version' }
        }
        // 解析导出区域：node → region → 整张画布；node/region 均缺省时严格按画布尺寸导出（裁剪越界）
        const defaultRegion = (): CanvasExportRegion => ({
          x: 0,
          y: 0,
          width: doc.width,
          height: doc.height
        })
        const nodeBounds = node != null ? computeNodeBounds(doc, node) : null
        if (node != null && !nodeBounds) {
          return { error: `未找到节点 ${node}，请用 canvas_get_nodes 获取节点 id` }
        }
        const exportRegion: CanvasExportRegion =
          nodeBounds ?? (region != null ? normalizeRegion(region) : defaultRegion())
        const note =
          nodeBounds != null
            ? `已按节点「${node}」包围盒导出`
            : region != null
              ? '已按指定区域导出'
              : '导出尺寸 = 画布尺寸（越界元素已裁剪）'
        const target =
          path ||
          window.preload.path.join(buildCanvasOutputsDir(sandboxDir), `canvas-${doc.version}.png`)
        const blob = await exportCanvasPng(doc, exportRegion)
        await window.preload.fs.mkdir(window.preload.path.dirname(target), true)
        await window.preload.fs.writeBinaryFile(target, await blob.arrayBuffer())
        return {
          success: true,
          path: target,
          width: exportRegion.width,
          height: exportRegion.height,
          note
        }
      }
    },
    {
      name: 'canvas_batch_edit',
      label: '批量编辑画布',
      description:
        '核心编辑工具：一次批量执行多个图层操作（insert / copy / update / move / delete / image），≤25 个/批。参数经严格校验：单个操作非法只让该操作失败（错误写入返回的 results），其余操作正常执行；构建顺序建议 背景→主视觉→装饰→文字。详见 canvas_guidelines("operations")',
      parameters: {
        type: 'object',
        properties: {
          operations: {
            type: 'array',
            items: batchOpSchema,
            description: '按顺序执行的操作列表（同批内可用 as 绑定名引用刚创建的节点）'
          }
        },
        required: ['operations']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { operations } = params[0] as { operations?: CanvasBatchOp[] }
        if (!operations?.length) return { error: 'operations 不能为空' }
        return store().batchEdit(operations)
      }
    },
    {
      name: 'canvas_get_nodes',
      label: '获取图层树',
      description:
        '返回当前画布完整图层树（含每个节点 id、类型、名称、位置、尺寸、填充与调色板），供分析 / 更新 / 移动 / 删除前查看',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string', description: '节点 id' },
            description: '可选：只返回指定 id 的节点（缺省返回全部）'
          }
        }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { ids } = params[0] as { ids?: string[] }
        const doc = store().current.value
        if (!doc) return { error: '当前没有打开的画布，请先 canvas_create 或 canvas_open' }
        let nodes: CanvasNode[] = doc.nodes
        if (ids?.length) {
          const set = new Set(ids)
          const pick = (list: CanvasNode[]): CanvasNode[] =>
            list
              .filter((n) => set.has(n.id))
              .map((n) => ({ ...n, children: n.children ? pick(n.children) : undefined }))
          nodes = pick(doc.nodes)
        }
        if (nodes.length === 0)
          return { nodes: [], palette: doc.palette ?? {}, note: '当前画布暂无图层' }
        return { nodes, palette: doc.palette ?? {} }
      }
    },
    {
      name: 'canvas_inspect',
      label: '检查渲染几何',
      description:
        '返回指定节点渲染后的画布绝对包围盒（x / y / width / height / centerX / centerY，均为布局引擎解析后的真实值，与导出 PNG / 屏幕视觉完全一致），供核对元素实际位置、尺寸、间距与对齐。注意：布局组内子节点的最终位置由引擎排布，canvas_get_nodes 返回的 x/y/width/height 可能是缺省或 fill_container / hug_contents 关键字，不能直接用于几何判断——需要精确位置时请用本工具。一次传关心的 2~5 个元素 ids（如标题与徽章），直接相减即可算出相对位置与间距；缺省返回全部',
      parameters: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string', description: '节点 id' },
            description: '可选：只返回指定 id 节点的包围盒（缺省返回全部）'
          },
          version: { type: 'number', description: '画布版本号（缺省检查当前画布）' }
        }
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { ids, version } = params[0] as { ids?: string[]; version?: number }
        let doc: CanvasDoc | null
        if (version != null) {
          const content = await store().read(version)
          if (content === null) return { error: `未找到画布 canvas-${version}` }
          doc = JSON.parse(content) as CanvasDoc
        } else {
          doc = store().current.value
        }
        if (!doc) {
          return { error: '当前没有打开的画布，请先 canvas_create 或 canvas_open，或指定 version' }
        }
        // 先加载字体：text 高度按真实字形测量（measureTextLineHeight），需与渲染/导出同一字体源，否则几何会按默认字体测量
        await ensureFontsForDoc(doc)
        const nodes = computeLayoutBounds(doc, ids)
        if (nodes.length === 0) {
          return {
            canvas: { width: doc.width, height: doc.height },
            nodes: [],
            note: '未找到匹配的节点，请用 canvas_get_nodes 确认节点 id'
          }
        }
        return {
          canvas: { width: doc.width, height: doc.height },
          nodes,
          note: ids?.length ? '已按 ids 过滤' : '返回全部节点'
        }
      }
    },
    {
      name: 'canvas_set_palette',
      label: '设置调色板',
      description:
        '定义当前画布的调色板（3-5 个颜色 token），如 {"主色":"#E63946","辅色":"#F1FAEE","中性色":"#1D3557","强调色":"#A8DADC"}。之后所有 fill/stroke 用 $token名 引用，保证全页色彩和谐；同名 token 会覆盖',
      parameters: {
        type: 'object',
        properties: {
          palette: {
            type: 'object',
            description: 'token名 → 颜色（#RRGGBB / rgba() / 颜色名）'
          }
        },
        required: ['palette']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { palette } = params[0] as { palette: Record<string, string> }
        return store().setPalette(palette)
      }
    },
    {
      name: 'canvas_guidelines',
      label: '获取设计参考',
      description:
        '获取内置设计参考（按需加载，避免全部塞进提示词）。通用：style-guide 反 AI 俗套 / composition 构图 / typography 字体排版 / operations 批量编辑与节点速查 / workflow 端到端工作流 / image-generation 生图与多素材合并省钱规范；场景：poster 海报 / book-cover 书籍封面 / album-cover 专辑封面 / social-media 公众号封面与小红书配图 / knowledge-card 读书笔记与知识卡片。做某类作品前先读对应场景指南',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: `style-guide / composition / typography / operations / workflow / poster / book-cover / album-cover / social-media / knowledge-card（${CANVAS_GUIDELINE_TOPICS.join(' / ')}）`
          }
        },
        required: ['topic']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { topic } = params[0] as { topic: string }
        const content = CANVAS_GUIDELINES[topic as keyof typeof CANVAS_GUIDELINES]
        if (!content) {
          return { error: `未知 topic：${topic}，可用：${CANVAS_GUIDELINE_TOPICS.join(' / ')}` }
        }
        return { topic, content }
      }
    }
  ]
}

/** 画布工具完整清单（单一数据源：工具工厂与安全策略注册共用） */
export const CANVAS_TOOL_NAMES = [
  'canvas_list',
  'canvas_read',
  'canvas_create',
  'canvas_open',
  'canvas_delete',
  'canvas_save',
  'canvas_export',
  'canvas_batch_edit',
  'canvas_get_nodes',
  'canvas_inspect',
  'canvas_set_palette',
  'canvas_guidelines'
] as const

/** 从画布文件名解析版本号（供测试 / 校验复用） */
export { parseCanvasVersion }

/**
 * 画布工具安全策略：canvas_* 仅读写当前聊天自己的 outputs/ 目录（可信区），
 * 默认模式（mode=0）下直接放行，避免每次编辑都挂起等待审批（曾导致卡死）。
 * 计划模式（mode=1）仍按模式策略 deny（画布操作属写入类），行为保持一致。
 * 注册在 canvasTools 模块内，保证工具被引用即完成注册（不依赖 index 副作用）。
 *
 * 注意：resolveToolPolicy 按工具全名（toolPolicies.get(tool.name)）匹配策略，
 * 必须为每个画布工具名单独注册，不能用通配名。
 */
for (const name of CANVAS_TOOL_NAMES) {
  // canvas_export 接收外部保存路径，不能无条件放行，改走下方路径感知策略
  if (name === 'canvas_export') continue
  registerToolPolicy({
    name,
    // 画布工具不接收外部路径，只作用于沙盒 outputs/；沙盒目录缺失时由 handler 兜底报错
    resolve: () => 'allow'
  })
}

/** 判断路径是否处于可信区域（沙盒或工作空间），供 canvas_export 策略使用 */

/**
 * canvas_export 写入策略（写 PNG 文件，涉及外部路径）：
 * - 未传 path（缺省写入沙盒 outputs/）或 path 位于沙盒 / 工作空间（可信区）→ 自动放行
 * - 其余路径 → 需用户审批（与 http_download 行为一致）
 */
registerToolPolicy({
  name: 'canvas_export',
  resolve(_tool, args, ctx) {
    const path = args.path
    if (typeof path !== 'string' || !path) return 'allow'
    return isPathUnder(path, ctx.sandboxDir) || isPathUnder(path, ctx.workspace) ? 'allow' : 'ask'
  }
})
