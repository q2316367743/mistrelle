# POM XML 语法指南（PPT 专家专用）

> 本文件为 `ppt_guidelines` 工具的数据源（经 `?raw` 打包进应用），
> 同步维护于 `src/renderer/src/modules/ppt/guidelines/pom-xml-guide.md`，修改时两处需保持一致。

## 1. 文档结构

- 每页一个顶层 `<Slide>` 元素；可选一个 `<Theme>` 声明色板。
- `<Slide>` 内单个子元素直接用；多个子元素自动被 VStack 包裹。
- 所有页面级编辑（add / update / rewrite 片段）必须是完整 `<Slide>...</Slide>`。

```xml
<Theme 主色="1F2937" 强调色="38BDF8" 背景="F8F9FA" />
<Slide>
  <VStack w="100%" h="100%" padding="48" gap="24">
    <Text fontSize="40" bold="true" color="$主色">标题</Text>
    <Text fontSize="20" color="6B7280">副标题</Text>
  </VStack>
</Slide>
```

## 2. Theme 色板（全篇配色统一）

- `<Theme>` 属性名即 token 名（中文 / 英文均可，不要带 `$`），值用 6 位 hex（无 `#`）。
- 节点颜色属性用 `$token名` 引用，如 `color="$主色"`、`backgroundColor="$背景"`。
- ⚠️ 注意：经 batch_edit 写回后，`$token` 会被解析为实色 hex（视觉等价，但 `<Theme>` 声明消失），后续编辑直接写色值即可。

## 3. 布局：VStack / HStack / Layer

- `<VStack>` 纵向排布、`<HStack>` 横向排布（flexbox 布局）。
- 常用属性：`gap`（间距）、`padding`（内边距）、`alignItems`（start/center/end/stretch）、`justifyContent`（start/center/end/spaceBetween/spaceAround）、`flexWrap`。
- `w` / `h`：像素数字 | `"100%"`（铺满父级）| `"max"`（按内容收缩）。
- 通用属性：`margin`、`grow`、`position="absolute"` + `top/right/bottom/left`、`backgroundColor`、`backgroundGradient`、`border`（`color` / `width` / `dashType`）、`borderRadius`、`opacity`、`rotate`、`shadow`。
- `<Layer>`：绝对定位容器，子元素用 `position="absolute"` 定位。

## 4. Text 文本

```xml
<Text fontSize="40" bold="true" color="1F2937" textAlign="center">主标题</Text>
<Text>正文，默认字号 24、行距 1.3</Text>
```

- 属性：`text`（文本内容）、`fontSize`、`bold`、`italic`、`underline`、`strike`、`color`、`fontFamily`、`lineHeight`、`letterSpacing`、`textAlign`（start/center/end）。
- 内联装饰标签：`<B>粗</B>` `<I>斜</I>` `<U>下划线</U>` `<S>删除线</S>` `<Sub>` `<Sup>` `<A href="...">链接</A>` `<Mark color="FFD54F">高亮</Mark>` `<Span color="E53935" fontSize="16">片段</Span>`。

## 5. Icon 图标（lucide 内置库，无需资源）

```xml
<Icon name="rocket" size="48" color="38BDF8" />
<Icon name="lightbulb" size="36" variant="filled" bgColor="E3F2FD" color="1976D2" />
```

- `name`：lucide 图标名（如 rocket / check-circle / trending-up / users / target）。
- `size` 默认 24；`variant`（如 filled）产生带底色圆形变体，`bgColor` 控制底色。

## 6. Shape 形状

```xml
<Shape shapeType="rect" w="160" h="48" backgroundColor="38BDF8" borderRadius="8" />
<Shape shapeType="roundRect" w="100%" h="1" backgroundColor="E5E7EB" />
```

- `shapeType` 常用值：`rect` / `roundRect` / `ellipse` / `triangle` / `diamond` / `pentagon` / `hexagon` / `octagon` / `star` / `heart` / `line`（完整枚举较多，先用这些）。
- 支持 `text` 内容与内联装饰（同 Text）。

## 7. Table 表格

```xml
<Table>
  <Tr height="32">
    <Td text="项目" bold="true" backgroundColor="38BDF8" color="0F172A" />
    <Td text="数量" bold="true" backgroundColor="38BDF8" color="0F172A" />
  </Tr>
  <Tr>
    <Td text="PPT" />
    <Td text="42" />
  </Tr>
</Table>
```

- 结构：`<Table>` → `<Tr>`（行）→ `<Td>`（单元格）。
- `Td` 属性：`text` / `bold` / `color` / `backgroundColor` / `colspan` / `rowspan`；`Tr` 支持 `height`。
- 也可用 `<Col w="..." />` 显式定义列宽。

## 8. Chart 图表

```xml
<Chart chartType="bar" title="月度销售" showTitle="true" w="100%" h="320">
  <ChartSeries name="销售">
    <ChartDataPoint label="一月" value="320" />
    <ChartDataPoint label="二月" value="480" />
  </ChartSeries>
</Chart>
```

- `chartType`：`bar` / `line` / `pie` / `doughnut` / `area` / `radar`。
- `chartColors`（JSON 数组）可自定义系列颜色；`sparkline="true"` 迷你图表（仅 bar/line/area）。

## 9. 其他节点

| 节点 | 结构 | 用途 |
|---|---|---|
| `<Ul>` / `<Ol>` | `<Li>项目</Li>` | 无序 / 有序列表 |
| `<Timeline>` | `<TimelineItem title=".." date=".." text=".." />` | 时间线 |
| `<ProcessArrow>` | `<ProcessArrowStep text=".." />` | 流程箭头 |
| `<Pyramid>` | `<PyramidLevel text=".." />` | 金字塔层级 |
| `<Tree>` | `<TreeItem label=".."><TreeItem label=".."/></TreeItem>` | 树形结构 |
| `<Matrix>` | `<MatrixAxes />` `<MatrixQuadrants />` `<MatrixItem x=".." y=".." text=".." />` | 四象限矩阵 |
| `<Flow>` | `<FlowNode id=".." text=".." />` + `<FlowConnection from=".." to=".." />` | 流程图 |
| `<Line>` / `<Arrow>` | 坐标属性 | 线条 / 箭头 |
| `<Image src=".." sizing="cover" />` | `src` 为 base64 data URI 或本地绝对路径 | 图片 |
| `<Svg>` | 内联 SVG 内容 | 自定义矢量图 |

## 10. 设计铁律

- **画布 16:9（1280×720）**：顶层容器用 `w="100%" h="100%"` 铺满。
- **字号层级**：标题 40–56 / 小标题 24–32 / 正文 16–20；行距保持默认 1.3。
- **留白**：页面四周 `padding` ≥ 40，元素间 `gap` ≥ 16；避免内容贴边。
- **对齐**：同类元素用 VStack / HStack 统一排布，杜绝手摆坐标造成错位。
- **配色**：全篇 ≤ 5 色，用 `<Theme>` 统一声明，通过 `$token` 引用。
- **图片**：仅允许 base64 data URI（`data:image/png;base64,...`）或沙盒本地绝对路径；**禁止 http(s) 网络图片**（跨域 / 网络失败会渲染为占位）。
- **一页一主题**：每页聚焦一个要点，文字精炼，多用图标 / 图表 / 表格表达。

## 11. ppt_batch_edit 片段规范

- 页码从 1 开始；`update.index` / `remove.index` / `move.from` / `move.to` / `add.at` 均为当前文档页序（op 间顺序可见）。
- `add` 片段可包含多页（多个 `<Slide>`）；`update` / `rewrite` 必须恰好 1 页。
- 片段必须是完整 `<Slide>...</Slide>`，不能是裸 `<VStack>`（顶层只接受 `<Slide>` / `<Theme>`）。
- 任一 op 非法则整批回滚（不产生新版本文件），错误文本会原样返回，据此修正重试。
- 编辑成功会生成新版本 `slides-{N+1}.pom.xml` 并自动渲染；最新版本在侧边栏可选。
