# 画布元素属性面板

> 全屏三栏布局（元素树 / 画布 / 属性面板）的第三栏：选中单个元素时展示并编辑其属性。
> 前置阅读：[04-canvas-element-tree.md](./04-canvas-element-tree.md)（selectedId 单选联动）、[02-canvas-node-model.md](./02-canvas-node-model.md)（节点模型与 batch_edit）。

## 实现思路

- **布局**：`DesignAside.vue` 的 `design-aside__body` 在 `fullscreen` 时挂载 `ElementPropertyPanel`（固定 290px，自带 `border-left` 分隔），与左侧元素树（220px）、中间画布（flex:1）构成三栏。仅全屏显示。
- **数据源**：面板按 `nodeId`（即 `selectedId`）从 `getCanvasStore(sandbox).current.value.nodes` 递归 `findNode` 取 deep reactive 节点对象 —— AI / 画布拖拽改动后面板展示自动同步，节点数据是唯一数据源。
- **草稿 + 显式保存**：编辑只改本地草稿 `draft`（`usePropertyDraft.ts`），面板头部「属性」右侧的「保存」按钮按 diff（草稿 vs 当前节点）激活；点击才经 `store.batchEdit([{ op: 'update', path: nodeId, patch }])` 写回 —— 与 AI `canvas_batch_edit` 同一条链路（TypeBox `nodePatchSchemaT` 白名单校验 + 落盘 + deep watch 触发画布重渲染 + 选中恢复）。失败时 `MessageUtil.error` 提示。
- **删除元素**（2026-09-21）：头部「保存」旁的 danger 图标按钮，`store.batchEdit([{ op: 'delete', id: nodeId }])`（同样走 AI 链路），成功后 `emit('deleted')` 由 DesignAside 清空 `selectedId`（画布取消选中 + 面板回落空态）。**2026-09-21 二次调整**：马赛克改为工具栏入口 + 抽屉弹窗（见 [07-canvas-mosaic.md](./07-canvas-mosaic.md)），面板恢复为 `design-aside__body` 的 flex row 直接子项，靠 stretch 拉满高度（无需 `:deep` 高度补丁）。
- **草稿同步**：切换选中节点（id 变化）强制重建草稿（未保存修改丢弃）；同节点被外部更新（AI 编辑）仅在没有未保存修改时跟随，有修改则保留用户草稿。数值输入清空 = 删除属性（diff 提交 undefined，`Object.assign` 后从节点移除）。
- **图片遮盖区块**（2026-09-22，`ImageMosaicFields.vue`）：image 节点专属，显示遮盖摘要（`马赛克 · 块边长 14px · 3 处` / `毛玻璃 · 模糊 8px · 1 处` / `未遮盖`）+
  「编辑」（打开马赛克弹窗并回填既有区域）+「复原」（`clearNodeMosaic` 删除节点 `mosaic` 字段）。**不走草稿机制**：与头部「删除元素」同为立即写回，
  避免与「保存」语义纠缠（遮盖是结构化记录，不适合字段级 diff 编辑）。详见 [07-canvas-mosaic.md](./07-canvas-mosaic.md)。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/renderer/src/windows/main/components/aside/design/ElementPropertyPanel.vue` | 面板主体：节点头部（类型徽标 + 图层名）、保存按钮、尺寸块、外观块、形状块 |
| `src/renderer/src/windows/main/components/aside/design/TextPropertyFields.vue` | text 专属字段块：内容 / 字体 / 字号 / 字重 / 行高 / 字间距 / 对齐 / 大小写 / 斜体（v-model 绑草稿） |
| `src/renderer/src/windows/main/components/aside/design/ImageMosaicFields.vue` | image 专属字段块：遮盖摘要 + 编辑（打开弹窗回填）+ 复原（删字段） |
| `src/renderer/src/windows/main/components/aside/design/usePropertyDraft.ts` | 草稿状态 composable：`PropertyDraft` 快照 / diff 计算（`dirty`）/ 显式保存（batchEdit 写回）/ 颜色字段代理 |
| `src/renderer/src/windows/main/components/aside/design/DesignAside.vue` | 三栏挂载：`v-if="fullscreen"` + `:node-id="selectedId"` |

## 字段矩阵（按类型生效）

| 类型 | w/h/opacity | fill | stroke/strokeWidth | cornerRadius | 形状参数 | 文本字段 | 遮盖 |
|------|-------------|------|--------------------|--------------|----------|----------|------|
| group | ✓（尺寸） | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| rect | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| ellipse / path | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| line | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| polygon | ✓ | ✓ | ✓ | ✗ | sides / startAngle | ✗ | ✗ |
| star | ✓ | ✓ | ✓ | ✗ | corners / innerRadius / startAngle | ✗ | ✗ |
| text | ✓ | ✓（文字色） | ✓ | ✗ | ✗ | ✓ | ✗ |
| image | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓（摘要 / 编辑 / 复原） |
| svg | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

## 降级与约束策略

- **x/y 不提供编辑**（位置仅由画布拖拽 / AI 管理）；w/h 可编辑。
- **布局关键字尺寸**（`fill_container` / `hug_contents`，布局组内子元素）：只读展示「撑满容器 / 包裹内容」，不转数字。
- **渐变画笔**（`CanvasGradientPaint` 对象）：fill / stroke 显示只读「渐变」，不提供编辑（改坏 stops 结构风险大于收益）。
- **`$token` 调色板引用**：颜色选择器解析 `doc.palette[name]` 展示实际色；用户改动后固化为纯色字符串（脱离 token）。
- **清除颜色**：写 `'none'`（patch 无法删除字段，只能显式置无）。
- **多值圆角**（数组 cornerRadius）：只读「多值圆角」。
- **字体**：必须来自 `window.preload.font.listFonts()` 真实列表（模块级缓存避免重复 IPC），禁臆造；节点现有字体不在本机列表时兜底「当前字体」分组展示。
- **无选中**：面板渲染空态占位（不隐藏），保持三栏宽度稳定、画布不跳变。

## 注意事项

- `DesignAside.vue` 接近 300 行红线，新增挂载需保持极薄；面板自身宽度 / 边框在组件内定义（与元素树一致），父级不加样式。
- 选中模型为单选（画布多选取首个 id），面板跟随 `selectedId`；无多选属性显示。
- **画布外点击不取消选中**：leafer 编辑器对画布视图外的全局点击也会触发取消（SELECT 空）。`CanvasRenderer` 以 `pointerDownInCanvas` 标记（window pointerdown capture，先于 leafer 注册）区分 —— 画布内空白点击才下发取消，点击属性面板等外部 UI 保持选中；标记用毕重置为 true，保证无 pointer 前置的程序性 cancel（render 重建 / AI 删除节点）仍能清空选中。
- 每次点「保存」才落盘一次（batchEdit → persistDoc），编辑过程只改内存草稿；无撤销，切换选中节点会丢弃未保存修改。
