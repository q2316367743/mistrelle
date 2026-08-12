# POM XML 语法速查（PPT 专家专用）

> 快速参考；深度经验见 layout（布局）/ nodes（节点）/ styling（样式）三份指南。

## 1. 文档结构

- 顶层：`<Theme>`（全局色板，最多一个）+ 多个 `<Slide>`（每页一个）。
- `<Slide>` 内单个子元素直接用，多个子元素自动被 VStack 包裹。
- 页面根元素 **必须是 VStack / HStack 布局容器**。

```xml

<Theme surface="0F172A" accent="38BDF8" textMain="F8FAFC"/>
<Slide>
<VStack w="100%" h="100%" padding="48" gap="24">
  <Text fontSize="40" bold="true" color="$textMain">标题</Text>
  <Text fontSize="16" color="94A3B8">副标题</Text>
</VStack>
</Slide>
```

## 2. Theme 色板

- 属性名即 token 名（ **以字母开头，可含字母 / 数字 / _ / -**），值 6 位 hex（# 可选）。
- 颜色属性用 `$token名` 引用；未知令牌报错（含 "did you mean" 建议）。
- ⚠️ 编辑写回会保留 `<Theme>` 声明（新提交元素的 `$token` 引用持续有效）；但**未被编辑的页**经解析写回时其 `$token` 会内联为实色（视觉等价）。

## 3. 布局（详见 layout）

- `VStack` 纵向 / `HStack` 横向（flexbox）；`gap` 子间距、`padding` 内边距、`margin` 外边距。
- `w/h`：像素 | `"max"`（主轴撑满）| `"50%"`（百分比）；`grow` 比例分配。
- `alignItems`（交叉轴 start/center/end/stretch）、`justifyContent`（主轴
  start/center/end/spaceBetween/spaceAround/spaceEvenly）、`alignSelf`。
- `position="absolute"` + `top/right/bottom/left` 绝对定位；`<Layer>` 绝对定位容器。

## 4. Text 文本（详见 nodes / styling）

- 属性：`text` / `fontSize`（默认 24）/ `bold` / `italic` / `underline` / `strike` / `color` / `fontFamily` / `lineHeight`
  （默认 1.3）/ `letterSpacing` / `textAlign` / `highlight` / `textGradient`。
- 内联装饰：`<B>` `<I>` `<U>` `<S>` `<Sub>` `<Sup>` `<A href>` `<Mark color>` `<Span color/fontSize>`。

## 5. 其他常用节点（完整见 nodes）

- `<Icon name="rocket" size="48" color="38BDF8" />`（lucide 内置库）
- `<Shape shapeType="roundRect" w="160" h="48" backgroundColor="38BDF8" borderRadius="8" />`
- `<Image src="base64 data URI 或本地绝对路径" />`（ **禁止 http**）
- `<Table>`：`rows` 数组 `{ cells: [{ text, bold, backgroundColor, colspan, rowspan }] }`
- `<Chart chartType="bar" title="月度销售">`：`data` 数组 `{ name, labels, values }`
- `<Ul>/<Ol>`：`items` 数组（Li 项）；`<Timeline>/<Flow>/<Tree>/<Matrix>/<Pyramid>/<ProcessArrow>` 见图示类节点

## 6. 设计铁律

- **画布 16:9（1280×720）**：根容器 `w="100%" h="100%"`。
- **字号分级**：标题 28-40 / 小标题 18-24 / 正文 13-16 / 注释 10-12；行距默认 1.3。
- **留白**：页面 padding ≥ 40，元素 gap ≥ 16。
- **对齐**：根元素 VStack/HStack 布局，杜绝散落裸 Text/Shape。
- **配色**：全篇 ≤ 5 色 + 灰阶，用 `<Theme>` 统一声明。
- **图片**：仅 base64 data URI 或沙盒本地路径；禁止 http (s)。
- **一页一主题**，文字精炼，多用图标 / 图表 / 表格表达。

## 7. 编辑规范（ppt_add_slide / ppt_batch_edit）

- 元素数组为 **JSON 节点**（`type` + 属性 + `children` 递归），与 POM 规范一致，经 TypeBox 严格校验（非法整批拒绝，错误文本原样返回）。
- **页码从 1 开始**；`slideId` 越界报错。
- 页面根元素必须是 VStack / HStack 布局容器（1 个根元素直接用，多个自动包 VStack）。
- 编辑 **原地写回**当前文件（不产生新版本）；侧边栏实时渲染预览。
