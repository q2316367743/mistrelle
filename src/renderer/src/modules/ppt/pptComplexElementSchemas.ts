/**
 * PPT 复杂节点元素 schema（TypeBox）——Table / Chart / Timeline / Flow / Tree / Matrix /
 * Pyramid / ProcessArrow / Svg 等结构型节点。统一 SlideNode 结构 { tag, attr, child }：
 * 结构化数据全部用子元素表达（Table→Tr/Td、Timeline→TimelineItem、Flow→FlowNode/Connection 等，
 * 与 POM XML 标签一一对应）；数组型属性（Chart 的 data / chartColors）为 attr 中的 JSON 字符串。
 * 公共属性见 pptCommonSchemas.ts；与基本节点（pptElementSchemas.ts）组成递归联合。
 */
import { Type } from '@sinclair/typebox'
import { borderAttrs, childUnion, commonAttrs, textAttrs } from './pptCommonSchemas'

export const buildTableNode = (Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Table'),
      attr: Type.Object(
        {
          defaultRowHeight: Type.Optional(Type.Number({ description: '默认行高（默认 32）' })),
          ...borderAttrs('cellBorder'),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(
          Type.Union(
            [
              Type.Object(
                {
                  tag: Type.Literal('Col'),
                  attr: Type.Object(
                    {
                      width: Type.Optional(Type.Number({ description: '列宽（省略均分）' })),
                      backgroundColor: Type.Optional(Type.String())
                    },
                    { additionalProperties: false }
                  )
                },
                { additionalProperties: false, description: '列定义（Col）' }
              ),
              Type.Object(
                {
                  tag: Type.Literal('Tr'),
                  attr: Type.Object({ height: Type.Optional(Type.Number({ description: '行高' })) }, { additionalProperties: false }),
                  child: Type.Optional(
                    Type.Array(
                      Type.Object(
                        {
                          tag: Type.Literal('Td'),
                          attr: Type.Object(
                            {
                              backgroundColor: Type.Optional(Type.String()),
                              colspan: Type.Optional(Type.Number()),
                              rowspan: Type.Optional(Type.Number()),
                              ...textAttrs
                            },
                            { additionalProperties: false }
                          ),
                          child: childUnion(Self)
                        },
                        { additionalProperties: false, description: '单元格（Td，文本写在 child）' }
                      ),
                      { description: '单元格数组' }
                    )
                  )
                },
                { additionalProperties: false, description: '行（Tr，Td 子元素）' }
              )
            ],
            { description: '列定义（Col）或行（Tr）' }
          )
        )
      )
    },
    { additionalProperties: false, description: 'Table 表格节点（Tr/Td 子元素形式，POM 自动补 columns）' }
  )

export const buildChartNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Chart'),
      attr: Type.Object(
        {
          chartType: Type.Union(
            [Type.Literal('bar'), Type.Literal('line'), Type.Literal('pie'), Type.Literal('area'), Type.Literal('doughnut'), Type.Literal('radar')],
            { description: '图表类型' }
          ),
          title: Type.Optional(Type.String()),
          showTitle: Type.Optional(Type.Boolean()),
          showLegend: Type.Optional(Type.Boolean()),
          chartColors: Type.Optional(Type.String({ description: '系列颜色 JSON 数组字符串，如 ["#FF6B6B","#4ECDC4"]' })),
          sparkline: Type.Optional(Type.Boolean({ description: '迷你图表（隐藏坐标轴/图例）' })),
          radarStyle: Type.Optional(Type.Union([Type.Literal('standard'), Type.Literal('marker'), Type.Literal('filled')])),
          data: Type.Optional(
            Type.String({
              description:
                '数据系列 JSON 数组字符串，如 [{"name":"销量","labels":["1月","2月"],"values":[30,50]}]（labels/values 为数组）'
            })
          ),
          ...commonAttrs
        },
        { additionalProperties: false }
      )
    },
    { additionalProperties: false, description: 'Chart 图表节点（data 为 JSON 字符串属性）' }
  )

export const buildTimelineNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Timeline'),
      attr: Type.Object(
        {
          direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
          dateColor: Type.Optional(Type.String()),
          titleColor: Type.Optional(Type.String()),
          descriptionColor: Type.Optional(Type.String()),
          connectorColor: Type.Optional(Type.String()),
          connectorGradient: Type.Optional(Type.String()),
          useColorForDate: Type.Optional(Type.Boolean()),
          fontFamily: Type.Optional(Type.String()),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(
          Type.Object(
            {
              tag: Type.Literal('TimelineItem'),
              attr: Type.Object(
                {
                  date: Type.String({ description: '日期（必填）' }),
                  title: Type.String({ description: '标题（必填）' }),
                  description: Type.Optional(Type.String()),
                  color: Type.Optional(Type.String()),
                  dateColor: Type.Optional(Type.String())
                },
                { additionalProperties: false }
              )
            },
            { additionalProperties: false, description: '时间线项（TimelineItem）' }
          ),
          { description: '时间线项数组' }
        )
      )
    },
    { additionalProperties: false, description: 'Timeline 时间线节点' }
  )

export const buildFlowNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Flow'),
      attr: Type.Object(
        {
          direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
          nodeWidth: Type.Optional(Type.Number({ description: '节点宽（默认 120）' })),
          nodeHeight: Type.Optional(Type.Number({ description: '节点高（默认 60）' })),
          nodeGap: Type.Optional(Type.Number({ description: '节点间距（默认 80）' })),
          'connectorStyle.color': Type.Optional(Type.String()),
          'connectorStyle.width': Type.Optional(Type.Number()),
          'connectorStyle.arrowType': Type.Optional(Type.String()),
          'connectorStyle.labelColor': Type.Optional(Type.String()),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(
          Type.Union(
            [
              Type.Object(
                {
                  tag: Type.Literal('FlowNode'),
                  attr: Type.Object(
                    {
                      id: Type.String({ description: '节点 id（必填，连接引用）' }),
                      shape: Type.Optional(Type.String({ description: 'flowChartProcess / flowChartDecision / flowChartTerminator 等' })),
                      text: Type.String({ description: '节点文本（必填）' }),
                      color: Type.Optional(Type.String()),
                      textColor: Type.Optional(Type.String()),
                      width: Type.Optional(Type.Number()),
                      height: Type.Optional(Type.Number())
                    },
                    { additionalProperties: false }
                  )
                },
                { additionalProperties: false, description: '流程节点（FlowNode）' }
              ),
              Type.Object(
                {
                  tag: Type.Literal('FlowConnection'),
                  attr: Type.Object(
                    {
                      from: Type.String({ description: '来源节点 id' }),
                      to: Type.String({ description: '目标节点 id' }),
                      label: Type.Optional(Type.String()),
                      color: Type.Optional(Type.String()),
                      labelColor: Type.Optional(Type.String())
                    },
                    { additionalProperties: false }
                  )
                },
                { additionalProperties: false, description: '流程连线（FlowConnection）' }
              )
            ],
            { description: '流程节点（FlowNode）或连线（FlowConnection）' }
          )
        )
      )
    },
    { additionalProperties: false, description: 'Flow 流程图节点' }
  )

const treeItemSchema = (Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('TreeItem'),
      attr: Type.Object(
        {
          label: Type.String({ description: '节点文本（必填）' }),
          color: Type.Optional(Type.String()),
          textColor: Type.Optional(Type.String())
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(Type.Array(Self as never, { description: '子节点（递归）' }))
    },
    { additionalProperties: false, description: '树节点（TreeItem）' }
  )

export const buildTreeNode = (Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Tree'),
      attr: Type.Object(
        {
          layout: Type.Optional(Type.Union([Type.Literal('vertical'), Type.Literal('horizontal')])),
          nodeShape: Type.Optional(Type.Union([Type.Literal('rect'), Type.Literal('roundRect'), Type.Literal('ellipse')])),
          textColor: Type.Optional(Type.String({ description: '节点文本色（默认 FFFFFF）' })),
          nodeWidth: Type.Optional(Type.Number({ description: '节点宽（默认 120）' })),
          nodeHeight: Type.Optional(Type.Number({ description: '节点高（默认 40）' })),
          levelGap: Type.Optional(Type.Number({ description: '层级间距（默认 60）' })),
          siblingGap: Type.Optional(Type.Number({ description: '同级间距（默认 20）' })),
          'connectorStyle.color': Type.Optional(Type.String()),
          'connectorStyle.width': Type.Optional(Type.Number()),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(Type.Array(treeItemSchema(Self), { description: '根节点（通常 1 个 TreeItem）' }))
    },
    { additionalProperties: false, description: 'Tree 树形结构节点（TreeItem 递归）' }
  )

export const buildMatrixNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Matrix'),
      attr: Type.Object(
        {
          axisLabelColor: Type.Optional(Type.String()),
          quadrantLabelColor: Type.Optional(Type.String()),
          itemLabelColor: Type.Optional(Type.String()),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(
          Type.Union(
            [
              Type.Object(
                {
                  tag: Type.Literal('MatrixAxes'),
                  attr: Type.Object(
                    { x: Type.String({ description: 'x 轴标签' }), y: Type.String({ description: 'y 轴标签' }) },
                    { additionalProperties: false }
                  )
                },
                { additionalProperties: false, description: '坐标轴标签（MatrixAxes）' }
              ),
              Type.Object(
                {
                  tag: Type.Literal('MatrixQuadrants'),
                  attr: Type.Object(
                    {
                      topLeft: Type.Optional(Type.String()),
                      topRight: Type.Optional(Type.String()),
                      bottomLeft: Type.Optional(Type.String()),
                      bottomRight: Type.Optional(Type.String())
                    },
                    { additionalProperties: false }
                  )
                },
                { additionalProperties: false, description: '象限标签（MatrixQuadrants）' }
              ),
              Type.Object(
                {
                  tag: Type.Literal('MatrixItem'),
                  attr: Type.Object(
                    {
                      label: Type.String({ description: '标签（必填）' }),
                      x: Type.Number({ description: 'x 坐标 0-1（0 左）' }),
                      y: Type.Number({ description: 'y 坐标 0-1（0 下）' }),
                      color: Type.Optional(Type.String()),
                      textColor: Type.Optional(Type.String())
                    },
                    { additionalProperties: false }
                  )
                },
                { additionalProperties: false, description: '矩阵项（MatrixItem）' }
              )
            ],
            { description: 'MatrixAxes / MatrixQuadrants / MatrixItem' }
          )
        )
      )
    },
    { additionalProperties: false, description: 'Matrix 四象限矩阵节点（坐标 0-1）' }
  )

export const buildPyramidNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Pyramid'),
      attr: Type.Object(
        {
          direction: Type.Optional(Type.Union([Type.Literal('up'), Type.Literal('down')])),
          fontSize: Type.Optional(Type.Number({ description: '层级字号（默认 14）' })),
          bold: Type.Optional(Type.Boolean()),
          fontFamily: Type.Optional(Type.String()),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(
          Type.Object(
            {
              tag: Type.Literal('PyramidLevel'),
              attr: Type.Object(
                {
                  label: Type.String({ description: '层级文本（必填）' }),
                  color: Type.Optional(Type.String({ description: '层级色（默认 4472C4）' })),
                  textColor: Type.Optional(Type.String())
                },
                { additionalProperties: false }
              )
            },
            { additionalProperties: false, description: '金字塔层级（PyramidLevel）' }
          ),
          { description: '层级数组' }
        )
      )
    },
    { additionalProperties: false, description: 'Pyramid 金字塔节点' }
  )

export const buildProcessArrowNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('ProcessArrow'),
      attr: Type.Object(
        {
          direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
          itemWidth: Type.Optional(Type.Number({ description: '步骤宽（默认 150）' })),
          itemHeight: Type.Optional(Type.Number({ description: '步骤高（默认 80）' })),
          gap: Type.Optional(Type.Number({ description: '间距（默认重叠）' })),
          fontSize: Type.Optional(Type.Number()),
          bold: Type.Optional(Type.Boolean()),
          ...commonAttrs
        },
        { additionalProperties: false }
      ),
      child: Type.Optional(
        Type.Array(
          Type.Object(
            {
              tag: Type.Literal('ProcessArrowStep'),
              attr: Type.Object(
                {
                  label: Type.String({ description: '步骤文本（必填）' }),
                  color: Type.Optional(Type.String({ description: '步骤色（默认 4472C4）' })),
                  textColor: Type.Optional(Type.String())
                },
                { additionalProperties: false }
              )
            },
            { additionalProperties: false, description: '流程箭头步骤（ProcessArrowStep）' }
          ),
          { description: '步骤数组' }
        )
      )
    },
    { additionalProperties: false, description: 'ProcessArrow 流程箭头节点' }
  )

/** commonAttrs 去掉 w/h（Svg 的 w/h 仅接受数字，不能是 "max" / 百分比） */
const { w: _svgW, h: _svgH, ...svgCommonAttrs } = commonAttrs

export const buildSvgNode = (_Self: unknown) =>
  Type.Object(
    {
      tag: Type.Literal('Svg'),
      attr: Type.Object(
        {
          w: Type.Optional(Type.Number({ description: 'SVG 宽度（px，**仅接受数字**，不支持 max / 百分比）' })),
          h: Type.Optional(Type.Number({ description: 'SVG 高度（px，**仅接受数字**，不支持 max / 百分比）' })),
          svgContent: Type.Optional(Type.String({ description: '内联 SVG 内容' })),
          color: Type.Optional(Type.String({ description: '统一着色（stroke）' })),
          ...svgCommonAttrs
        },
        { additionalProperties: false }
      )
    },
    { additionalProperties: false, description: 'Svg 内联 SVG 节点（w/h 仅接受数字）' }
  )
