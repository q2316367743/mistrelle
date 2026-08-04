import type { ToolFunction, ToolProperty } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { buildCanvasOutputsDir, getCanvasStore, parseCanvasVersion } from './CanvasStore'
import type { CanvasDoc, CanvasShapeInput, CanvasShapeType, CanvasToolContext } from './canvasTypes'
import { exportCanvasPng } from './canvasRender'

const ctxError = (): never => {
  throw new Error('画布工具缺少沙盒目录上下文')
}

const storeOf = (ctx: CanvasToolContext) => getCanvasStore(ctx.getSandboxDir() || ctxError())

/**
 * 解析图片 / SVG 源为可渲染 url：
 * - http(s) / data / blob / file URL 原样返回
 * - 沙盒内文件路径（绝对或相对）转为稳定 file:// URL（pathToHref）
 * AI 从网络下载的图片通常已保存到沙盒目录，传路径即可，无需手动转换。
 */
const resolveImageSource = (ctx: CanvasToolContext, src: string): string => {
  if (/^(https?|file|data|blob):/i.test(src)) return src
  const sandboxDir = ctx.getSandboxDir()
  const isAbsolute = /^([a-zA-Z]:[\\/]|\/)/.test(src)
  const abs = !isAbsolute && sandboxDir ? window.preload.path.join(sandboxDir, src) : src
  return window.preload.net.pathToHref(abs)
}

/** 资产类图形入参归一化：把工具侧的 src 解析为 imageUrl 落盘，避免多余字段写入画布文件 */
const toAssetInput =
  (ctx: CanvasToolContext) =>
  (patch: Record<string, unknown>): CanvasShapeInput => {
    const { src, ...rest } = patch
    return typeof src === 'string' && src
      ? ({ ...rest, imageUrl: resolveImageSource(ctx, src) } as unknown as CanvasShapeInput)
      : (rest as unknown as CanvasShapeInput)
  }

/** 返回画布工具实例（按 chat sandboxDir 绑定），供 ChatTypeConfig 场景级注入 */
export const createCanvasTools = (ctx: CanvasToolContext): ToolFunction[] => {
  const store = () => storeOf(ctx)

  const shapeProps: Record<string, ToolProperty> = {
    x: { type: 'number', description: '图形左上角 x 坐标（画布原点在左上角，向右为正）' },
    y: { type: 'number', description: '图形左上角 y 坐标（画布原点在左上角，向下为正）' },
    width: { type: 'number', description: '图形宽度' },
    height: { type: 'number', description: '图形高度' },
    rotation: { type: 'number', description: '旋转角度（度，顺时针）' },
    fill: {
      type: 'string',
      description:
        '填充：纯色（#RRGGBB / #RRGGBBAA / rgba() / 颜色名）或渐变对象。渐变示例 {"type":"linear","from":"top-left","to":"bottom-right","stops":["#FF4B4B","#FEB027"]}；type 支持 linear（线性）/ radial（径向光晕）/ angular（角度色环），stops 为色标数组，可为纯色字符串自动均分，或 {"offset":0,"color":"#FEB027"} 显式定位'
    },
    stroke: {
      type: 'string',
      description:
        '描边颜色或渐变对象（结构同 fill，配合 strokeWidth 使用，可让边框更有层次）'
    },
    strokeWidth: { type: 'number', description: '描边宽度' },
    strokeCap: { type: 'string', description: '描边端点形状：none / round / square' },
    dashPattern: {
      type: 'array',
      items: { type: 'number', description: '长度数值' },
      description: '虚线描边：[线段长度, 间隙]，如 [6, 4]'
    },
    cornerRadius: {
      type: 'number',
      description: '圆角半径（闭合图形），让矩形 / 卡片更柔和，如 16'
    },
    shadow: {
      type: 'object',
      description:
        '外阴影：{"x":0,"y":4,"blur":8,"color":"rgba(0,0,0,0.15)"}（x/y 偏移、blur 模糊半径、color 支持 rgba），可传数组叠加多层阴影，营造立体感'
    },
    innerShadow: {
      type: 'object',
      description: '内阴影：{"x":0,"y":2,"blur":4,"color":"rgba(0,0,0,0.2)"}，实现内凹 / 雕刻感'
    },
    blendMode: {
      type: 'string',
      description: '混合模式：normal / multiply / screen / overlay 等，用于半透明色层叠加调色'
    },
    blur: { type: 'number', description: '高斯模糊半径，柔化图形或模拟景深' },
    opacity: { type: 'number', description: '不透明度 0-1' }
  }

  const textProps: Record<string, ToolProperty> = {
    ...shapeProps,
    text: { type: 'string', description: '文本内容' },
    fontSize: { type: 'number', description: '字号' },
    fontWeight: { type: 'number', description: '字重（400 常规 / 700 粗体）' },
    fontFamily: { type: 'string', description: '字体族' },
    textColor: {
      type: 'string',
      description: '文字颜色，支持纯色或渐变对象（结构同 fill），如 {"type":"linear","stops":["#FF4B4B","#FEB027"]}'
    }
  }

  const polygonProps: Record<string, ToolProperty> = {
    ...shapeProps,
    sides: { type: 'number', description: '边数（≥3）：3 三角形、4 四边形、5 五边形' },
    startAngle: { type: 'number', description: '起始角度偏移（度，-180~180），控制图形朝向' }
  }

  const starProps: Record<string, ToolProperty> = {
    ...shapeProps,
    corners: { type: 'number', description: '角数（≥3）：5 五角星' },
    innerRadius: { type: 'number', description: '内半径比例（0~1，默认 0.382），控制凹陷程度' },
    startAngle: { type: 'number', description: '起始角度偏移（度，-180~180）' }
  }

  const pathProps: Record<string, ToolProperty> = {
    x: shapeProps.x,
    y: shapeProps.y,
    rotation: shapeProps.rotation,
    opacity: shapeProps.opacity,
    path: { type: 'string', description: 'SVG 路径数据，如 M10 20 L60 20 L60 60 Z' },
    fill: shapeProps.fill,
    stroke: shapeProps.stroke,
    strokeWidth: shapeProps.strokeWidth,
    strokeCap: shapeProps.strokeCap,
    dashPattern: shapeProps.dashPattern,
    shadow: shapeProps.shadow,
    innerShadow: shapeProps.innerShadow,
    blendMode: shapeProps.blendMode,
    blur: shapeProps.blur
  }

  const assetProps: Record<string, ToolProperty> = {
    x: shapeProps.x,
    y: shapeProps.y,
    width: { type: 'number', description: '宽，缺省按资源原始尺寸' },
    height: { type: 'number', description: '高，缺省按资源原始尺寸' },
    rotation: shapeProps.rotation,
    opacity: shapeProps.opacity
  }

  const imageProps: Record<string, ToolProperty> = {
    ...assetProps,
    src: {
      type: 'string',
      description: '图片源：沙盒内文件路径（自动转 file:// URL）或 http(s)/data URL'
    }
  }

  const svgProps: Record<string, ToolProperty> = {
    ...assetProps,
    src: { type: 'string', description: 'SVG 文件路径或 http(s) URL（与 svg 二选一）' },
    svg: { type: 'string', description: '内联 SVG 字符串（与 src 二选一）' }
  }

  const idProp: Record<string, ToolProperty> = {
    id: { type: 'string', description: '目标图形的 id（用 canvas_get_shapes 获取）' }
  }

  const buildShapeTool = (
    name: string,
    label: string,
    shapeType: CanvasShapeType,
    props: Record<string, ToolProperty>,
    required: string[],
    transform?: (input: Record<string, unknown>) => CanvasShapeInput
  ): ToolFunction => ({
    name,
    label,
    description: `${label}：向当前画布新增一个 ${shapeType} 图形，返回新图形（含 id）`,
    parameters: { type: 'object', properties: props, required },
    internal: true,
    risk: 'sensitive',
    handler: async (...params: unknown[]) => {
      const raw = params[0] as Record<string, unknown>
      const input = transform ? transform(raw) : (raw as unknown as CanvasShapeInput)
      return store().addShape(shapeType, input)
    }
  })

  const buildUpdateTool = (
    name: string,
    label: string,
    props: Record<string, ToolProperty>,
    transform?: (patch: Record<string, unknown>) => CanvasShapeInput
  ): ToolFunction => ({
    name,
    label,
    description: `${label}：按 id 更新当前画布中的指定图形，返回更新后的图形`,
    parameters: {
      type: 'object',
      properties: { ...idProp, ...props },
      required: ['id']
    },
    internal: true,
    risk: 'sensitive',
    handler: async (...params: unknown[]) => {
      const { id, ...patch } = params[0] as { id: string } & Record<string, unknown>
      const normalized = (
        transform ? transform(patch) : (patch as Partial<CanvasShapeInput>)
      ) as Partial<CanvasShapeInput>
      const updated = await store().updateShape(id, normalized)
      if (!updated) return { error: `未找到 id 为 ${id} 的图形` }
      return updated
    }
  })

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
        properties: { version: { type: 'number', description: '画布版本号（canvas-list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        const content = await store().read(version)
        if (content === null) return { error: `未找到画布 canvas-${version}` }
        return { content }
      }
    },
    {
      name: 'canvas_create',
      label: '创建画布',
      description: '创建新画布（自动分配 canvas-{下一个版本号}）并设为当前画布，返回画布文档',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '画布标题（可选，用于侧边栏辨识）' },
          width: { type: 'number', description: '画布宽度' },
          height: { type: 'number', description: '画布高度' },
          background: { type: 'string', description: '背景颜色，默认 #ffffff' }
        },
        required: ['width', 'height']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { title, width, height, background } = params[0] as {
          title?: string
          width: number
          height: number
          background?: string
        }
        return store().create({ title, width, height, background })
      }
    },
    {
      name: 'canvas_open',
      label: '打开画布',
      description: '打开指定版本画布为当前画布，后续 add/update 等操作都作用于它',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '画布版本号（canvas-list 获取）' } },
        required: ['version']
      },
      internal: true,
      risk: 'safe',
      handler: async (...params: unknown[]) => {
        const { version } = params[0] as { version: number }
        const doc = await store().open(version)
        if (!doc) return { error: `未找到画布 canvas-${version}` }
        return doc
      }
    },
    {
      name: 'canvas_delete',
      label: '删除画布',
      description: '删除指定版本画布文件',
      parameters: {
        type: 'object',
        properties: { version: { type: 'number', description: '画布版本号（canvas-list 获取）' } },
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
        '将当前画布（或指定版本）渲染为 PNG 图片并保存到本地，返回保存路径。支持读图的模型可引用返回的 path 查看设计效果',
      parameters: {
        type: 'object',
        properties: {
          version: { type: 'number', description: '画布版本号（缺省导出当前画布）' },
          path: {
            type: 'string',
            description: 'PNG 保存路径（缺省保存到沙盒 outputs/canvas-{version}.png；父目录不存在会自动创建）'
          }
        }
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { version, path } = params[0] as { version?: number; path?: string }
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
        const target =
          path || window.preload.path.join(buildCanvasOutputsDir(sandboxDir), `canvas-${doc.version}.png`)
        const blob = await exportCanvasPng(doc)
        await window.preload.fs.mkdir(window.preload.path.dirname(target), true)
        await window.preload.fs.writeBinaryFile(target, await blob.arrayBuffer())
        return { success: true, path: target, width: doc.width, height: doc.height }
      }
    },
    {
      name: 'canvas_get_shapes',
      label: '获取当前画布图形',
      description: '返回当前画布全部图形（含每个图形的 id），供更新 / 移动 / 删除前查看',
      parameters: { type: 'object', properties: {} },
      internal: true,
      risk: 'safe',
      handler: async () => {
        const shapes = store().getShapes()
        if (shapes.length === 0) return { shapes: [], note: '当前画布暂无图形' }
        return { shapes }
      }
    },
    buildShapeTool('canvas_add_rect', '新增矩形', 'rect', shapeProps, [
      'x',
      'y',
      'width',
      'height'
    ]),
    buildUpdateTool('canvas_update_rect', '更新矩形', shapeProps),
    buildShapeTool('canvas_add_text', '新增文本', 'text', textProps, ['x', 'y', 'text']),
    buildUpdateTool('canvas_update_text', '更新文本', textProps),
    buildShapeTool('canvas_add_ellipse', '新增椭圆', 'ellipse', shapeProps, [
      'x',
      'y',
      'width',
      'height'
    ]),
    buildUpdateTool('canvas_update_ellipse', '更新椭圆', shapeProps),
    {
      name: 'canvas_add_line',
      label: '新增线条',
      description: '向当前画布新增一条折线（points 为 [x1,y1,x2,y2,...] 扁平坐标数组）',
      parameters: {
        type: 'object',
        properties: {
          ...shapeProps,
          points: { type: 'array', description: '折线顶点扁平坐标数组 [x1,y1,x2,y2,...]' }
        },
        required: ['points']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const input = params[0] as CanvasShapeInput
        return store().addShape('line', input)
      }
    },
    buildUpdateTool('canvas_update_line', '更新线条', {
      points: { type: 'array', description: '折线顶点扁平坐标数组 [x1,y1,x2,y2,...]' },
      stroke: { type: 'string', description: '线条颜色' },
      strokeWidth: { type: 'number', description: '线条宽度' },
      opacity: { type: 'number', description: '不透明度 0-1' },
      rotation: { type: 'number', description: '旋转角度（度）' }
    }),
    buildShapeTool('canvas_add_polygon', '新增多边形', 'polygon', polygonProps, [
      'x',
      'y',
      'width',
      'height',
      'sides'
    ]),
    buildUpdateTool('canvas_update_polygon', '更新多边形', polygonProps),
    buildShapeTool('canvas_add_star', '新增星形', 'star', starProps, [
      'x',
      'y',
      'width',
      'height',
      'corners'
    ]),
    buildUpdateTool('canvas_update_star', '更新星形', starProps),
    buildShapeTool('canvas_add_path', '新增路径', 'path', pathProps, ['x', 'y', 'path']),
    buildUpdateTool('canvas_update_path', '更新路径', pathProps),
    buildShapeTool('canvas_add_image', '新增图片', 'image', imageProps, ['x', 'y', 'src'], toAssetInput(ctx)),
    buildUpdateTool('canvas_update_image', '更新图片', imageProps, toAssetInput(ctx)),
    buildShapeTool('canvas_add_svg', '新增 SVG', 'svg', svgProps, ['x', 'y'], toAssetInput(ctx)),
    buildUpdateTool('canvas_update_svg', '更新 SVG', svgProps, toAssetInput(ctx)),
    {
      name: 'canvas_move_shape',
      label: '移动图形',
      description: '按 id 相对移动当前画布中的指定图形（dx/dy 为相对位移量）',
      parameters: {
        type: 'object',
        properties: {
          ...idProp,
          dx: { type: 'number', description: 'x 方向位移（正数向右）' },
          dy: { type: 'number', description: 'y 方向位移（正数向下）' }
        },
        required: ['id', 'dx', 'dy']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id, dx, dy } = params[0] as { id: string; dx: number; dy: number }
        const moved = await store().moveShape(id, { dx, dy })
        if (!moved) return { error: `未找到 id 为 ${id} 的图形` }
        return moved
      }
    },
    {
      name: 'canvas_remove_shape',
      label: '删除图形',
      description: '按 id 从当前画布删除指定图形',
      parameters: {
        type: 'object',
        properties: idProp,
        required: ['id']
      },
      internal: true,
      risk: 'sensitive',
      handler: async (...params: unknown[]) => {
        const { id } = params[0] as { id: string }
        const removed = await store().removeShape(id)
        if (!removed) return { error: `未找到 id 为 ${id} 的图形` }
        return { success: true }
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
  'canvas_get_shapes',
  'canvas_add_rect',
  'canvas_update_rect',
  'canvas_add_text',
  'canvas_update_text',
  'canvas_add_ellipse',
  'canvas_update_ellipse',
  'canvas_add_line',
  'canvas_update_line',
  'canvas_add_polygon',
  'canvas_update_polygon',
  'canvas_add_star',
  'canvas_update_star',
  'canvas_add_path',
  'canvas_update_path',
  'canvas_add_image',
  'canvas_update_image',
  'canvas_add_svg',
  'canvas_update_svg',
  'canvas_move_shape',
  'canvas_remove_shape'
] as const

/** 从画布文件名解析版本号（供测试 / 校验复用） */
export { parseCanvasVersion }

/**
 * 画布工具安全策略：canvas_* 仅读写当前聊天自己的 outputs/ 目录（可信区），
 * 默认模式（mode=0）下直接放行，避免每次画一个图形都挂起等待审批（曾导致卡死）。
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
const isPathUnder = (target: string, parent: string): boolean => {
  if (!target || !parent) return false
  const t = window.preload.path.normalizePath(target).replace(/\/$/, '')
  const p = window.preload.path.normalizePath(parent).replace(/\/$/, '')
  return t === p || t.startsWith(p + '/')
}

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
