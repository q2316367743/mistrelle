/**
 * PPT 复杂节点元素 schema（TypeBox）——Table / Chart / Timeline / Flow / Tree / Matrix /
 * Pyramid / ProcessArrow / Svg 等结构型节点（children / data / items 递归）。
 * 公共属性见 pptCommonSchemas.ts；与基本节点（pptElementSchemas.ts）组成递归联合。
 */
import { Type } from '@sinclair/typebox'
import { borderSchema, commonProps, textProps } from './pptCommonSchemas'

export const buildTableNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('table'),
      defaultRowHeight: Type.Optional(Type.Number({ description: '默认行高（默认 32）' })),
      cellBorder: Type.Optional(borderSchema),
      columns: Type.Optional(
        Type.Array(
          Type.Object(
            {
              width: Type.Optional(Type.Number({ description: '列宽（省略均分）' })),
              backgroundColor: Type.Optional(Type.String())
            },
            { additionalProperties: false }
          ),
          { description: '列定义（Col）' }
        )
      ),
      rows: Type.Optional(
        Type.Array(
          Type.Object(
            {
              height: Type.Optional(Type.Number({ description: '行高' })),
              cells: Type.Array(
                Type.Object(
                  {
                    text: Type.Optional(Type.String()),
                    backgroundColor: Type.Optional(Type.String()),
                    colspan: Type.Optional(Type.Number()),
                    rowspan: Type.Optional(Type.Number()),
                    ...textProps
                  },
                  { additionalProperties: false, description: '单元格（Td）' }
                ),
                { description: '单元格数组' }
              )
            },
            { additionalProperties: false, description: '行（Tr）' }
          ),
          { description: '行数组（Tr）' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '表格节点' }
  )

export const buildChartNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('chart'),
      chartType: Type.Union(
        [Type.Literal('bar'), Type.Literal('line'), Type.Literal('pie'), Type.Literal('area'), Type.Literal('doughnut'), Type.Literal('radar')],
        { description: '图表类型' }
      ),
      title: Type.Optional(Type.String()),
      showTitle: Type.Optional(Type.Boolean()),
      showLegend: Type.Optional(Type.Boolean()),
      chartColors: Type.Optional(Type.Array(Type.String(), { description: '系列颜色（JSON 数组）' })),
      sparkline: Type.Optional(Type.Boolean({ description: '迷你图表（隐藏坐标轴/图例）' })),
      radarStyle: Type.Optional(Type.Union([Type.Literal('standard'), Type.Literal('marker'), Type.Literal('filled')])),
      data: Type.Optional(
        Type.Array(
          Type.Object(
            {
              name: Type.Optional(Type.String({ description: '系列名' })),
              labels: Type.Array(Type.String(), { description: '分类标签' }),
              values: Type.Array(Type.Number(), { description: '数值' })
            },
            { additionalProperties: false, description: '数据系列（ChartSeries）' }
          ),
          { description: '系列数组' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '图表节点' }
  )

export const buildTimelineNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('timeline'),
      direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
      dateColor: Type.Optional(Type.String()),
      titleColor: Type.Optional(Type.String()),
      descriptionColor: Type.Optional(Type.String()),
      connectorColor: Type.Optional(Type.String()),
      connectorGradient: Type.Optional(Type.String()),
      useColorForDate: Type.Optional(Type.Boolean()),
      fontFamily: Type.Optional(Type.String()),
      items: Type.Optional(
        Type.Array(
          Type.Object(
            {
              date: Type.String({ description: '日期（必填）' }),
              title: Type.String({ description: '标题（必填）' }),
              description: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              dateColor: Type.Optional(Type.String())
            },
            { additionalProperties: false, description: '时间线项（TimelineItem）' }
          ),
          { description: '时间线项数组' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '时间线节点' }
  )

export const buildFlowNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('flow'),
      direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
      nodeWidth: Type.Optional(Type.Number({ description: '节点宽（默认 120）' })),
      nodeHeight: Type.Optional(Type.Number({ description: '节点高（默认 60）' })),
      nodeGap: Type.Optional(Type.Number({ description: '节点间距（默认 80）' })),
      connectorStyle: Type.Optional(
        Type.Object({
          color: Type.Optional(Type.String()),
          width: Type.Optional(Type.Number()),
          arrowType: Type.Optional(Type.String()),
          labelColor: Type.Optional(Type.String())
        })
      ),
      nodes: Type.Optional(
        Type.Array(
          Type.Object(
            {
              id: Type.String({ description: '节点 id（必填，连接引用）' }),
              shape: Type.Optional(Type.String({ description: 'flowChartProcess / flowChartDecision / flowChartTerminator 等' })),
              text: Type.String({ description: '节点文本（必填）' }),
              color: Type.Optional(Type.String()),
              textColor: Type.Optional(Type.String()),
              width: Type.Optional(Type.Number()),
              height: Type.Optional(Type.Number())
            },
            { additionalProperties: false, description: '流程节点（FlowNode）' }
          ),
          { description: '节点数组' }
        )
      ),
      connections: Type.Optional(
        Type.Array(
          Type.Object(
            {
              from: Type.String({ description: '来源节点 id' }),
              to: Type.String({ description: '目标节点 id' }),
              label: Type.Optional(Type.String()),
              color: Type.Optional(Type.String()),
              labelColor: Type.Optional(Type.String())
            },
            { additionalProperties: false, description: '流程连线（FlowConnection）' }
          ),
          { description: '连线数组' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '流程图节点' }
  )

const treeItemSchema = (Self: unknown) =>
  Type.Object(
    {
      label: Type.String({ description: '节点文本（必填）' }),
      color: Type.Optional(Type.String()),
      textColor: Type.Optional(Type.String()),
      children: Type.Optional(Type.Array(Self as never, { description: '子节点（递归）' }))
    },
    { additionalProperties: false, description: '树节点（TreeItem）' }
  )

export const buildTreeNode = (Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('tree'),
      layout: Type.Optional(Type.Union([Type.Literal('vertical'), Type.Literal('horizontal')])),
      nodeShape: Type.Optional(Type.Union([Type.Literal('rect'), Type.Literal('roundRect'), Type.Literal('ellipse')])),
      textColor: Type.Optional(Type.String({ description: '节点文本色（默认 FFFFFF）' })),
      nodeWidth: Type.Optional(Type.Number({ description: '节点宽（默认 120）' })),
      nodeHeight: Type.Optional(Type.Number({ description: '节点高（默认 40）' })),
      levelGap: Type.Optional(Type.Number({ description: '层级间距（默认 60）' })),
      siblingGap: Type.Optional(Type.Number({ description: '同级间距（默认 20）' })),
      connectorStyle: Type.Optional(Type.Object({ color: Type.Optional(Type.String()), width: Type.Optional(Type.Number()) })),
      data: Type.Optional(treeItemSchema(Self)),
      ...commonProps
    },
    { additionalProperties: false, description: '树形结构节点' }
  )

export const buildMatrixNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('matrix'),
      axisLabelColor: Type.Optional(Type.String()),
      quadrantLabelColor: Type.Optional(Type.String()),
      itemLabelColor: Type.Optional(Type.String()),
      axes: Type.Optional(
        Type.Object(
          { x: Type.String({ description: 'x 轴标签' }), y: Type.String({ description: 'y 轴标签' }) },
          { additionalProperties: false }
        )
      ),
      quadrants: Type.Optional(
        Type.Object(
          {
            topLeft: Type.Optional(Type.String()),
            topRight: Type.Optional(Type.String()),
            bottomLeft: Type.Optional(Type.String()),
            bottomRight: Type.Optional(Type.String())
          },
          { additionalProperties: false }
        )
      ),
      items: Type.Optional(
        Type.Array(
          Type.Object(
            {
              label: Type.String({ description: '标签（必填）' }),
              x: Type.Number({ description: 'x 坐标 0-1（0 左）' }),
              y: Type.Number({ description: 'y 坐标 0-1（0 下）' }),
              color: Type.Optional(Type.String()),
              textColor: Type.Optional(Type.String())
            },
            { additionalProperties: false, description: '矩阵项（MatrixItem）' }
          ),
          { description: '矩阵项数组' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '四象限矩阵节点（坐标 0-1）' }
  )

export const buildPyramidNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('pyramid'),
      direction: Type.Optional(Type.Union([Type.Literal('up'), Type.Literal('down')])),
      fontSize: Type.Optional(Type.Number({ description: '层级字号（默认 14）' })),
      bold: Type.Optional(Type.Boolean()),
      fontFamily: Type.Optional(Type.String()),
      levels: Type.Optional(
        Type.Array(
          Type.Object(
            {
              label: Type.String({ description: '层级文本（必填）' }),
              color: Type.Optional(Type.String({ description: '层级色（默认 4472C4）' })),
              textColor: Type.Optional(Type.String())
            },
            { additionalProperties: false, description: '金字塔层级（PyramidLevel）' }
          ),
          { description: '层级数组' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '金字塔节点' }
  )

export const buildProcessArrowNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('processArrow'),
      direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
      itemWidth: Type.Optional(Type.Number({ description: '步骤宽（默认 150）' })),
      itemHeight: Type.Optional(Type.Number({ description: '步骤高（默认 80）' })),
      gap: Type.Optional(Type.Number({ description: '间距（默认重叠）' })),
      fontSize: Type.Optional(Type.Number()),
      bold: Type.Optional(Type.Boolean()),
      steps: Type.Optional(
        Type.Array(
          Type.Object(
            {
              label: Type.String({ description: '步骤文本（必填）' }),
              color: Type.Optional(Type.String({ description: '步骤色（默认 4472C4）' })),
              textColor: Type.Optional(Type.String())
            },
            { additionalProperties: false, description: '流程箭头步骤（ProcessArrowStep）' }
          ),
          { description: '步骤数组' }
        )
      ),
      ...commonProps
    },
    { additionalProperties: false, description: '流程箭头节点' }
  )

/** commonProps 去掉 w/h（Svg 的 w/h 仅接受数字，不能是 "max" / 百分比） */
const { w: _svgW, h: _svgH, ...svgCommonProps } = commonProps

export const buildSvgNode = (_Self: unknown) =>
  Type.Object(
    {
      type: Type.Literal('svg'),
      w: Type.Optional(Type.Number({ description: 'SVG 宽度（px，**仅接受数字**，不支持 max / 百分比）' })),
      h: Type.Optional(Type.Number({ description: 'SVG 高度（px，**仅接受数字**，不支持 max / 百分比）' })),
      svgContent: Type.Optional(Type.String({ description: '内联 SVG 内容' })),
      color: Type.Optional(Type.String({ description: '统一着色（stroke）' })),
      ...svgCommonProps
    },
    { additionalProperties: false, description: '内联 SVG 节点（w/h 仅接受数字）' }
  )
