# 批量编辑与节点速查（operations）

> `canvas_batch_edit` 是设计画布的核心工具。每批 ≤ 25 个操作，参数经**严格校验**：
> 单个操作非法（字段名错误 / 类型不匹配 / 取值越界）只让**该操作**失败并返回错误，其余操作照常执行。
> 本文是画布模型的完整参考：节点 schema、操作语法、易错点、示例。

## 1. 图层模型

- 画布是一棵**图层树**：`doc.nodes` 为根图层，`children` 顺序即 z 序（后画者在上）。
- **自由定位为主**：节点用 x/y 绝对坐标摆放；只有 group 需要整齐排布时才开启 `layout`。
- 所有节点**必须赋有意义的 `name`**（图层名），便于后续引用与辨识。
- **调色板**：先 `canvas_set_palette` 定义 3-5 个颜色 token，fill/stroke 用 `$token名` 引用。

## 2. 节点类型

| type | 说明 | 必带字段 |
|---|---|---|
| `group` | 容器图层：组织子节点；可设背景 fill / 圆角 / 阴影；可选 layout | name；尺寸通常 hug_contents 或显式 |
| `text` | 文本 | text、fontSize、fill（必须设置，否则不可见） |
| `rect` | 矩形（海报主视觉 / 色块 / 卡片） | width、height |
| `ellipse` | 椭圆 / 圆 | width、height |
| `line` | 折线（分隔线 / 装饰线） | points（相对 x/y 的扁平坐标） |
| `polygon` | 正多边形 | width、height、sides |
| `star` | 星形 | width、height、corners |
| `path` | SVG 路径 | path |
| `image` | 图片 | imageUrl（file:// / http(s)）；建议显式 width/height |
| `svg` | 内联 SVG / 图标 | svg 字符串（或 imageUrl） |

> **图标 / 简单图形铁律**：优先用**原生节点组合**（`rect` / `ellipse` / `path` / `line` / `star` / `polygon`）画图标，
> 颜色用 `fill` + `$token名`（如书签 = rect + line，星标 = star）。内联 `svg` 字符串（`svg` 字段）只作**复杂图标兜底**：
> 其内部颜色**无法引用调色板 token**，且按图片异步加载，**导出 PNG 时可能缺失**——不要用内联 svg 做图标。
> `path` 画描边图标时设 `fill: "none"` + `stroke` + `strokeWidth`；`line` 的颜色写在 `stroke`（不是 fill）。

## 3. 常用属性速查

| 用途 | 字段 | 说明 |
|---|---|---|
| 颜色（文字 / 形状 / 背景） | `fill` | 统一用 fill：#RRGGBB / rgba() / 颜色名 / `$token名` / 渐变对象 |
| 描边 | `stroke` + `strokeWidth` | 结构同 fill |
| 圆角 | `cornerRadius` | **不是 borderRadius** |
| 字重 | `fontWeight` | 数字 400 / 700，或字符串 "400"~"900" |
| 字体 | `fontFamily` | 指定家族；中文建议思源 / 霞鹜等 |
| 字间距 / 行高 | `letterSpacing` / `lineHeight` | lineHeight 可数值或 "AUTO" |
| 大小写 | `textCase` | none / upper / lower |
| 阴影 / 模糊 | `effects` | 数组：[{type:"drop-shadow",x,y,radius,color}, {type:"layer-blur",radius}] |
| 混合模式 | `blendMode` | normal / multiply / screen / overlay 等 |
| 描边字 | `stroke` + `strokeWidth` | text 节点也能描边，做标题字轮廓 |

渐变对象（fill / stroke 通用）：
```json
{"type":"linear","from":"top-left","to":"bottom-right","stops":["#667eea","#764ba2"]}
```
type 支持 linear（线性）/ radial（径向光晕）/ angular（角度色环）；stops 可为纯色字符串（自动均分）或 `{"offset":0,"color":"#fff"}`。

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

| op | 作用 | 关键参数 |
|---|---|---|
| `insert` | 插入节点到父节点 | `parent`: "root" / group id / "@绑定名"；`node`: 节点数据；`as`: 绑定名 |
| `copy` | 深拷贝节点（id 重新生成） | `id`, `parent`, `overrides`（覆盖根节点自身属性） |
| `update` | 更新节点属性 | `path`: "id" 或 "父id;子id" 或 "@绑定;子id"；`patch` |
| `move` | 移动 / 重排 | `id`, `parent?`, `index?` |
| `delete` | 删除节点（含子树） | `id` |
| `image` | 生成图片 | `id`, `kind`: placeholder / stock / ai, `prompt` |

**绑定名（as）**：同一批内 `insert` / `copy` 可带 `as`，后续 op 用 `parent: "@绑定名"` 引用刚创建的节点，用于一批内搭出层级。绑定名仅本批有效。

**path 用 `;` 分隔**：更新嵌套子节点用 `"父id;子id"`，可多层：`"cardId;titleId"`。

**image 操作**：
- `placeholder`：给节点铺灰色渐变 + 居中短标签（prompt 用 ≤20 字，如 "封面图"）
- `stock`：picsum 网络占位图（prompt 为种子词，稳定可复用），自动下载到沙盒
- `ai`：暂按 stock 兜底（无生图服务时不要依赖）

## 5. 易错点（DO NOT）

| ❌ 错误 | ✅ 正确 | 说明 |
|---|---|---|
| `textColor:"#FFF"` | `fill:"#FFFFFF"` | 颜色统一用 fill |
| `backgroundColor:"#FFF"` | `fill:"#FFFFFF"` | 背景就是 group/rect 的 fill |
| `borderRadius:8` | `cornerRadius:8` | 圆角字段名 |
| `fontWeight:"bold"` | `fontWeight:"700"` | 用数字 |
| `alignItems:"center"` | `primaryAxisAlignItems:"CENTER"` | 布局组内对齐用大写枚举 |
| 手写节点 `id` | 省略，系统自动生成 | insert 的 node 不要带 id |
| update 改 `id/type/children` | 报错并自纠 | 这些字段不可 patch，改则整个 update 操作失败 |
| 数值字段传字符串（如 `width:"500"`） | 传数字 `width:500` | width/height 是数字（布局组内才可用 fill_container / hug_contents） |
| text 不设 fill | 必须设 fill | 文字默认透明不可见 |
| 内联 `<svg>...</svg>` 字符串做图标 | 用 rect / ellipse / path / line / star 原生节点组合 | 内联 svg 颜色无法用 $token，导出 PNG 可能缺失 |
| `path` 描边图标不设 `fill:"none"` | 描边图标设 `fill:"none"` + stroke | 否则内部被填成色块 |
| `line` 颜色写在 `fill` | 写在 `stroke` | 折线 / 分隔线的颜色字段是 stroke |
| 三张等宽卡片平铺 | 用之字 / 不对称 | 见 style-guide |

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
