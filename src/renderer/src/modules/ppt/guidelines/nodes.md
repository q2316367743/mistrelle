# POM 节点参考（来自官方 nodes 文档转写）

## 0. 文档结构

- 顶层只允许 `<Slide>`（每页一个）与 `<Theme>`（全局色板，最多一个）。
- `<Slide>` 必须包含至少一个子元素；多个 `<Slide>` 即多页。
- 颜色属性（以 Color/Colors 结尾、对象里的 color 键、highlight、渐变色标）可用 `$token` 引用 `<Theme>` 令牌；
  **令牌名以字母开头，可含字母 / 数字 / _ / -**；未知令牌会报错。

## 1. 公共属性（所有节点）

| 类别 | 属性                                                                                                                       |
|------|----------------------------------------------------------------------------------------------------------------------------|
| 尺寸 | `w` / `h`（数字 \| "max" \| "50%"）、`grow`、`minW/maxW/minH/maxH`                                                         |
| 间距 | `padding`（统一或 `padding.top` 单侧）、`margin`                                                                           |
| 背景 | `backgroundColor`、`backgroundGradient`（CSS 渐变）、`backgroundImage`（`src` + `sizing` cover/contain）                   |
| 边框 | `border`（`color`/`width`/`dashType`）、`borderTop/Right/Bottom/Left`（单边，逐字段覆盖）、`borderRadius`                  |
| 定位 | `position`（relative/absolute）、`top/right/bottom/left`、`zIndex`、`alignSelf`                                            |
| 效果 | `opacity`（0-1）、`shadow`（`type` outer/inner + `blur/offset/angle/color/opacity`）、`rotate`（仅 Text/Shape/Image/Icon） |
| 标识 | `id`（页面内唯一，Arrow 连接用）                                                                                           |

- 简写与点表示法可混用：`padding="16"`、`border.color="333" border.width="1"`。
- `border` 的 dashType：solid / dash / dashDot / lgDash / lgDashDot / lgDashDotDot / sysDash / sysDot。
- 渐变优先于背景色；线性 `linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)`（角度 0=自下而上，默认 180deg 自上而下），径向
  `radial-gradient(circle at center, ...)`（至少 2 个色标）。

## 2. 文本类：Text / Shape 内文本 / Ul / Ol

- 公共文本属性：`fontSize`（默认 24）、`color`、`bold`、`italic`、`strike`、`underline`（true 或 `underline.style` wavy 等）、
  `highlight`（高亮色）、`fontFamily`（默认 Noto Sans JP）、`lineHeight`（默认 1.3）、`letterSpacing`、`textAlign`
  （left/center/right）、`subscript` / `superscript`。
- `Text`：`text` 内容；`textGradient` 文本渐变（优先于 color）；`glow` / `outline` 文本特效（原生导出）。
- `Ul`：`<Li>` 子项（每项可单独覆盖字号/颜色/粗斜体）。`Ol` 额外支持 `numberType`（arabicPlain / arabicPeriod / romanLcPeriod
  等）+ `numberStartAt`。
- 内联装饰（Text / Li / Td 内）：`<B>` `<I>` `<U>` `<S>` `<Sub>` `<Sup>` `<A href>` `<Mark color>`
  `<Span color/fontSize/fontFamily/letterSpacing>`——KPI 大数字 + 小单位用 `<Span fontSize="20">` 同基线组合。

## 3. 图形类：Shape / Line / Arrow

- `Shape`：`shapeType`（roundRect / ellipse / triangle / diamond / star / heart / 流程图形状等 178 种）；内容文本 + 文本属性；
  `fill`（`color` + `transparency` 0-1，蒙层用）；`line`（`color/width/dashType` 描边）；`glow` / `outline`（原生特效）。
- `Line`：`x1/y1/x2/y2` 绝对坐标（必填）+ `color` / `lineWidth` / `dashType` / `beginArrow` / `endArrow`； **不参与布局**。
- `Arrow`：`from` / `to` 引用节点 `id`（必填，Text 或 rect/roundRect/ellipse Shape），自动吸附连接点；找不到 id 会报
  ARROW_REF_NOT_FOUND。

## 4. 媒体类：Image / Svg / Icon

- `Image`：`src`（ **base64 data URI 或本地绝对路径，禁止 http**）；`sizing`（contain / cover / crop）；缺省 w/h 时用原图尺寸。
- `Svg`：内联 SVG 内容；`w/h` 默认 24；`color` 统一着色（子元素显式 stroke/fill 优先）。
- `Icon`：`name`（lucide 图标名，如 rocket / check-circle / trending-up / users / target）；`size` 默认 24；`color`；`variant`
  （circle-filled / circle-outlined / square-filled / square-outlined）+ `bgColor`（默认 E0E0E0）做带底色图标。

## 5. 表格 Table

- 结构：`columns`（Col：width 省略均分）+ `rows`（Tr：height + cells）。
- 单元格（Td）：`text` / `backgroundColor` / `bold` / `color` / `colspan` / `rowspan` / 文本属性；支持内联装饰。
- `defaultRowHeight` 默认 32；`cellBorder` 统一定制单元格边框。

## 6. 图表 Chart

- `chartType`：bar / line / pie / area / doughnut / radar。
- `data` 系列数组：`{ name, labels: string[], values: number[] }`。
- `title` / `showTitle` / `showLegend`；`chartColors` 系列颜色数组；`sparkline` 迷你图（隐藏坐标轴）；radar 支持 `radarStyle`
  （standard/marker/filled）。

## 7. 图示类：Timeline / Flow / Tree / Matrix / Pyramid / ProcessArrow

| 节点         | 关键属性                                                                                                      | 子结构                                                                                          |
|--------------|---------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Timeline     | `direction`（horizontal/vertical）、`dateColor/titleColor/descriptionColor/connectorColor`、`useColorForDate` | `items: { date, title, description?, color? }[]`                                                |
| Flow         | `direction`、`nodeWidth/nodeHeight/nodeGap`、`connectorStyle`                                                 | `nodes: { id, shape, text }[]` + `connections: { from, to, label? }[]`                          |
| Tree         | `layout`（vertical/horizontal）、`nodeShape`（rect/roundRect/ellipse）、`levelGap/siblingGap`                 | `data: { label, color?, textColor?, children? }`（递归，唯一根）                                |
| Matrix       | `axisLabelColor/quadrantLabelColor/itemLabelColor`                                                            | `axes: { x, y }` + `quadrants: { topLeft... }` + `items: { label, x, y }`（坐标 0-1，y 0 在下） |
| Pyramid      | `direction`（up/down）、`fontSize`（默认 14）                                                                 | `levels: { label, color?, textColor? }[]`                                                       |
| ProcessArrow | `direction`、`itemWidth/itemHeight/gap`                                                                       | `steps: { label, color?, textColor? }[]`                                                        |

## 8. 容器类：Layer

- 绝对定位容器（children 用 `position="absolute"` + 坐标），支持嵌套，参与 flexbox 布局（自身可设 w/h/backgroundColor）。
- 蒙层套路：`Layer` 内 Image + 半透明 `Shape fill.transparency="0.6"` + 居中 VStack 白字。

## 9. 使用要点

- 复杂数据先想图表：比较用 bar / 趋势用 line / 占比用 pie / doughnut。
- 流程 / 时间线 / 金字塔等图示节点能显著提升信息密度，优先于手拼形状。
- Icon 是低成本高观感元素（lucide 内置库），标题旁、卡片内多用。
