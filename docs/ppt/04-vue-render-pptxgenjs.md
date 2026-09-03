# PPT 模块：Vue 唯一布局与 PptxGenJS 导出

## 1. 架构

PPT 的持久化 JSON 结构仍是 `PptJsonDoc → slide[][] → SlideNode`，但渲染与导出链路改为：

```text
SlideNode JSON
    ├─ Vue vueRender 组件 + CSS flex/layout → 浏览器预览
    │                                      └─ data-node-id 精确点选/双击引用
    └─ 离屏挂载同一组件 → getBoundingClientRect 快照（二维 slides × items）
                                          ├─ IPC → 主进程 PptxGenJS → PPTX
                                          └─ renderer canvas → PNG dataURL → IPC 落盘
```

浏览器 CSS 是唯一布局真相。主进程不再重新计算布局，只将快照中的绝对像素坐标转换为英寸（96 DPI）调用 PptxGenJS，因此预览与 PPTX 的位置和尺寸一致。

## 2. 关键文件

### 渲染层

- `src/renderer/src/modules/ppt/vueRender/PptNode.vue`：按 `tag` 分发 20 种节点。
- `PptSlideSurface.vue`：1280×720 固定画布；根节点隐式 VStack；Line/Arrow 作为 overlay SVG。
- `attrStyle.ts`：公共 attr、文本 attr、`$token` 颜色解析；快照也复用此模块。
- `snapshot.ts`：读取 DOM 几何、读取 JSON 样式语义，产生快照项。
- `offscreen.ts`：隐藏但参与布局地挂载全部页，等待图片/图表/字体稳定后采集。
- `pngPaint.ts`：快照逐项 canvas 绘制，输出 PNG dataURL。

### 主进程与桥

- `src/main/src/modules/ppt/pptxExport.ts`：PptxGenJS 坐标导出；原生图表 `addChart`；渐变/SVG 图片经 sharp 处理。
- `src/main/src/modules/ppt/pngWriter.ts`：接收 renderer canvas 的 PNG dataURL 并落盘。
- `src/preload/src/modules/<域>/*Channels.ts`：PptExportSnapshot IPC 契约。
- `src/preload/src/ppt.ts`：`exportPptx` / `writePngFiles` 薄桥。
- `src/renderer/src/modules/ppt/pptRender.ts`：离屏快照 + 导出调用封装。

POM 和 pptx-glimpse 已从依赖、主进程渲染链与 IPC 中移除；预览不再请求主进程生成 SVG。

## 3. 快照数据契约

快照的第一维是页，第二维是该页的绘制项，数组顺序就是 z 序：

```ts
interface PptExportSnapshot {
  w: number
  h: number
  slides: Array<{ items: PptExportItem[] }>
}
```

绘制项是判别联合：

- `text`：文本、字体、行高、对齐、样式、绝对盒子。
- `rect` / `ellipse` / `shape`：填充、边框、圆角、阴影、预设形状名。
- `image`：data URI 或沙盒本地路径、contain/cover。
- `line`：两个端点、线宽、虚线、首尾箭头。
- `chart`：图表类型、系列数据、颜色、标题、图例开关。

复合节点（Table、Timeline、Flow、Tree、Matrix、Pyramid、ProcessArrow）由组件渲染后按子节点 DOM 逐项测量；子项也保留 `nodeId`。

## 4. 点选与精准编辑

每个节点（包括 `TimelineItem`、`FlowNode`、`TreeItem`、`Td`、`Li` 等子项）根元素挂 `data-node-id`。`usePptNodePick` 使用 `closest('[data-node-id]')`，不依赖 SVG 形状计数或文本启发式映射：

- 单击：选中并显示 outline，工具栏可点击「引用此节点」。
- 双击：选中后立即经 `PPT_NODE_PICK_KEY` 注入 `{ pptId, slide, nodeId, label }` 到聊天输入框。
- AI 使用 `ppt_batch_edit` 的 `update` 操作按 `nodeId` 精准修改 JSON。

含 `zIndex`、`Arrow` 的页面和复合节点子项不再有不可点选降级。

## 5. 导出注意事项

1. 导出会在 renderer 离屏挂载组件，因此即使 PPT 侧边栏没有打开也能执行；要求 Electron renderer 仍处于运行状态。
2. PPTX 使用 PptxGenJS 原生图表，PowerPoint 中图表数据可编辑；图表视觉布局可能与 echarts 预览存在库级差异。
3. 渐变填充、内联 SVG、Icon 在 PPTX 中按图片处理；普通形状、文本、线条、图表保持可编辑。
4. PNG 使用同一快照的 canvas 绘制，单页路径为传入文件，多页路径为目录下 `page-{n}.png`。
5. 文本以实测盒子导出，`fit: none` 禁止 PowerPoint 自动缩放；字体需使用 `font_list` 返回的真实本机字体，避免字体替换造成换行变化。
6. 新增节点 tag 时必须同时补：Vue 组件、快照 emitter、PptxGenJS 映射（必要时 PNG painter）、`pptElementSchemas` 与指南文档。
