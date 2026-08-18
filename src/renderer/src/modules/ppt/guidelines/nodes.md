# SlideNode 节点参考（来自官方 POM nodes 文档转写）

## 0. 文档结构

- 元素统一为 SlideNode：`{ tag, attr, child }`——tag 即标签名，attr 为属性对象，child 为子元素数组或文本字符串。
- **attr 键名优先匹配本表**；常见 CSS 别名（`fontWeight`→`bold`、`marginTop`→`margin.top`、`paddingBottom`→`padding.bottom` 等）校验前会自动转换，详见 `ppt_guidelines("operations")`。间距单侧规范键为
  `margin.top` / `padding.left`；加粗规范键为 `bold`。
- `attr` 值允许 number / boolean / string（如 `fontSize: 28`、`bold: true`，亦可写字符串）；对象属性用点表示法
  （`border.color`、`shadow.blur`、`padding.top`）。
- 颜色属性（以 Color/Colors 结尾、fill/glow 等对象里的 color 键、highlight、渐变色标）可用 `$token` 引用 theme 令牌；
  **令牌名以字母开头，可含字母 / 数字 / _ / -**；未知令牌会报错。
- 文本写在 child 字符串（Text / Shape / Li / Td）；容器子元素写在 child 数组；无子元素可省略 child。
- `Shape` 的 `shapeType` **必填**（见 §3）。

## 1. 公共属性（attr，所有节点）

| 类别 | 属性                                                                                                                       |
|------|----------------------------------------------------------------------------------------------------------------------------|
| 尺寸 | `w` / `h`（数字 \| "max" \| "50%"）、`grow`、`minW/maxW/minH/maxH`                                                         |
| 间距 | `padding`（统一或 `padding.top` 单侧）、`margin`（统一或 `margin.top` / `margin.right` / …；**不是** `marginTop`） |
| 背景 | `backgroundColor`、`backgroundGradient`（CSS 渐变）、`backgroundImage.src` + `backgroundImage.sizing`（cover/contain）       |
| 边框 | `border.color` / `border.width` / `border.dashType`、`borderTop/Right/Bottom/Left`（单边，逐字段覆盖）、`borderRadius`      |
| 定位 | `position`（relative/absolute）、`top/right/bottom/left`、`zIndex`、`alignSelf`                                            |
| 效果 | `opacity`（0-1）、`shadow.type`（outer/inner）+ `shadow.blur/offset/angle/color/opacity`、`rotate`（仅 Text/Shape/Image/Icon） |
| 标识 | `id`（页面内唯一，Arrow 连接用）                                                                                           |

- 简写与点表示法可混用：`"padding": "16"`、`"border.color": "333333"`、`"border.width": "1"`。
- `border` 的 dashType：solid / dash / dashDot / lgDash / lgDashDot / lgDashDotDot / sysDash / sysDot。
- 渐变优先于背景色；线性 `linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)`（角度 0=自下而上，默认 180deg 自上而下），径向
  `radial-gradient(circle at center, ...)`（至少 2 个色标）。

## 2. 文本类：Text / Shape 内文本 / Ul / Ol

- 公共文本属性：`fontSize`（默认 24）、`color`、`bold`、`italic`、`strike`、`underline`（true 或 `underline.style` wavy 等）、
  `highlight`（高亮色）、`fontFamily`（默认 Noto Sans JP）、`lineHeight`（默认 1.3）、`letterSpacing`、`textAlign`
  （left/center/right）、`subscript` / `superscript`。
- `Text`：文本写在 **child 字符串**；`textGradient` 文本渐变（优先于 color）；`glow` / `outline` 文本特效（原生导出）。
- `Ul` / `Ol`：`child` 为 `Li` 数组，文本写在 Li 的 child（每项可单独覆盖字号/颜色/粗斜体）。`Ol` 额外支持 `numberType`
  （arabicPlain / arabicPeriod / romanLcPeriod 等）+ `numberStartAt`。
- 内联装饰（Text / Li / Td 内）：`<B>` `<I>` `<U>` `<S>` `<Sub>` `<Sup>` `<A href>` `<Mark color>`
  `<Span color/fontSize/fontFamily/letterSpacing>`——KPI 大数字 + 小单位用 `<Span fontSize="20">` 同基线组合。

## 3. 图形类：Shape / Line / Arrow

- `Shape`：`shapeType` **必填**（roundRect / ellipse / triangle / diamond / star / heart / 流程图形状等 178 种）；文本写在 child；
  `fill.color` + `fill.transparency`（0-1，蒙层用）；`line.color/width/dashType` 描边；`glow` / `outline`（原生特效）。
- `Line`：`x1/y1/x2/y2` 绝对坐标（必填）+ `color` / `lineWidth` / `dashType` / `beginArrow` / `endArrow`； **不参与布局**。
- `Arrow`：`from` / `to` 引用节点 `id`（必填，Text 或 rect/roundRect/ellipse Shape），自动吸附连接点；找不到 id 会报
  ARROW_REF_NOT_FOUND。

## 4. 媒体类：Image / Svg / Icon

- `Image`：`src`（ **base64 data URI 或本地绝对路径，禁止 http**）；`sizing.type`（contain / cover / crop）+ `sizing.x/y/w/h`
  （crop 用）；缺省 w/h 时用原图尺寸。
- `Svg`：`svgContent` 为内联 SVG 内容；**`w` / `h` 仅接受数字（px），不支持 "max" / 百分比**（写 "max" 会导致校验失败）；
  `color` 统一着色（子元素显式 stroke/fill 优先）。
- `Icon`：`name`（lucide 图标名，如 rocket / check-circle / trending-up / users / target）；`size` 默认 24；`color`；`variant`
  （circle-filled / circle-outlined / square-filled / square-outlined）+ `bgColor`（默认 E0E0E0）做带底色图标。

## 5. 表格 Table

- 结构（**子元素形式**，POM 自动补 columns）：`child` 为 `Tr` 数组，Tr 的 child 为 `Td` 数组；Td 文本写在 child。
  列宽定制可加 `Col` 子元素（`width` 省略均分）。
- 单元格（Td）attr：`text`（或写 child）/ `backgroundColor` / `bold` / `color` / `colspan` / `rowspan` / 文本属性。
- Table attr：`defaultRowHeight` 默认 32；`cellBorder.color` / `cellBorder.width` 统一定制单元格边框。

```json
{ "tag": "Table", "attr": { "defaultRowHeight": "36" }, "child": [
  { "tag": "Tr", "child": [
    { "tag": "Td", "attr": { "bold": "true" }, "child": "季度" },
    { "tag": "Td", "child": "Q1" }
  ] }
] }
```

## 6. 图表 Chart

- `chartType`：bar / line / pie / area / doughnut / radar。
- `data` 为 **JSON 字符串**属性：`"data": "[{\"name\":\"销量\",\"labels\":[\"1月\",\"2月\"],\"values\":[30,50]}]"`
  （系列 `{ name, labels: string[], values: number[] }`）。
- `chartColors` 同为 JSON 字符串（系列颜色数组）；`title` / `showTitle` / `showLegend`；`sparkline` 迷你图（隐藏坐标轴）；
  radar 支持 `radarStyle`（standard/marker/filled）。

## 7. 图示类：Timeline / Flow / Tree / Matrix / Pyramid / ProcessArrow

| 节点         | 关键属性                                                                                                      | 子结构（child）                                                                                    |
|--------------|---------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| Timeline     | `direction`（horizontal/vertical）、`dateColor/titleColor/descriptionColor/connectorColor`、`useColorForDate` | `TimelineItem`（attr: date/title/description/color/dateColor）                                     |
| Flow         | `direction`、`nodeWidth/nodeHeight/nodeGap`、`connectorStyle.color/width/arrowType/labelColor`                 | `FlowNode`（attr: id/shape/text/color/textColor/width/height）+ `FlowConnection`（from/to/label）   |
| Tree         | `layout`（vertical/horizontal）、`nodeShape`（rect/roundRect/ellipse）、`levelGap/siblingGap`                  | `TreeItem`（attr: label/color/textColor，child 递归子 TreeItem；通常 1 个根）                       |
| Matrix       | `axisLabelColor/quadrantLabelColor/itemLabelColor`                                                             | `MatrixAxes`（x/y）+ `MatrixQuadrants`（topLeft...）+ `MatrixItem`（label/x/y 坐标 0-1，y 0 在下）  |
| Pyramid      | `direction`（up/down）、`fontSize`（默认 14）                                                                  | `PyramidLevel`（attr: label/color/textColor）                                                      |
| ProcessArrow | `direction`、`itemWidth/itemHeight/gap`                                                                        | `ProcessArrowStep`（attr: label/color/textColor）                                                  |

## 8. 容器类：Layer

- 绝对定位容器（child 用 `position="absolute"` + 坐标），支持嵌套，参与 flexbox 布局（自身可设 w/h/backgroundColor）。
- 蒙层套路：`Layer` 内 Image + 半透明 `Shape`（`fill.color` + `fill.transparency` "0.6"）+ 居中 VStack 白字。

## 9. 使用要点

- 复杂数据先想图表：比较用 bar / 趋势用 line / 占比用 pie / doughnut。
- 流程 / 时间线 / 金字塔等图示节点能显著提升信息密度，优先于手拼形状。
- Icon 是低成本高观感元素（lucide 内置库），标题旁、卡片内多用。
