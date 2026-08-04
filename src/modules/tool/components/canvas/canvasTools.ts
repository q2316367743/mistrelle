import type { ToolFunction, ToolProperty } from '@/domain'
import { registerToolPolicy } from '@/modules/tool/toolPolicy'
import { getCanvasStore, parseCanvasVersion } from './CanvasStore'
import type { CanvasShapeInput, CanvasShapeType, CanvasToolContext } from './canvasTypes'

const ctxError = (): never => {
  throw new Error('画布工具缺少沙盒目录上下文')
}

const storeOf = (ctx: CanvasToolContext) => getCanvasStore(ctx.getSandboxDir() || ctxError())

/** 返回画布工具实例（按 chat sandboxDir 绑定），供 ChatTypeConfig 场景级注入 */
export const createCanvasTools = (ctx: CanvasToolContext): ToolFunction[] => {
  const store = () => storeOf(ctx)

  const shapeProps: Record<string, ToolProperty> = {
    x: { type: 'number', description: '图形左上角 x 坐标（画布原点在左上角，向右为正）' },
    y: { type: 'number', description: '图形左上角 y 坐标（画布原点在左上角，向下为正）' },
    width: { type: 'number', description: '图形宽度' },
    height: { type: 'number', description: '图形高度' },
    rotation: { type: 'number', description: '旋转角度（度，顺时针）' },
    fill: { type: 'string', description: '填充颜色，支持 #RRGGBB / #RRGGBBAA / rgba() / 颜色名' },
    stroke: { type: 'string', description: '描边颜色' },
    strokeWidth: { type: 'number', description: '描边宽度' },
    opacity: { type: 'number', description: '不透明度 0-1' }
  }

  const textProps: Record<string, ToolProperty> = {
    ...shapeProps,
    text: { type: 'string', description: '文本内容' },
    fontSize: { type: 'number', description: '字号' },
    fontWeight: { type: 'number', description: '字重（400 常规 / 700 粗体）' },
    fontFamily: { type: 'string', description: '字体族' },
    textColor: { type: 'string', description: '文字颜色' }
  }

  const idProp: Record<string, ToolProperty> = {
    id: { type: 'string', description: '目标图形的 id（用 canvas_get_shapes 获取）' }
  }

  const buildShapeTool = (
    name: string,
    label: string,
    shapeType: CanvasShapeType,
    props: Record<string, ToolProperty>,
    required: string[]
  ): ToolFunction => ({
    name,
    label,
    description: `${label}：向当前画布新增一个 ${shapeType} 图形，返回新图形（含 id）`,
    parameters: { type: 'object', properties: props, required },
    internal: true,
    risk: 'sensitive',
    handler: async (...params: unknown[]) => {
      const input = params[0] as CanvasShapeInput
      return store().addShape(shapeType, input)
    }
  })

  const buildUpdateTool = (
    name: string,
    label: string,
    props: Record<string, ToolProperty>
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
      const { id, ...patch } = params[0] as { id: string } & CanvasShapeInput
      const updated = await store().updateShape(id, patch)
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
  'canvas_get_shapes',
  'canvas_add_rect',
  'canvas_update_rect',
  'canvas_add_text',
  'canvas_update_text',
  'canvas_add_ellipse',
  'canvas_update_ellipse',
  'canvas_add_line',
  'canvas_update_line',
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
  registerToolPolicy({
    name,
    // 画布工具不接收外部路径，只作用于沙盒 outputs/；沙盒目录缺失时由 handler 兜底报错
    resolve: () => 'allow'
  })
}
