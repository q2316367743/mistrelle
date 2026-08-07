# 04 画布元素树（设计侧边栏全屏 · 元素树 ↔ 画布双向选中）

> 设计侧边栏全屏时，左侧展示 leaferjs 全部元素树（图层树），右侧为画布；
> 左侧选中元素 → 画布同步选中；右侧点击元素 → 左侧树同步激活，双向联动。

## 实现思路

侧边栏全屏（`LChatEngine` 的 `fullscreen`）状态逐层透传到 `DesignAside`：
`LChatEngine` → `LChatAside` → `DesignAside`。全屏时 `DesignAside` 由单画布布局切换为
「左侧元素树 + 右侧画布」双栏布局，画布组件复用不销毁。

**选中联动数据源**：`DesignAside` 持有 `selectedId`（ref<string | undefined>），
作为唯一状态源，分别以 prop / emit 与元素树、画布组件双向同步：

```
元素树(CanvasElementTree) ──@select──► DesignAside.selectedId ──:selected-id──► 画布(CanvasRenderer)
     ▲                                                                                │
     └────────────── :selected-id（watch 同步激活态）◄──────────────── @select ◄───────┘
```

**画布侧（CanvasRenderer）**：元素渲染时已带 `id`（`canvasRender.ts buildCommon`），
与 `CanvasNode.id` 同源，作为两个视图的关联键：
- 树 → 画布：watch `selectedId` → `app.tree.findId(id)` 找到渲染元素 → `app.editor.select(el)`；
  id 为空 / 失效时 `app.editor.cancel()`
- 画布 → 树：监听 `app.editor` 的 `EditorEvent.SELECT` → 提取 `event.value` 的 `id` → emit `select`

**无死循环**：leafer editor 的 `target` 装饰器在 `old !== value` 时才触发回调
（`editor.esm.js targetAttr`），且 Vue ref 赋相同值不触发 watch，程序化选中与用户点击天然收敛。

**自动清选中**：画布重建（切换画布 / AI 增删节点）时 `render()` 内 `app.editor.cancel()`
会触发 `EditorEvent.SELECT`（value 为空）→ 树激活态自动清空。

## 关键文件

| 文件                                                      | 职责                                                                      |
|-----------------------------------------------------------|---------------------------------------------------------------------------|
| `src/components/chat/LChatEngine.vue`                     | 传递 `:fullscreen` 到 `l-chat-aside`                                       |
| `src/components/chat/aside/LChatAside.vue`                | 新增 `fullscreen` prop，透传到 `design-aside`                              |
| `src/components/chat/aside/design/DesignAside.vue`        | 全屏双栏布局；持有 `selectedId` 作为双向联动唯一状态源                     |
| `src/components/chat/aside/design/CanvasElementTree.vue`  | 原生元素树：分组节点可选中、展开/折叠、类型图标、`@select` 上抛            |
| `src/components/chat/aside/design/CanvasRenderer.vue`     | `selectedId` prop（findId → select/cancel）+ `@select` emit（EditorEvent.SELECT） |

> 元素树为**原生实现**（非 tdesign Tree）：分组（group）节点是设计语义里的可选图层，
> 必须可选中；原生树把「点击节点 → 选中」与「点击箭头 → 展开/折叠」分离，避免
> tdesign Tree 分组节点仅展开不可选中的限制。

## 数据结构 / API 契约

### CanvasElementTree props / emit

```ts
props: { nodes: CanvasNode[]; selectedId?: string }
emit:  (e: 'select', id: string | undefined): void
```

- 可见节点由 `nodes` 按展开态扁平化计算（`visibleNodes`），每个节点含 `depth` 用于缩进
- 分组节点默认展开（`collectGroupIds` 收集 group id 加入 `expandedIds`；AI 新增分组自动展开，
  用户手动折叠不复活）
- 点击节点 → `emit('select', id)`；点击箭头（`@click.stop`）→ 仅展开/折叠
- 高亮：`node.id === selectedId` 时 `is-active`（`--td-brand-color-light` 底 + `--td-brand-color` 文字）
- 图标映射：`group → LayersIcon`、`text → TextIcon`、`rect → RectangleIcon`、
  `image / svg → ImageIcon`，其余节点类型回退 `RectangleIcon`

### CanvasRenderer props / emit

```ts
props: { sandbox?: string; selectedId?: string }
emit:  (e: 'select', id: string | undefined): void
```

## Leafer 选中 API（2.2.9）

| API                                  | 用途                                        |
|--------------------------------------|---------------------------------------------|
| `app.editor.select(element)`         | 选中元素（设置 `editor.target`，触发 SELECT）|
| `app.editor.cancel()`                | 取消选中（触发 SELECT，value 为空）          |
| `app.editor.on(EditorEvent.SELECT)`  | 选中变化事件，`event.value` 为 `IUI \| IUI[]`，多选取首个 |
| `app.tree.findId(id)`                | 按节点 id 查渲染元素                        |

## 注意事项

- 元素树与画布以「节点 id」关联；所有渲染元素经 `buildCommon` 注入 `id`，与画布数据同源。
- 画布重建会清空选中（`cancel()` 自动触发），无需手动清理。
- 全屏开关不影响画布组件生命周期；非全屏时树组件卸载，`selectedId` 保留，再次全屏恢复联动。
- 空画布 / 无节点时树显示「暂无元素」。
