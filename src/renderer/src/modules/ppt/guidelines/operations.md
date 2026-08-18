# 批量操作（operations）—— ppt_batch_edit 语法速查

> `ppt_batch_edit` 是 PPT 的核心编辑工具：对指定页（slideId **1 起始**）的元素做**批量操作**，
> 每批 ≤ 15 个，按节点 id 精准增删改查，**不是整页覆盖**。单个操作非法只让该操作失败并返回错误
> （`results` 内联），其余照常执行。先 `ppt_get_nodes` 看元素树拿 id，再编辑。

## 1. 操作语法（5 种 op）

| op       | 作用                     | 关键参数                                                                     |
|----------|--------------------------|------------------------------------------------------------------------------|
| `insert` | 插入元素到页根或容器子元素 | `parent`: "root" / 容器节点 id / "@绑定名"；`node`: SlideNode；`as`: 绑定名 |
| `copy`   | 深拷贝节点（子树 id 重生成） | `id`, `parent`, `overrides?`: {attr?, text?}                                |
| `update` | 按节点 id 精准编辑       | `id`, `patch`: {attr?, text?, child?}                                       |
| `move`   | 移动 / 重排（可跨容器）   | `id`, `parent?`, `index?`                                                    |
| `delete` | 删除节点（含子树）       | `id`                                                                         |

**绑定名（as）**：同批内 `insert` / `copy` **必须**带 `as` 才能被后续 op 用 `parent: "@绑定名"` 引用；
绑定名**仅本批有效**（跨批无效——下一批评 `@root` 会失败，切勿改塞 `parent:"root"`）。
**update / move / delete / copy 的 `id` 也支持 `"@绑定名"`**。

**父位置（parent）**：`"root"` = 页根数组；容器节点 id = 该容器的 `child` 数组；`"@绑定名"` = 绑定节点。
父必须是**容器**（VStack / HStack / Layer / Ul / Table 等 `child` 为数组的节点），不能是文本节点。

**update 的 patch**（update / copy.overrides 共用）：
- `attr`：合并 / 覆盖属性（点表示法键，如 `"fontSize"`、`"border.color"`）；`id` 禁止修改（忽略并提示）
- `text`：覆盖文本（**仅** Text / Shape 等 `child` 为字符串的节点）
- `child`：替换子元素数组（自动补 id）

### 单根满高铁律（防越界）

画布固定 **1280×720**，页根按隐式纵向 flex 排布：

1. **每页只允许一个满高根容器**（`VStack`/`HStack` + `h:"100%"` 或 `h:"max"`，通常再加 `w:"100%"`/`w:"max"`）。
2. 先 `insert` 根容器并 **`as:"root"`**，正文 / 装饰全部 `parent:"@root"`（或该容器真实 id）；**禁止**再向 `parent:"root"` 插第二个满高容器或裸 Text/Shape。
3. 大装饰圆 / 色块若不想占文档流，必须 `position:"absolute"` + `top`/`left`；否则会把标题顶出画布。
4. 运行时会拦截「页已有满高根仍向 root 插入」，并在 `potentialIssues` 提示多根 / 根外兄弟节点。

## 2. 示例：单批构建一页（封面）

```jsonc
[
  { "op": "insert", "as": "root", "parent": "root", "node": {
    "tag": "VStack", "attr": { "w": "100%", "h": "100%", "padding": 48, "gap": 24, "backgroundColor": "$surface", "justifyContent": "center", "alignItems": "center" }, "child": []
  }},
  { "op": "insert", "parent": "@root", "node": {
    "tag": "Shape", "attr": { "shapeType": "ellipse", "w": 280, "h": 280, "backgroundColor": "$accent", "opacity": 0.15, "position": "absolute", "top": 40, "right": 40 }
  }},
  { "op": "insert", "parent": "@root", "node": { "tag": "Text", "attr": { "fontSize": 40, "bold": true, "color": "$textMain" }, "child": "产品发布会" } },
  { "op": "insert", "parent": "@root", "node": { "tag": "Text", "attr": { "fontSize": 16, "color": "$textMuted" }, "child": "2026 年度战略与新品亮相" } }
]
```

> 提示：先读 `ppt_guidelines("layout")` 与 `("styling")` 拿布局 / 配色要点，再写批量操作；
> 构建顺序建议 背景根容器 → 绝对定位装饰 → 文字。跨批续写前先 `ppt_get_nodes` 拿根容器 id，用 `parent:"<id>"`，不要再 `parent:"root"`。

## 3. insert 的 node：严格契约（校验会拒收）

`insert.node` / `update.patch.child` / `copy.overrides.child` 的每个 SlideNode 都走 **TypeBox 严格校验**
（`additionalProperties: false`，按 `tag` 判别）。字段名优先与 schema / `ppt_guidelines("nodes")` 一致；
常见 CSS/React 别名会在校验前自动转成规范键。非法时错误会定位到具体字段，按提示改后重试。

| 规则 | 说明 |
|------|------|
| 结构 | 仅 `{ tag, attr?, child?, id? }`；`tag` 必填且为大写 Literal（`Text` / `VStack` / `Shape` …） |
| attr 键名 | **优先用文档键**；常见 CSS 别名会在校验前自动转换（见下表） |
| 点表示法 | 对象属性用扁平点键：`margin.top` / `padding.left` / `border.color`；也可用 `marginTop` 等别名（自动转） |
| 文本加粗 | 优先 `bold`；写 `fontWeight: 700` 也会自动变成 `bold: true` |
| Shape | `attr.shapeType` **必填**（如 `rect` / `roundRect` / `ellipse`）；线宽装饰常用矮 `Shape` 而不是 `Line` |
| child | Text / Shape / Li / Td → **字符串**；VStack / HStack / Layer / Ul … → **子节点数组**；不要混用 |
| id | insert 时省略（系统生成）；不要手写撞名 |

**自动转换的别名**（写入前规范化，落盘为规范键）：

| 模型常写 | 规范键 / 行为 |
|----------|----------------|
| `fontWeight` / `font-weight` | → `bold`（≥600 为 true） |
| `marginTop` / `paddingBottom` 等驼峰 | → `margin.top` / `padding.bottom` |
| `gap: "16"`、`fontSize: "28"` 等数字字符串 | → number |

仍请优先写规范键；未知键（非上表别名）依旧报「未定义的字段」。

合法示例（封面标题组片段，挂在已有根容器下）：

```jsonc
{
  "tag": "Text",
  "attr": { "fontSize": 64, "bold": true, "color": "$accent", "margin.top": 24 },
  "child": "标题"
}
```

完整字段清单见 `ppt_guidelines("nodes")`，不要凭 CSS 习惯发明属性名。

## 4. 易错点（DO NOT）

| ❌ 错误                                   | ✅ 正确                         | 说明                                                       |
|-------------------------------------------|--------------------------------|------------------------------------------------------------|
| 整页覆盖 elements 数组                     | 元素级批量操作                 | 用 update 改现有节点、insert / delete 增删，不要整页重建    |
| 多个 `h:100%` 根 VStack / 根外裸 Text      | 唯一满高根 + 子节点进容器      | 多根纵向叠放 → 超出 720 画布被裁切                         |
| 忘了 `as:"root"` 仍写 `parent:"@root"`    | 同批先 as 再 @；跨批用真实 id  | 绑定仅本批有效；失败后勿改塞 parent:"root"                 |
| 大装饰 Shape 不设 absolute                 | `position:"absolute"`+坐标     | 否则占文档流把标题顶出画布                                 |
| insert 的 node 手写 id                     | 省略 id，系统自动生成          | 顶层 id 由系统补，手写可能撞名                              |
| update 改 id                              | 只改样式 / 文本 / 子元素        | id 由系统管理，改则忽略并提示                              |
| 页面根元素不是 VStack / HStack            | 根用布局容器                   | 页面根必须 flexbox 布局，禁止散落裸 Text / Shape            |
| 文本节点用 `child` 数组更新               | 用 `patch.text`                | text 只适用于 child 为字符串的节点                         |
| `parent` 指向文本节点                     | 指向容器节点                   | 文本节点无法插入子元素                                     |
| 未知 attr 键（非别名表）                  | 用 nodes 指南中的键            | `fontWeight` / `marginTop` 等会自动转；其余仍报未定义 |
| Shape 省略 `shapeType`                    | 必填 `shapeType`               | 缺省直接校验失败                                           |
| 数值字段传字符串（如 `"gap": "16"`）      | 传数字 `gap: 16`               | attr 值允许 number / boolean，落盘自动转字符串              |
| 颜色写死裸色值                            | 用 `$token` 引用 theme         | 全篇和谐、可整体换肤                                       |
| 每批超过 15 个操作                        | 分批处理                       | 元素过多 AI 生成的 JSON 容易出错                           |
