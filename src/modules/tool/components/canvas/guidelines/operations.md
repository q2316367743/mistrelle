# 批量编辑与节点速查（operations）

> `canvas_batch_edit` 是设计画布的核心工具。每批 ≤ 25 个操作，参数经 **严格校验**：
> 单个操作非法（字段名错误 / 类型不匹配 / 取值越界）只让 **该操作**失败并返回错误，其余操作照常执行。
> 本文是画布模型的完整参考：节点 schema、操作语法、易错点、示例。

## 1. 图层模型

- 画布是一棵 **图层树**：`doc.nodes` 为根图层，`children` 顺序即 z 序（后画者在上）。
- **区域分组模型**：画面先拆成一个个「区域」（卡片 / 标签 / 按钮 / 图标组……）。一个区域内由 ≥2 个元素拼成时，**必须先建 `group` 收拢**并开 `layout` 排布，子节点不带 x/y（默认 AUTO 交引擎）；区域内只有 1 个原子元素（孤立 text / rect / 图形 /
  图片）才直接自由定位。
- **手动 x/y 仅用于**：顶层区块定位、layout 组内的 `ABSOLUTE` 锚点。
- 所有节点 **必须赋有意义的 `name`**（图层名），便于后续引用与辨识。
- **调色板**：先 `canvas_set_palette` 定义 3-5 个颜色 token，fill/stroke 用 `$token名` 引用。

## 1.5 区域分组原则（先拆区域再画）

**机械判定（无歧义）**：一个区域内最终由 ≥2 个元素拼成 → 必须建 `group`。

| 场景                                                  | 判定                         |
|-------------------------------------------------------|------------------------------|
| 文字放在背景 / 色块里（标签、按钮、数字圆点、图标底） | 背景 + 文字 = 2 元素 → group |
| 图标落在底座上                                        | 图标 + 底 = 2 元素 → group   |
| 标题 + 副标题 / 多行信息要对齐成一体                  | → group                      |
| 卡片（背景 + 标题 + 正文 + 标签）                     | → group（可用嵌套 group）    |
| 孤立单个文字 / 色块 / 图形 / 图片                     | 原子元素，直接自由定位       |

**怎么建 group（两种等价写法）**：

```jsonc
// 方式一：insert 时内联 children，一次建整棵子树
{ "op": "insert", "as": "badge", "parent": "root", "node": {
  "type": "group", "name": "标签", "layout": "horizontal", "gap": 8,
  "padding": [8, 16], "primaryAxisAlignItems": "CENTER", "counterAxisAlignItems": "CENTER",
  "fill": "$强调色", "cornerRadius": 20,
  "children": [
    { "type": "text", "name": "标签文字", "text": "限时 48 小时", "fontSize": 24, "fill": "#FFFFFF" }
  ]
}}

// 方式二：先 insert group，再 insert 到 "@绑定名" 逐个挂子节点
{ "op": "insert", "as": "card", "parent": "root", "node": { "type": "group", "name": "卡片", "layout": "vertical", "gap": 12, "padding": 24, "width": 400, "fill": "$中性色", "cornerRadius": 16 } },
{ "op": "insert", "parent": "@card", "node": { "type": "text", "name": "卡片标题", "text": "本周阅读清单", "fontSize": 32, "fontWeight": 700, "fill": "$主色" } },
{ "op": "insert", "parent": "@card", "node": { "type": "text", "name": "卡片正文", "text": "三本书，三个夜晚。", "fontSize": 24, "fill": "$中性色" } }
```

**尺寸策略**：

- group 想「包裹内容」→ 不写 width/height（缺省按内容扩张）或写 `"hug_contents"`
- group 想「撑满父区域」→ width/height 写数字，或写 `"fill_container"`
- **`fill_container` 交叉轴撑满**：hug 容器内也可用——容器交叉轴尺寸由「非 fill 子节点」决定，fill 子自动拉伸到容器内容区（如「圆点容器高度 = 文字列高度」）
- **主轴 `fill_container`**：需要组有确定的主轴尺寸（显式 / 父约束）；hug 容器主轴无剩余空间时不拉伸（flexbox 标准）
- **hug 组交叉轴** = max(非 fill 子节点交叉轴) + padding，交叉轴对齐（CENTER/MAX）自动生效，矮元素相对最高元素居中
- 文本子节点不要手写 width/height，交引擎按内容估算
- group 有背景（fill）时建议显式 `padding`，文字才不会贴边

**layout 选型**：

- `horizontal`：标签、按钮、行内图标组——配 `counterAxisAlignItems:"CENTER"` 垂直居中
- `vertical`：卡片（标题 + 正文 + 标签纵向堆叠）、标题区块
- `wrap`：徽章墙、多图拼贴（行内交叉轴对齐暂未实现，行内元素按顶部对齐）

## 2. 节点类型

| type      | 说明                                                           | 必带字段                                             |
|-----------|----------------------------------------------------------------|------------------------------------------------------|
| `group`   | 容器图层：组织子节点；可设背景 fill / 圆角 / 阴影；可选 layout | name；尺寸通常 hug_contents 或显式                   |
| `text`    | 文本                                                           | text、fontSize、fill（必须设置，否则不可见）         |
| `rect`    | 矩形（海报主视觉 / 色块 / 卡片）                               | width、height                                        |
| `ellipse` | 椭圆 / 圆                                                      | width、height                                        |
| `line`    | 折线（分隔线 / 装饰线）                                        | points（相对 x/y 的扁平坐标）                        |
| `polygon` | 正多边形                                                       | width、height、sides                                 |
| `star`    | 星形                                                           | width、height、corners                               |
| `path`    | SVG 路径                                                       | path                                                 |
| `image`   | 图片                                                           | imageUrl（file:// / http(s)）；建议显式 width/height |
| `svg`     | 内联 SVG / 图标                                                | svg 字符串（或 imageUrl）                            |

> **图标 / 简单图形规则**：图标默认用 **`svg` 节点写内联 SVG**——优先 `icon_svg` 工具取真实图标
> （Iconify 聚合开源图标库），svg 内颜色可写 `$token名`（落盘时自动替换为调色板实色），或 icon_svg 的 `?color=` 参数直接上色。
> 简单单色图形（圆点 / 分隔线 / 星标 / 书签）用原生节点组合（`rect` / `ellipse` / `path` / `line` / `star` / `polygon`），
> 颜色用 `fill` + `$token名`。`path` 画描边图标时设 `fill: "none"` + `stroke` + `strokeWidth`；`line` 的颜色写在 `stroke`（不是 fill）。

## 3. 常用属性速查

| 用途                       | 字段                           | 说明                                                                      |
|----------------------------|--------------------------------|---------------------------------------------------------------------------|
| 颜色（文字 / 形状 / 背景） | `fill`                         | 统一用 fill：#RRGGBB / rgba() / 颜色名 / `$token名` / 渐变对象            |
| 描边                       | `stroke` + `strokeWidth`       | 结构同 fill                                                               |
| 圆角                       | `cornerRadius`                 | **不是 borderRadius**                                                     |
| 字重                       | `fontWeight`                   | 数字 400 / 700，或字符串 "400"~"900"                                      |
| 字体                       | `fontFamily`                   | 指定家族；中文建议思源 / 霞鹜等                                           |
| 字间距 / 行高              | `letterSpacing` / `lineHeight` | lineHeight 可数值或 "AUTO"                                                |
| 大小写                     | `textCase`                     | none / upper / lower                                                      |
| 阴影 / 模糊                | `effects`                      | 数组：[{type:"drop-shadow",x,y,radius,color}, {type:"layer-blur",radius}] |
| 混合模式                   | `blendMode`                    | normal / multiply / screen / overlay 等                                   |
| 描边字                     | `stroke` + `strokeWidth`       | text 节点也能描边，做标题字轮廓                                           |

渐变对象（fill / stroke 通用）：

```json
{
  "type": "linear",
  "from": "top-left",
  "to": "bottom-right",
  "stops": [
    "#667eea",
    "#764ba2"
  ]
}
```

type 支持 linear（线性）/ radial（径向光晕）/ angular（角度色环）；stops 可为纯色字符串（自动均分）或
`{"offset":0,"color":"#fff"}`。

### 动画（节点 animation 字段）

给任意节点加 `animation` 字段即可描述动效（预览自动播放；导出由用户在画布面板操作）：

```jsonc
{ "op": "insert", "parent": "root", "node": {
  "type": "text", "name": "主标题", "text": "年度报告", "fontSize": 96, "fill": "$主色",
  "animation": { "style": { "opacity": 1, "y": 40 }, "duration": 0.8, "easing": "ease-out" }
}}
```

| 字段                                      | 说明                                                                                                           |
|-------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `style`                                   | 目标样式：x / y / rotation / opacity / fill / cornerRadius / scaleX / scaleY 等任意渲染属性                    |
| `keyframes`                               | 关键帧动画（优先于 style），如 `[{style:{opacity:0}},{style:{opacity:1}}]`，每帧可带 duration / delay / easing |
| `duration` / `delay`                      | 时长 / 延迟（秒）                                                                                              |
| `easing`                                  | 缓动：'ease' / 'linear' / 'bounce-out' 等                                                                      |
| `loop`                                    | 循环：true 无限 / 数字次数（背景光晕"呼吸"常用 opacity loop）                                                  |
| `swing`                                   | 摇摆往返循环                                                                                                   |
| `reverse` / `speed` / `join` / `autoplay` | 反向 / 倍速 / 加入起始态 / 自动播放                                                                            |

要点：

- 动画 = 「节点初始状态 → 目标 style」，节点自身的 x / y / opacity 即动画起点，无需额外写 from
- 文字也支持动画：打字机（style.text 更长字符串）、数字 count（text 为数字）
- 动效导出 mp4 / gif / webm 由用户在画布面板「导出为视频」操作（可选择帧率 / 时长 / 格式 / 分辨率），AI 只负责写 animation 字段

## 4. 批量操作（operations）

`operations` 是操作数组，顺序执行：

```jsonc
[
  { "op": "insert", "as": "hero", "parent": "root", "node": { "type": "group", "name": "Hero 区", "width": 1080, "height": 600 } },
  { "op": "insert", "parent": "@hero", "node": { "type": "text", "name": "主标题", "text": "午夜电影院", "fontSize": 96, "fill": "#F1FAEE" } },
  { "op": "update", "path": "@hero", "patch": { "layout": "vertical", "gap": 16, "primaryAxisAlignItems": "CENTER" } },
  { "op": "image", "id": "<某个 rect 的 id>", "kind": "stock", "prompt": "cinema" }
]
```

| op       | 作用                      | 关键参数                                                                |
|----------|---------------------------|-------------------------------------------------------------------------|
| `insert` | 插入节点到父节点          | `parent`: "root" / group id / "@绑定名"；`node`: 节点数据；`as`: 绑定名 |
| `copy`   | 深拷贝节点（id 重新生成） | `id`, `parent`, `overrides`（覆盖根节点自身属性）                       |
| `update` | 更新节点属性              | `path`: "id" 或 "父id;子id" 或 "@绑定;子id"；`patch`                    |
| `move`   | 移动 / 重排               | `id`, `parent?`, `index?`                                               |
| `delete` | 删除节点（含子树）        | `id`                                                                    |
| `image`  | 生成图片                  | `id`, `kind`: placeholder / stock / ai, `prompt`                        |

**绑定名（as）**：同一批内 `insert` / `copy` 可带 `as`，后续 op 用 `parent: "@绑定名"` 引用刚创建的节点，用于一批内搭出层级。绑定名仅本批有效。

**path 用 `;` 分隔**：更新嵌套子节点用 `"父id;子id"`，可多层：`"cardId;titleId"`。

**image 操作**：

- `placeholder`：给节点铺灰色渐变 + 居中短标签（prompt 用 ≤20 字，如 "封面图"）
- `stock`：picsum 网络占位图（prompt 为种子词，稳定可复用），自动下载到沙盒
- `ai`：暂按 stock 兜底（无生图服务时不要依赖）
- `web`：**真实图片**（url 填 http/https 地址，自动下载到沙盒 outputs/images/ 并设为 imageUrl；下载失败退回远程 URL）

**素材工具（design，配合真实素材）**：

- `website_logo(url)`：按网站地址 / 域名获取真实 logo / favicon，自动下载到沙盒 outputs/images/ 返回本地路径 → 填 `image` 节点 `imageUrl`（禁止自己画近似 logo）
- `icon_svg(name | query, color?)`：Iconify 真实 SVG 图标；`name` 形如 `"mdi:home"`（{集合}:{名称}），`query` 为关键词搜索；返回内联 SVG 字符串 → 填 `svg` 节点（颜色可用 `$token名`）

## 5. 易错点（DO NOT）

| ❌ 错误                                | ✅ 正确                                             | 说明                                                                |
|----------------------------------------|-----------------------------------------------------|---------------------------------------------------------------------|
| `textColor:"#FFF"`                     | `fill:"#FFFFFF"`                                    | 颜色统一用 fill                                                     |
| `backgroundColor:"#FFF"`               | `fill:"#FFFFFF"`                                    | 背景就是 group/rect 的 fill                                         |
| `borderRadius:8`                       | `cornerRadius:8`                                    | 圆角字段名                                                          |
| `fontWeight:"bold"`                    | `fontWeight:"700"`                                  | 用数字                                                              |
| `alignItems:"center"`                  | `primaryAxisAlignItems:"CENTER"`                    | 布局组内对齐用大写枚举                                              |
| 手写节点 `id`                          | 省略，系统自动生成                                  | insert 的 node 不要带 id                                            |
| update 改 `id/type/children`           | 报错并自纠                                          | 这些字段不可 patch，改则整个 update 操作失败                        |
| 数值字段传字符串（如 `width:"500"`）   | 传数字 `width:500`                                  | width/height 是数字（布局组内才可用 fill_container / hug_contents） |
| text 不设 fill                         | 必须设 fill                                         | 文字默认透明不可见                                                  |
| 内联 `<svg>...</svg>` 字符串做图标 | 用 icon_svg 工具 / svg 节点内联 SVG，颜色写 `$token名` | svg 节点支持内联 SVG，`$token` 落盘时自动替换为调色板实色 |
| 自己画一个近似 logo / 品牌图标 | 用 website_logo 取真实 logo、icon_svg 取真实图标 SVG | 真实素材优先，禁止凭空画品牌 logo |
| `path` 描边图标不设 `fill:"none"`      | 描边图标设 `fill:"none"` + stroke                   | 否则内部被填成色块                                                  |
| `line` 颜色写在 `fill`                 | 写在 `stroke`                                       | 折线 / 分隔线的颜色字段是 stroke                                    |
| 三张等宽卡片平铺                       | 用之字 / 不对称                                     | 见 style-guide                                                      |
| 背景 rect 与文字 text 分开手算绝对坐标 | 先建 group 收拢背景+文字，用 layout 排布            | 区域内 ≥2 元素必须分组（见 1.5）                                    |
| 给 layout 组内的子节点手动写 x/y       | 不写 x/y，交引擎 AUTO 排布                          | 子节点位置由布局引擎决定，手写会错位                                |

## 6. 示例：一张音乐海报（单批构建）

```jsonc
[
  { "op": "insert", "as": "bg", "parent": "root", "node": { "type": "rect", "name": "背景", "width": 1080, "height": 1440, "fill": { "type": "linear", "from": "top-left", "to": "bottom-right", "stops": ["#1a1a2e", "#16213e"] } } },
  { "op": "insert", "as": "vinyl", "parent": "root", "node": { "type": "group", "name": "黑胶主视觉", "x": 640, "y": 200, "width": 360, "height": 360 } },
  { "op": "insert", "parent": "@vinyl", "node": { "type": "ellipse", "name": "唱片盘", "width": 360, "height": 360, "fill": "#0f0f1a", "stroke": "#E63946", "strokeWidth": 4, "effects": [{ "type": "drop-shadow", "x": 0, "y": 24, "radius": 40, "color": "rgba(0,0,0,0.5)" }] } },
  { "op": "insert", "parent": "@vinyl", "node": { "type": "ellipse", "name": "唱片中心", "x": 150, "y": 150, "width": 60, "height": 60, "fill": "#E63946" } },
  { "op": "insert", "as": "title", "parent": "root", "node": { "type": "text", "name": "专辑标题", "x": 80, "y": 700, "text": "MIDNIGHT", "fontSize": 120, "fontWeight": 900, "fontFamily": "Outfit", "letterSpacing": -2, "fill": "#F1FAEE", "textCase": "upper" } },
  { "op": "insert", "parent": "root", "node": { "type": "text", "name": "副标题", "x": 82, "y": 860, "text": "Vol. 3 · 午夜现场录音", "fontSize": 28, "fill": "#A8DADC" } }
]
```

> 提示：先 `canvas_guidelines("composition")` 与 `canvas_guidelines("typography")` 拿构图 / 字体要点，再写 batch_edit。

## 7. 示例：一张知识卡片（区域分组）

```jsonc
[
  { "op": "insert", "as": "card", "parent": "root", "node": {
    "type": "group", "name": "卡片", "x": 40, "y": 60, "width": 520, "layout": "vertical", "gap": 16,
    "padding": 28, "fill": "$中性色", "cornerRadius": 24,
    "effects": [{ "type": "drop-shadow", "x": 0, "y": 12, "radius": 32, "color": "rgba(0,0,0,0.18)" }]
  }},
  { "op": "insert", "as": "badge", "parent": "@card", "node": {
    "type": "group", "name": "分类标签", "layout": "horizontal", "gap": 6,
    "padding": [4, 12], "primaryAxisAlignItems": "CENTER", "counterAxisAlignItems": "CENTER",
    "fill": "$强调色", "cornerRadius": 14,
    "children": [{ "type": "text", "name": "标签文字", "text": "AI 思考", "fontSize": 16, "fill": "#FFFFFF" }]
  }},
  { "op": "insert", "parent": "@card", "node": { "type": "text", "name": "标题", "text": "提示词工程的三个层次", "fontSize": 34, "fontWeight": 700, "fill": "$主色" } },
  { "op": "insert", "parent": "@card", "node": { "type": "text", "name": "正文", "text": "先定目标，再拆区域，后填内容——用分组让引擎替你对齐。", "fontSize": 22, "lineHeight": 1.6, "fill": "$中性色", "width": 460 } }
]
```

> 观察点：卡片是顶层 group（显式宽 520，vertical 堆叠）；标签是嵌套 group（背景 + 文字内联 children，双向居中）；
> 标题 / 正文是原子元素子节点，不带 x/y，全部由布局引擎排布；正文多行给了显式宽度。
