import type { ToolProperty } from '@/domain'

/**
 * 画布工具参数 schema（node / batch op），与工具实现解耦：
 * - nodeSchema 供 insert 的 node 字段 / 供模型了解图层模型
 * - batchOpSchema 供 canvas_batch_edit 的 operations 数组元素
 * 独立成文件避免 canvasTools.ts 超出行数红线（RL-05）。
 */

/** 节点 schema（insert 的 node 字段 / 供模型了解图层模型） */
export const nodeSchema: ToolProperty = {
  type: 'object',
  description: '图层节点数据。所有节点必须赋有意义的 name；children 顺序即 z 序',
  properties: {
    type: {
      type: 'string',
      description:
        '节点类型：group（容器，可设背景/圆角/阴影，可选 layout 自动布局）/ rect / ellipse / line / polygon / star / path / text / image / svg'
    },
    name: { type: 'string', description: '图层名，必填且有意义' },
    x: { type: 'number', description: 'x 坐标（画布原点在左上角，向右为正）' },
    y: { type: 'number', description: 'y 坐标（画布原点在左上角，向下为正）' },
    width: {
      type: 'string',
      description: '宽：像素数值，或布局组内 fill_container（撑满父容器）/ hug_contents（包裹内容）'
    },
    height: {
      type: 'string',
      description: '高：像素数值，或布局组内 fill_container / hug_contents'
    },
    rotation: { type: 'number', description: '旋转角度（度，顺时针）' },
    opacity: { type: 'number', description: '不透明度 0-1' },
    visible: { type: 'boolean', description: '是否可见（默认 true）' },
    blendMode: { type: 'string', description: '混合模式：normal / multiply / screen / overlay 等' },
    layoutPositioning: {
      type: 'string',
      description: '布局父内的定位方式：AUTO 参与布局（默认）/ ABSOLUTE 绝对定位（用自身 x/y）'
    },
    layout: {
      type: 'string',
      description: 'group 的自动布局（缺省 none 自由定位）：none / horizontal / vertical / wrap'
    },
    gap: { type: 'number', description: '自动布局子节点间距' },
    padding: {
      type: 'string',
      description: '内边距：数值，或 [水平,垂直]，或 [上,右,下,左]'
    },
    primaryAxisAlignItems: {
      type: 'string',
      description: '布局组主轴对齐：MIN / CENTER / MAX / SPACE_BETWEEN / SPACE_EVENLY'
    },
    counterAxisAlignItems: {
      type: 'string',
      description: '布局组交叉轴对齐：MIN / CENTER / MAX / BASELINE'
    },
    fill: {
      type: 'string',
      description:
        '填充：纯色（#RRGGBB / #RRGGBBAA / rgba() / 颜色名 / $调色板token名）或渐变对象 {"type":"linear","from":"top-left","to":"bottom-right","stops":["#667eea","#764ba2"]}。所有颜色统一用 fill'
    },
    stroke: { type: 'string', description: '描边（结构同 fill，配 strokeWidth 使用）' },
    strokeWidth: { type: 'number', description: '描边宽度' },
    strokeCap: { type: 'string', description: '描边端点：none / round / square' },
    dashPattern: {
      type: 'array',
      items: { type: 'number', description: '长度数值' },
      description: '虚线描边：[线段长度, 间隙]，如 [6, 4]'
    },
    cornerRadius: { type: 'number', description: '圆角半径（注意不是 borderRadius）' },
    effects: {
      type: 'array',
      items: {
        type: 'object',
        description:
          '效果：{type:"drop-shadow"|"inner-shadow"|"layer-blur"|"background-blur", x,y,radius,spread?,color?}，可叠加多层阴影'
      },
      description: '效果数组（阴影 / 模糊），营造层次与立体感'
    },
    text: { type: 'string', description: '文本内容（text 节点）' },
    fontSize: { type: 'number', description: '字号（海报主标题 64~120）' },
    fontFamily: { type: 'string', description: '字体族，如 Outfit / Noto Sans SC / 思源宋体' },
    fontWeight: {
      type: 'string',
      description: '字重：数字 400 常规 / 700 粗体 / 900 特粗，或字符串 "400"~"900"'
    },
    italic: { type: 'boolean', description: '斜体（仅拉丁字母有效）' },
    letterSpacing: { type: 'number', description: '字间距（大标题宜收紧）' },
    lineHeight: { type: 'string', description: '行高：数值或 AUTO' },
    textAlign: { type: 'string', description: '文本对齐：left / center / right' },
    textCase: { type: 'string', description: '大小写：none / upper / lower' },
    points: {
      type: 'array',
      items: { type: 'number', description: '坐标数值' },
      description: '折线顶点扁平坐标 [x1,y1,x2,y2,...]，相对节点 x/y'
    },
    sides: { type: 'number', description: '正多边形边数（≥3）' },
    corners: { type: 'number', description: '星形角数（≥3）' },
    innerRadius: { type: 'number', description: '星形内半径比例（0~1，默认 0.382）' },
    startAngle: { type: 'number', description: '起始角度偏移（度，-180~180）' },
    path: { type: 'string', description: 'SVG 路径数据，如 M10 20 L60 20 L60 60 Z' },
    imageUrl: {
      type: 'string',
      description: '图片地址（file:// / http(s) / data URL）；建议显式设置 width/height'
    },
    svg: {
      type: 'string',
      description:
        '内联 SVG 字符串（仅复杂图标兜底，与 imageUrl 二选一）。注意：图标 / 简单图形请优先用原生节点组合（rect / ellipse / path / line / star / polygon），颜色用 fill + $token 引用；内联 SVG 内部颜色无法引用调色板 token，且导出 PNG 时可能因异步加载而缺失，除非确需复杂矢量否则不要使用'
    },
    children: {
      type: 'array',
      items: { type: 'object', description: '子节点（children 顺序即 z 序，后画者在上）' },
      description: '子节点列表（children 顺序即 z 序，后画者在上）'
    }
  }
}

/** 批量编辑单条操作 schema */
export const batchOpSchema: ToolProperty = {
  type: 'object',
  description: '单条操作。insert/copy 可带 as 绑定名，供同批内后续 op 用 parent:"@绑定名" 引用',
  properties: {
    op: {
      type: 'string',
      description:
        '操作类型：insert 插入 / copy 复制 / update 更新 / move 移动 / delete 删除 / image 生成图片'
    },
    as: { type: 'string', description: '绑定名（insert/copy）：同批内后续 op 用 parent:"@绑定名" 引用' },
    parent: {
      type: 'string',
      description: '父节点（insert/copy/move）："root" 或 group 的 id 或 "@绑定名"'
    },
    node: nodeSchema,
    id: { type: 'string', description: '目标节点 id（copy/move/delete/image）' },
    overrides: {
      type: 'object',
      description: 'copy 覆盖复制根节点自身的属性（不含子节点）'
    },
    path: {
      type: 'string',
      description: 'update 的节点路径："id" 或 "父id;子id"（可多层）或 "@绑定名;子id"'
    },
    patch: {
      type: 'object',
      description: 'update 要更新的字段（不能改 id / type / children）'
    },
    index: { type: 'number', description: 'move 在兄弟节点中的位置索引（省略放末尾）' },
    kind: {
      type: 'string',
      description:
        'image 类型：placeholder 渐变占位图（prompt 用 ≤20 字短标签）/ stock 网络占位图（prompt 为稳定种子词）/ ai 按 stock 兜底'
    },
    prompt: {
      type: 'string',
      description: 'image 提示词：placeholder 用短标签（如 "封面图"），stock 用种子词（如 "cinema"）'
    }
  }
}
