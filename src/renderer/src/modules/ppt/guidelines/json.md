# SlideNode JSON 结构与导出速查（PPT 专家专用）

> 快速参考；深度经验见 layout（布局）/ nodes（节点）/ styling（样式）三份指南。

## 1. 存储结构（{name}.ppt.json，全程 JSON）

```json
{
  "name": "产品发布会",
  "createdAt": 1755058092000,
  "updatedAt": 1755058092000,
  "theme": { "surface": "0F172A", "accent": "38BDF8", "textMain": "F8FAFC", "textMuted": "94A3B8" },
  "slide": [
    [
      { "tag": "VStack", "attr": { "w": "100%", "h": "100%", "padding": "48", "gap": "16" }, "child": [
        { "tag": "Text", "attr": { "fontSize": "40", "color": "$textMain", "bold": "true" }, "child": "标题" }
      ] }
    ]
  ]
}
```

- 根字段：`name`（文件名标识）/ `createdAt` / `updatedAt`（毫秒时间戳）/ `theme`（全局色板）/ `slide`（页面数组）。
- `slide` 每项是一页的**根节点数组**（导出时包进 `<Slide>`；多个根节点自动按 VStack 布局）。

## 2. SlideNode 通用结构

```json
{ "tag": "VStack", "attr": { "gap": "16" }, "child": [ "子元素数组或文本字符串" ] }
```

- `tag` 即 XML 标签名（区分大小写）：Text / VStack / HStack / Icon / Shape / Image / Ul / Ol / Layer /
  Line / Arrow / Table / Chart / Timeline / Flow / Tree / Matrix / Pyramid / ProcessArrow / Svg。
- `attr` 为属性对象：**值统一为字符串**（数字 / 布尔也写字符串，如 `"fontSize": "28"`、`"bold": "true"`）。
- **顶层 `id` = 节点唯一标识**（`{ id, tag, attr, child }`，与 tag 并列）：写入时自动生成（`n-` + nanoid），无需 AI 手动指定；
  用户点选节点后 AI 用它做**精准编辑**（见 §7 update 操作）。所有节点（含 Li/Td/TimelineItem 等子元素）都有 id；
  id 不进 attr、不参与 POM 布局。
- 对象型属性用**点表示法**扁平展开：`border.color`、`border.width`、`shadow.blur`、`padding.top`、
  `fill.color`、`glow.size` 等（与 POM XML 点表示法属性一一对应）。
- `child`：文本节点（Text / Shape / Li / Td）写**字符串**；容器节点写**子元素数组**；无子元素可省略（导出为自闭合标签）。
- 颜色属性用 `$token名` 引用 theme 令牌（未知令牌报错）。

## 3. 元素与 XML 的对应（导出时由主进程转换，AI 无需关心 XML）

| SlideNode                                    | 转换后的 XML                              |
|----------------------------------------------|-------------------------------------------|
| `{ tag: 'Text', attr: { fontSize: '28' }, child: 'Title' }` | `<Text fontSize="28">Title</Text>` |
| `{ tag: 'VStack', attr: { w: '100%' }, child: [...] }`       | `<VStack w="100%">...</VStack>` |
| `{ tag: 'TimelineItem', attr: { date: 'Q1', title: 'Phase 1' } }` | `<TimelineItem date="Q1" title="Phase 1" />` |

- 复杂节点结构（子元素形式）：Table → `Tr`/`Td`（Td 文本写 child）、Ul/Ol → `Li`（文本写 child）、
  Timeline → `TimelineItem`、Flow → `FlowNode`/`FlowConnection`、Tree → `TreeItem`（递归）、
  Matrix → `MatrixAxes`/`MatrixQuadrants`/`MatrixItem`、Pyramid → `PyramidLevel`、
  ProcessArrow → `ProcessArrowStep`。
- Chart 的 `data` / `chartColors` 是 **JSON 字符串** 属性（如 `"data": "[{\"name\":\"Q1\",\"labels\":[\"1月\"],\"values\":[30]}]"`）。

## 4. Theme 色板

- token 名以字母开头，可含字母 / 数字 / _ / -；值 6 位 hex（如 `"surface": "0F172A"`）。
- 颜色属性（backgroundColor / color / 边框色 / 阴影色等）用 `$token` 引用；**换主题只改 theme 一处**。

## 5. 设计铁律

- **画布 16:9（1280×720）**：根容器 `attr.w="100%" attr.h="100%"`。
- **字号分级**：标题 28-40 / 小标题 18-24 / 正文 13-16 / 注释 10-12；行距默认 1.3。
- **留白**：页面 padding ≥ 40，元素 gap ≥ 16。
- **对齐**：根元素 VStack/HStack 布局，杜绝散落裸 Text/Shape。
- **配色**：全篇 ≤ 5 色 + 灰阶，用 theme 统一声明。
- **图片**：仅 base64 data URI 或沙盒本地路径；禁止 http(s)。

## 6. 编辑规范（ppt_batch_edit 批量操作）

- `ppt_batch_edit(pptId, slideId, operations)`：对指定页做**元素级批量操作**（insert / copy / update / move /
  delete，≤15 个/批），按节点 id 精准增删改查，**非整页覆盖**；单操作非法只让该操作失败（`results` 内联错误），
  其余照常执行。语法速查与示例见 `ppt_guidelines("operations")`。
- **页码从 1 开始**；slideId 越界报错。
- 页面根元素必须是 VStack / HStack 布局容器。
- 编辑 **原地写回**当前文件（不产生新版本）；侧边栏实时渲染预览。

## 7. 精准编辑单个节点（batch_edit 的 update 操作）

- 用户可在预览中**点选节点**并引用（输入框出现 `PPT(文件名)节点(文本)` 标签）；引用消息会附
  pptId / slideId / nodeId，AI 应**只改该节点**，不要整页重建。
- `update` 操作：`{ op: "update", id: nodeId, patch: { attr?, text?, child? } }`——按节点 id 精准编辑：
  - `attr`：合并 / 覆盖属性（点表示法键，如 `"fontSize"`、`"border.color"`）
  - `text`：覆盖文本（仅 Text / Shape 等 child 为字符串的节点）
  - `child`：替换子元素数组
- nodeId 来源：用户引用消息 / `ppt_get_nodes` 返回的元素树（每个节点的顶层 `id`）/ `ppt_batch_edit` 返回的 `nodes`。
- 找不到 nodeId 说明该节点已被删除 / 移动（旧 id 失效）→ 先 `ppt_get_nodes` 重读再编辑。
- **只改引用节点**：修改单个 Text / Shape 的文案或样式用 update，改动大才用 insert / delete 结构性调整。
