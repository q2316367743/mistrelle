# PPT 经验指南（layout / nodes / styling）

> 本文档为 `ppt_guidelines` 工具的数据源（经 `?raw` 打包进应用），内容由 POM 官方文档
> （https://pom.pptx.app/nodes 、/layout-system 、/styling-guide）转写的**经验提示词**，
> 分别同步维护于 `src/renderer/src/modules/ppt/guidelines/` 下的 `layout.md` / `nodes.md` / `styling.md`，
> 修改时各对应文件需保持一致。元素一律为 SlideNode JSON（`{ tag, attr, child }`，见 02 文档）。

---

## 一、布局系统经验（layout，源自 layout-system）

### 1. 布局模型：Flexbox

- 底层由 yoga-layout 驱动，**Flexbox 风格布局**；只有两种布局容器（tag）：
  - `VStack`：子元素**从上到下**（主轴 = 垂直，交叉轴 = 水平）
  - `HStack`：子元素**从左到右**（主轴 = 水平，交叉轴 = 垂直）
- 铁律：**页面根元素必须是 VStack / HStack**；复杂页面 = 垂直分组用 VStack、水平分组用 HStack，**层层嵌套**。
- HStack 子元素默认可收缩（同 CSS flexShrink=1），百分比宽度 + gap 会自动收缩适配父容器。

### 2. 尺寸规则（attr）

| 写法 | 行为 |
|---|---|
| `"w": "400"` | 固定像素宽 |
| `"w": "max"` | 沿父级主轴撑满剩余空间（同 flexGrow=1） |
| `"w": "50%"` | 父容器百分比 |
| `"grow": "2"` | 兄弟间按比例分配主轴剩余空间（与 max 同用时 grow 优先） |
| `minW/maxW/minH/maxH` | 尺寸上下限约束 |

- `"w": "max"` + `"h": "max"` 让容器铺满整张幻灯片（页面根容器标配）。
- 比例分栏：HStack（`"w": "max"` `"h": "max"` `"gap": "16"`）内放 `"grow": "2"` 与 `"grow": "1"` 两个 VStack = 2:1 两栏。

### 3. 间距规则

- `gap`：**子元素之间**间距（VStack/HStack 专属；不含首尾外侧）
- `padding`：容器内部边缘与内容间距（所有节点；支持 `"padding": "24"` 或单侧 `"padding.top": "24"`）
- `margin`：元素外部间距（推开相邻元素；支持单侧 `"margin.top"`）
- 经验：**优先用 gap 控制间距**，不要用 margin 反复微调；页面四周 padding ≥ 40。

### 4. 对齐规则

- `alignItems`：**交叉轴**对齐（默认 `stretch` 拉伸填满）：start / center / end / stretch
  - VStack 中控制子元素水平位置；HStack 中控制垂直位置
- `justifyContent`：**主轴**对齐（默认 start）：start / center / end / spaceBetween / spaceAround / spaceEvenly
- `alignSelf`：子元素单独覆盖父级 alignItems
- 页面级居中：VStack 加 `"justifyContent": "center"` `"alignItems": "center"` + `"w": "max"` `"h": "max"`。

### 5. 换行与绝对定位

- `flexWrap`：nowrap（默认）/ wrap / wrapReverse（HStack 换新行、VStack 换新列）
- `"position": "absolute"` + `top/right/bottom/left`：脱离文档流，不影响兄弟布局
  - 典型：页码角标 `"bottom": "16"` `"right": "16"`；`Layer` 容器内做绝对定位叠放

### 6. 五种可直接套用的布局模式

1. **Header + Content（页头 + 内容）**：外层 VStack（`"w": "max"` `"h": "max"` + padding + gap），先标题组（标题 + 副标题），再内容区。
2. **Two-Column（两栏）**：HStack 内放两个 VStack 卡片（卡片加 `backgroundColor` + `borderRadius`）；HStack 子元素无显式宽度时**均分可用空间**。
3. **Three-Column Cards（三卡片）**：HStack + 三个 VStack 卡片，卡片用 `border.color` / `border.width` 描边，内部放指标名 + 数值。
4. **Centered（居中页）**：`"justifyContent": "center"` `"alignItems": "center"` + `"w": "max"` `"h": "max"`（封面 / 章节页）。
5. **Sidebar（侧栏布局）**：HStack 内左侧 VStack 设 `"w": "25%"` `"h": "max"` 做深色导航栏（`backgroundColor` 深色 + 浅色文字），右侧 VStack 做主要内容区。

### 7. 布局最佳实践

- 嵌套原则：**垂直分组用 VStack，水平分组用 HStack，按需层层嵌套**——先规划页面分区，再填内容。
- 间距用 `gap` 而非反复 margin；比例分配用 `grow` / 百分比而非硬编码像素。
- 卡片化：信息块放进带 `"backgroundColor": "FFFFFF"` `"borderRadius": "8"` `"padding": "24"` 的卡片容器，视觉更专业。
- 对齐优先于微调：同组元素靠容器对齐，不靠手调坐标。
- ⚠️ **布局边界（已自动规避）**：胶囊标签 / 徽章 / 图标+文字组合避免「HStack 直接嵌套无宽度的 HStack 再放文本」——POM 对嵌套 HStack 链中无显式宽度的文本测量会产生 NaN 宽度导致构建失败；主进程已自动为受影响文本补 `w="max"`，若仍遇到 `addTextBox: width must be a finite positive EMU value` 错误，请给文本或容器显式宽度（如 `"w": "max"`）。

---

## 二、节点参考（nodes，源自 nodes）

### 0. 文档结构

- 元素统一为 SlideNode：`{ tag, attr, child }`——tag 即标签名，attr 为属性对象，child 为子元素数组或文本字符串。
- `attr` 值统一写字符串（数字 / 布尔也写字符串，如 `"fontSize": "28"`、`"bold": "true"`）；对象属性用点表示法（`border.color`、`shadow.blur`、`padding.top`）。
- 颜色属性（以 Color/Colors 结尾、fill/glow 等对象里的 color 键、highlight、渐变色标）可用 `$token` 引用 theme 令牌；**令牌名以字母开头，可含字母 / 数字 / _ / -**；未知令牌会报错。
- 文本写在 child 字符串（Text / Shape / Li / Td）；容器子元素写在 child 数组；无子元素可省略 child。

### 1. 公共属性（attr，所有节点）

| 类别 | 属性 |
|---|---|
| 尺寸 | `w` / `h`（数字 \| "max" \| "50%"）、`grow`、`minW/maxW/minH/maxH` |
| 间距 | `padding`（统一或 `padding.top` 单侧）、`margin` |
| 背景 | `backgroundColor`、`backgroundGradient`（CSS 渐变）、`backgroundImage.src` + `backgroundImage.sizing`（cover/contain） |
| 边框 | `border.color` / `border.width` / `border.dashType`、`borderTop/Right/Bottom/Left`（单边，逐字段覆盖）、`borderRadius` |
| 定位 | `position`（relative/absolute）、`top/right/bottom/left`、`zIndex`、`alignSelf` |
| 效果 | `opacity`（0-1）、`shadow.type`（outer/inner）+ `shadow.blur/offset/angle/color/opacity`、`rotate`（仅 Text/Shape/Image/Icon） |
| 标识 | `id`（页面内唯一，Arrow 连接用） |

- 简写与点表示法可混用：`"padding": "16"`、`"border.color": "333333"`、`"border.width": "1"`。
- `border` 的 dashType：solid / dash / dashDot / lgDash / lgDashDot / lgDashDotDot / sysDash / sysDot。
- 渐变优先于背景色；线性 `linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)`（角度 0=自下而上，默认 180deg 自上而下），径向 `radial-gradient(circle at center, ...)`（至少 2 个色标）。

### 2. 文本类：Text / Shape 内文本 / Ul / Ol

- 公共文本属性：`fontSize`（默认 24）、`color`、`bold`、`italic`、`strike`、`underline`（true 或 `underline.style` wavy 等）、`highlight`（高亮色）、`fontFamily`（默认 Noto Sans JP）、`lineHeight`（默认 1.3）、`letterSpacing`、`textAlign`（left/center/right）、`subscript` / `superscript`。
- `Text`：文本写在 **child 字符串**；`textGradient` 文本渐变（优先于 color）；`glow` / `outline` 文本特效（原生导出）。
- `Ul` / `Ol`：`child` 为 `Li` 数组，文本写在 Li 的 child（每项可单独覆盖字号/颜色/粗斜体）。`Ol` 额外支持 `numberType`（arabicPlain / arabicPeriod / romanLcPeriod 等）+ `numberStartAt`。
- 内联装饰暂不支持（字符串 child 会转义）；KPI 大数字 + 小单位用 HStack（`alignItems="end"`）组合。

### 3. 图形类：Shape / Line / Arrow

- `Shape`：`shapeType`（roundRect / ellipse / triangle / diamond / star / heart / 流程图形状等 178 种）；文本写在 child；`fill.color` + `fill.transparency`（0-1，蒙层用）；`line.color/width/dashType` 描边；`glow` / `outline`（原生特效）。
- `Line`：`x1/y1/x2/y2` 绝对坐标（必填）+ `color` / `lineWidth` / `dashType` / `beginArrow` / `endArrow`；**不参与布局**。
- `Arrow`：`from` / `to` 引用节点 `id`（必填，Text 或 rect/roundRect/ellipse Shape），自动吸附连接点；找不到 id 会报 ARROW_REF_NOT_FOUND。

### 4. 媒体类：Image / Svg / Icon

- `Image`：`src`（**base64 data URI 或本地绝对路径，禁止 http**）；`sizing.type`（contain / cover / crop）+ `sizing.x/y/w/h`（crop 用）；缺省 w/h 时用原图尺寸。
- `Svg`：`svgContent` 为内联 SVG 内容；**`w` / `h` 仅接受数字（px），不支持 "max" / 百分比**（写 "max" 会导致校验失败）；`color` 统一着色（子元素显式 stroke/fill 优先）。
- `Icon`：`name`（lucide 图标名，如 rocket / check-circle / trending-up / users / target）；`size` 默认 24；`color`；`variant`（circle-filled / circle-outlined / square-filled / square-outlined）+ `bgColor`（默认 E0E0E0）做带底色图标。

### 5. 表格 Table

- 结构（**子元素形式**，POM 自动补 columns）：`child` 为 `Tr` 数组，Tr 的 child 为 `Td` 数组；Td 文本写在 child。列宽定制可加 `Col` 子元素（`width` 省略均分）。
- 单元格（Td）attr：`backgroundColor` / `bold` / `color` / `colspan` / `rowspan` / 文本属性。
- Table attr：`defaultRowHeight` 默认 32；`cellBorder.color` / `cellBorder.width` 统一定制单元格边框。

```json
{ "tag": "Table", "attr": { "defaultRowHeight": "36" }, "child": [
  { "tag": "Tr", "child": [
    { "tag": "Td", "attr": { "bold": "true" }, "child": "季度" },
    { "tag": "Td", "child": "Q1" }
  ] }
] }
```

### 6. 图表 Chart

- `chartType`：bar / line / pie / area / doughnut / radar。
- `data` 为 **JSON 字符串**属性：`"data": "[{\"name\":\"销量\",\"labels\":[\"1月\",\"2月\"],\"values\":[30,50]}]"`（系列 `{ name, labels: string[], values: number[] }`）。
- `chartColors` 同为 JSON 字符串（系列颜色数组）；`title` / `showTitle` / `showLegend`；`sparkline` 迷你图（隐藏坐标轴）；radar 支持 `radarStyle`（standard/marker/filled）。

### 7. 图示类：Timeline / Flow / Tree / Matrix / Pyramid / ProcessArrow

| 节点 | 关键属性 | 子结构（child） |
|---|---|---|
| Timeline | `direction`（horizontal/vertical）、`dateColor/titleColor/descriptionColor/connectorColor`、`useColorForDate` | `TimelineItem`（attr: date/title/description/color/dateColor） |
| Flow | `direction`、`nodeWidth/nodeHeight/nodeGap`、`connectorStyle.color/width/arrowType/labelColor` | `FlowNode`（attr: id/shape/text/color/textColor/width/height）+ `FlowConnection`（from/to/label） |
| Tree | `layout`（vertical/horizontal）、`nodeShape`（rect/roundRect/ellipse）、`levelGap/siblingGap` | `TreeItem`（attr: label/color/textColor，child 递归子 TreeItem；通常 1 个根） |
| Matrix | `axisLabelColor/quadrantLabelColor/itemLabelColor` | `MatrixAxes`（x/y）+ `MatrixQuadrants`（topLeft...）+ `MatrixItem`（label/x/y 坐标 0-1，y 0 在下） |
| Pyramid | `direction`（up/down）、`fontSize`（默认 14） | `PyramidLevel`（attr: label/color/textColor） |
| ProcessArrow | `direction`、`itemWidth/itemHeight/gap` | `ProcessArrowStep`（attr: label/color/textColor） |

### 8. 容器类：Layer

- 绝对定位容器（child 用 `position="absolute"` + 坐标），支持嵌套，参与 flexbox 布局（自身可设 w/h/backgroundColor）。
- 蒙层套路：`Layer` 内 Image + 半透明 `Shape`（`fill.color` + `fill.transparency` "0.6"）+ 居中 VStack 白字。

### 9. 使用要点

- 复杂数据先想图表：比较用 bar / 趋势用 line / 占比用 pie / doughnut。
- 流程 / 时间线 / 金字塔等图示节点能显著提升信息密度，优先于手拼形状。
- Icon 是低成本高观感元素（lucide 内置库），标题旁、卡片内多用。

---

## 三、样式经验（styling，源自 styling-guide）

### 1. 颜色系统

- **颜色一律 6 位 hex 不带 #**（如 `F8F9FA`），全篇统一格式。
- 创建时用 theme 声明全局色板：`{ "surface": "0F172A", "accent": "38BDF8", "textMain": "F8FAFC", "textMuted": "94A3B8" }`，之后 `"backgroundColor": "$surface"`、`"color": "$accent"` 引用；**换主题只改一处**。
- 推荐色板（角色 → 色值）：

| 用途 | 色值 |
|---|---|
| 标题（近黑） | `1A1A2E` |
| 正文（深灰） | `333333` |
| 副标题（中灰） | `666666` |
| 弱化文字（浅灰） | `999999` |
| 主色（蓝） | `1D4ED8` |
| 成功（绿） | `16A34A` |
| 警告（琥珀） | `D97706` |
| 危险（红） | `DC2626` |
| 信息（天蓝） | `0EA5E9` |
| 浅色背景（米白） | `F8F9FA` |
| 边框（浅灰） | `E5E7EB` |

- 经验：全篇 ≤ 5 个语义色 + 灰阶；深色页用 `surface` 深底 + `textMain` 浅字。

### 2. 字体规范

- 默认字体 **Noto Sans JP**（内置，中文可显示）；`fontFamily` 可换系统字体。
- **字号分级（官方规范）**：标题 28–40 / 小标题 18–24 / 正文 13–16 / 注释 10–12。
- `lineHeight` 默认 1.3（Text 与 Ul/Ol 保持同一数值视觉一致）。
- KPI 大数字 + 小单位：大数字 Text（`"fontSize": "48"` `"bold": "true"`）+ 小单位 Text（`"fontSize": "20"`）放 HStack（`alignItems="end"`）同基线组合。
- 文本效果：`highlight`（高亮底）、`underline`（`true` 或 `underline.style="wavy"` 波浪下划线）、`glow`（发光）/ `outline`（描边）原生导出可编辑（glow 需 PowerPoint 查看，LibreOffice 不渲染）。

### 3. 边框 / 阴影 / 圆角 / 渐变（attr 点表示法）

- **卡片标准样式**（信息块通用）：
  ```json
  { "tag": "VStack", "attr": {
    "backgroundColor": "FFFFFF", "borderRadius": "8", "padding": "24", "gap": "8",
    "border.color": "E5E7EB", "border.width": "1",
    "shadow.blur": "4", "shadow.offset": "2", "shadow.color": "000000", "shadow.opacity": "0.1"
  }, "child": [] }
  ```
- **侧边强调条**：`"border.color": "E5E7EB"` `"border.width": "1"` + `"borderLeft.color": "1D4ED8"` `"borderLeft.width": "6"`（细框 + 粗强调线）；标题下划线用 `borderBottom`。
- **背景渐变**（原生 PowerPoint 渐变，可编辑）：`"backgroundGradient": "linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)"`；深色封面页常见。
- **文本渐变**：`"textGradient": "linear-gradient(90deg, #38BDF8 0%, #A78BFA 100%)"`——标题视觉锚点。
- `opacity`（0-1）控制背景透明度；`shadow.type="inner"` 做内阴影。

### 4. 样式最佳实践

- **先定 Theme 再画页面**：所有颜色从令牌引用，全篇和谐且可整体换肤。
- **卡片化内容**：指标 / 要点放卡片（白底 + 圆角 + 细边 + 轻阴影），比裸文字专业。
- **卡片内层级**：标签 `"fontSize": "12"` `"color": "999999"` + 数值 `"fontSize": "28"` `"bold": "true"`（涨跌用语义色：绿 `16A34A` / 蓝 `1D4ED8`）。
- **蒙层叠字**：图片上放文字用 `Layer` + 半透明遮罩（`Shape` 加 `"fill.color": "000000"` `"fill.transparency": "0.6"`）+ 居中白字。
- **留白**：页面 padding ≥ 40、卡片 gap 8-16、标题下留 24 左右。
- **注意**：`rotate` 只影响渲染不影响布局（兄弟不避让），旋转元素需自行核对最终位置。
