# 06 - 画布导出分层 PSD

> 2026-09-12 落地。画布新增 Photoshop PSD 导出（MVP：逐图层位图化），入口两处：`canvas_export` 工具（`format: 'psd'`）与设计侧边栏「下载 PSD」。

## 实现思路

PSD 写入选型 `ag-psd`（唯一成熟的 JS 写 PSD 库，浏览器端可用，`writePsdUint8Array` 直接返回字节，无需 Node canvas）。核心策略是**逐图层位图化**：复用现有 leafer 渲染事实源（`buildNode` + 离屏 Leafer），每个叶子节点单独光栅化为透明 PNG 塞进 PSD 图层；`group` 映射为 PSD 图层组。视觉与 PNG 导出 1:1，代价是 PS 内不可再编辑矢量 / 文字（文本层写入保真度脆弱：PS 打开需点「更新文本图层」、不支持段落样式、竖排可能损坏文件，故 MVP 放弃，后续可做可选增强）。

## 关键文件

| 文件 | 职责 |
|---|---|
| `src/renderer/src/windows/main/modules/canvas/canvasPsd.ts` | 核心：`exportCanvasPsd(doc)` → `ArrayBuffer`（直接对接 `fs.writeBinaryFile`） |
| `modules/canvas/index.ts` | re-export |
| `modules/tool/components/canvas/canvasTools.ts` | `canvas_export` 增加 `format` 参数 |
| `windows/main/components/chat/aside/design/DesignAside.vue` | 「下载 PSD」菜单项（`handleDownload(format)` 合并单函数） |

## 导出流程（canvasPsd.ts）

1. `ensureFontsForDoc` + `prepareMosaicOverlays` 并行就绪（与 PNG 导出同一事实源：字体齐、遮盖叠加位图已生成）。
2. `computeLayoutBounds` 一次拿全节点画布绝对包围盒（id → bounds 映射）。
3. 复用**单个**离屏 Leafer（doc 尺寸），逐节点 `leafer.clear()` 后挂载 `buildNodeWithExtras` 产物（节点元素 + 图片遮盖叠加层）→ `settleAnimations` → `export('png', { blob, screenshot: 节点包围盒 })`，串行处理防内存峰值；`Leafer.clear()` 等价 `removeAll(true)`（已核 @leafer/core）。
4. 元素坐标是「相对父盒」：单独挂载用包装 Group 平移回绝对位置（`x: abs.x - layout.x`），不影响子树相对结构与旋转。
5. Blob → `createImageBitmap` → `HTMLCanvasElement`（ag-psd 图层像素只吃 canvas / ImageData）。
6. 递归构建 ag-psd `Layer` 树：
   - group 无 effects → 图层组 `{ children, opened: true }`；自身 fill / stroke 补一层「背景」位图（递归子层不含组背景）；
   - group 有 effects → **整组拍平为单图层**保视觉（组级效果无法映射到 PSD 组）；
   - 叶子 → `{ left, top, canvas }`（ag-psd 按 left/top + canvas 尺寸推导 right/bottom）；
   - `visible === false → hidden`；画布底色为最底层「背景」图层。
7. `writePsdUint8Array(psd, { generateThumbnail: false })`。

## 混合模式映射

leafer（canvas 值）→ PSD：`-` 换空格即命中（multiply / color-dodge → color dodge 等）；特例 `lighter → linear dodge`、`source-over / 缺省 → normal`；PSD 图层组缺省 `pass through`；无对应项降级 `normal`。

## 已知限制（后续增强方向）

- 文本 / 矢量 / 阴影 / 模糊 / 渐变全部烘焙进位图，PS 内不可编辑；可编辑文本层为 Phase 2 可选项（`ag-psd` `LayerTextData`，风险见上）。
- 旋转烘焙进位图（截图区域为布局包围盒，非旋转 AABB，极端旋转角可能裁边）。
- group 裁剪（overflow clip）不映射；节点级 effects 随位图烘焙，组级 effects 靠拍平保留。
- **图片遮盖（马赛克 / 毛玻璃）随宿主图层烘焙**：导出的是「遮盖后」的视觉（遮盖叠加层由 `mosaicOverlay` 生成、经 `buildNodeWithExtras` 与图片一起光栅化），PSD 内无法单独关掉遮盖——需要未遮盖的原图请直接用节点的 `imageUrl` 原文件。
- PSD 仅整张画布导出，`canvas_export` 的 `node` / `region` 参数对 psd 无效（返回 note 说明）。

## 注意事项

- `ag-psd` 为渲染层专用依赖，装在 **devDependencies**（依赖归属铁律，externalizeDepsPlugin 只外部化 dependencies）。
- 隐藏节点照常光栅化（leafer 渲染为空白）+ `hidden: true`，避免 ag-psd 对无像素图层的边界行为。
- 验证方式：`yarn typecheck`（RL-07）；PSD 打开效果需在 Photoshop 实测。
