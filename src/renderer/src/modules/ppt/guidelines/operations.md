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

**绑定名（as）**：同批内 `insert` / `copy` 可带 `as`，后续 op 用 `parent: "@绑定名"` 引用刚创建的节点，
用于一批内搭出层级；绑定名**仅本批有效**。**update / move / delete / copy 的 `id` 也支持 `"@绑定名"`**
（引用同批刚创建的节点，无需等返回的 id）。

**父位置（parent）**：`"root"` = 页根数组；容器节点 id = 该容器的 `child` 数组；`"@绑定名"` = 绑定节点。
父必须是**容器**（VStack / HStack / Layer / Ul / Table 等 `child` 为数组的节点），不能是文本节点。

**update 的 patch**（update / copy.overrides 共用）：
- `attr`：合并 / 覆盖属性（点表示法键，如 `"fontSize"`、`"border.color"`）；`id` 禁止修改（忽略并提示）
- `text`：覆盖文本（**仅** Text / Shape 等 `child` 为字符串的节点）
- `child`：替换子元素数组（自动补 id）

## 2. 示例：单批构建一页（封面）

```jsonc
[
  { "op": "insert", "as": "root", "parent": "root", "node": {
    "tag": "VStack", "attr": { "w": "100%", "h": "100%", "padding": "48", "gap": "24", "backgroundColor": "$surface" }, "child": []
  }},
  { "op": "insert", "parent": "@root", "node": { "tag": "Text", "attr": { "fontSize": "40", "bold": "true", "color": "$textMain" }, "child": "产品发布会" } },
  { "op": "insert", "parent": "@root", "node": { "tag": "Text", "attr": { "fontSize": "16", "color": "$textMuted" }, "child": "2026 年度战略与新品亮相" } },
  { "op": "update", "id": "<上面某个 Text 的 id>", "patch": { "attr": { "color": "$accent" } } }
]
```

> 提示：先读 `ppt_guidelines("layout")` 与 `("styling")` 拿布局 / 配色要点，再写批量操作；
> 构建顺序建议 背景 → 主视觉 → 装饰 → 文字。

## 3. 易错点（DO NOT）

| ❌ 错误                                   | ✅ 正确                         | 说明                                                       |
|-------------------------------------------|--------------------------------|------------------------------------------------------------|
| 整页覆盖 elements 数组                     | 元素级批量操作                 | 用 update 改现有节点、insert / delete 增删，不要整页重建    |
| insert 的 node 手写 id                     | 省略 id，系统自动生成          | 顶层 id 由系统补，手写可能撞名                              |
| update 改 id                              | 只改样式 / 文本 / 子元素        | id 由系统管理，改则忽略并提示                              |
| 页面根元素不是 VStack / HStack            | 根用布局容器                   | 页面根必须 flexbox 布局，禁止散落裸 Text / Shape            |
| 文本节点用 `child` 数组更新               | 用 `patch.text`                | text 只适用于 child 为字符串的节点                         |
| `parent` 指向文本节点                     | 指向容器节点                   | 文本节点无法插入子元素                                     |
| 数值字段传字符串（如 `"gap": "16"`）      | 传数字 `gap: 16`               | attr 值允许 number / boolean，落盘自动转字符串              |
| 颜色写死裸色值                            | 用 `$token` 引用 theme         | 全篇和谐、可整体换肤                                       |
| 每批超过 15 个操作                        | 分批处理                       | 元素过多 AI 生成的 JSON 容易出错                           |
