# 07 - 图片遮盖（马赛克 / 毛玻璃：节点记录 + 实时叠加，可复原）

> 2026-09-22 重构（第三轮，终态）。前两轮的问题：**第一版**把编辑做在画布内（leafer 预览层 + 指针交互），链路长且易错；**第二版**搬到抽屉弹窗，但「应用」仍是**烘焙**——生成 `{base}-mosaic-{时间戳}.png` 并改写节点 `imageUrl`，原图被换掉、打码不可复原、每打一次码多一个文件。
>
> 本轮改为**非破坏模型**：遮盖区域与参数记录在 **image 节点的 `mosaic` 字段**上，`imageUrl` 永远指向原图，画布 / 导出时由渲染层**实时叠加**遮盖层；删除该字段即无损复原。同时支持**马赛克（像素块，粗细可调）**与**毛玻璃（高斯模糊，半径可调）**两种遮盖方式。底层能力见 [docs/tool/16-ocr-mosaic-tools.md](../tool/16-ocr-mosaic-tools.md)。

## 数据模型（非破坏）

```ts
interface CanvasNode {
  imageUrl?: string        // 始终是原图，遮盖不改写它
  mosaic?: CanvasMosaic    // 遮盖记录：盖哪里、怎么盖
}

interface CanvasMosaic {
  style: 'mosaic' | 'blur'  // 马赛克（像素块）/ 毛玻璃（高斯模糊）
  cellPx?: number           // 马赛克块边长（px，越小越细腻），缺省 MOSAIC_CELL_PX=14
  blurPx?: number           // 毛玻璃模糊半径（px），缺省 MOSAIC_BLUR_PX=8
  regions: CanvasMosaicRegion[]
}

interface CanvasMosaicRegion {
  points: number[]          // 轮廓点扁平坐标（图片像素，左上原点）：矩形 4 点 / OCR 四点四边形 / 涂抹网格矩形
  kind: 'text' | 'brush'    // 自动识别文字区域 / 手动涂抹
  text?: string             // 自动识别区域的文字（供回填匹配与辨识，不参与渲染）
}
```

- **区域形状用轮廓点而非矩形**：自动识别保留 light-ocr 的**四点四边形**（斜排 / 倾斜文字贴合更好），涂抹保留网格对齐的矩形（4 点），渲染统一按多边形裁剪。矩形与多边形同构，回填与渲染无需分支。
- **强度随方式记录**：`style: 'mosaic'` 用 `cellPx`、`style: 'blur'` 用 `blurPx`，只写当前方式对应字段；范围常量（4–32 / 2–24）在 `src/common/types/mosaic.ts` 由 main / preload / 渲染层共用，越界值一律钳制。
- **记录 `cellPx` 而非只用常量**：历史画布的遮盖按当时的块边长渲染，改常量不会让老数据变样。
- **清除 = 删字段**：`mosaic` 在 `canvasSchemas.ts` 的 `nodeFieldSchema` 白名单内（`additionalProperties: false` 红线），复原由 `clearNodeMosaic` 直接删字段后落盘（与 `setPalette` 同为「改当前文档 + save」），保证字段从 `.canvas` 中彻底消失。
- 存量画布无该字段 → 渲染照旧；第二轮的烘焙产物图（`-mosaic-*.png`）留在磁盘上不清理，其节点只是普通图片，可再次非破坏打码。

## 渲染：遮盖叠加层

`modules/canvas/mosaicOverlay.ts` 把节点记录变成一张**透明叠加位图**（只画遮盖区域，其余透明），作为 Leafer `Image` 元素紧跟宿主图片元素之后插入。

```
节点 mosaic 记录
  ├─ 解码原图（canvasImage.loadImageElement，crossOrigin=anonymous + 事件服务 ACAO:* → 画布可 toBlob）
  ├─ 生成叠加位图：与图片同宽高比，长边上限 OVERLAY_MAX_PX=1600（s = 上限/长边）
  │    → 区域路径 clip() → mosaic：像素化小图 nearest 放大 / blur：ctx.filter = blur(N*s px) 画整图
  │    → toBlob('image/png') → URL.createObjectURL（缓存键 = imageUrl|style|强度|regions 序列化）
  └─ buildMosaicOverlay(layout) → Leafer Image（同步查缓存）
```

- **预热 + 同步构建**：位图生成是异步的，`prepareMosaicOverlays(doc)` 在渲染 / 导出前 `await`（与 `ensureFontsForDoc` 并行），元素树构建阶段只做同步缓存查询；未命中则本次无叠加，下一帧预热完成后由画布重渲染补上。
- **对齐策略（关键）**：叠加元素几何（x/y/宽高/旋转/不透明度/显隐/动画）与图片元素**逐字段一致**，且叠加位图与图片**同宽高比** → 无论 Leafer 把图片按 stretch / fit / cover 哪种方式缩放进元素框，两层映射都相同，天然对齐。不做「按区域坐标单独定位」的方案，正是为了避开 Leafer 缩放语义的不确定性。
- **交互隔离**：叠加元素无 `id`、`hittable: false`、未设 `editable` → 点选、双击注入聊天、编辑器交互行为与无遮盖时完全一致（回归清单见文末）。
- **效果隔离（有意）**：不复制 `effects`（避免阴影二次叠加）与 `blendMode`（避免与已合成底图二次混合）；`opacity` / `visible` / 动画复制（视觉需同步）。
- **导出自动带遮盖**：`buildDocElements`（视口 + PNG 导出）与 `canvasPsd.ts` 的 `rasterize`（PSD 逐图层位图化）都改用 `buildNodeWithExtras`，遮盖层随宿主图层一起输出 → 「下载图片 / 复制图片 / 下载 PSD / `canvas_export`」无需额外改动。
- **缓存**：叠加位图缓存 8 条、解码缓存 8 条，超出淘汰最早项并 `revokeObjectURL`，避免大图反复编码与内存泄漏。

## 弹窗（编辑场所不变：工具栏 → 抽屉）

```
DesignAside 工具栏〔MosaicEntryButton〕
  └─ useMosaicTarget()：优先「选中的 image 节点」→ 未选中时若画布仅 1 张图自动使用 → 否则置灰 + tooltip
        ↓ openMosaicDialog({ sandbox, nodeId, source, initial: 节点已有记录 })
modals/MosaicDialog.tsx（DrawerPlugin 外壳：size clamp(900px,82%,1280px) / footer:false / destroyOnClose / closeOnOverlayClick:false）
  └─ MosaicDialogContent.vue（纯接线：把画布写回包成 MosaicApplier）
        └─ components/mosaic/MosaicEditor.vue（共享编辑器：工具条 + MosaicTextBoxList.vue + 双层 canvas + 页脚）
              └─ components/mosaic/useMosaicEditor.ts（加载 / 绘制编排 / 指针交互 / 样式强度 / 应用）
                    ├─ components/mosaic/mosaicMarks.ts（标记模型：文字框标记 + 涂抹 cell + 遗留区域 + 撤销栈）
                    ├─ components/mosaic/mosaicPreview.ts（两层 canvas 绘制编排，底层委托 mosaicDraw）
                    └─ modules/canvas/{mosaicGrid,mosaicDraw}.ts（网格几何 / 绘制原语）
                          └─ apply(payload) 出口 → modules/canvas/canvasMosaic.ts（本页写回；独立页走烘焙导出）
```

> 编辑器自 2026-09-25 起为**共享组件**（`components/mosaic/`）：画布抽屉与「朝花夕拾 → 打水印」独立页共用同一套 UI 与标记模型，落点差异由注入的 `MosaicApplier` 决定（画布写节点 `mosaic` 字段 / 独立页离屏 canvas 烘焙 PNG）。详见 docs/app/09。

### 入口可用条件

| 情况 | 结果 |
|---|---|
| 选中了 image 节点（本地路径） | 可用，目标 = 该节点 |
| 未选中，画布只有 1 张本地图片 | 可用，目标 = 那张图 |
| 未选中，画布有多张图片 | 置灰：`请先在画布中选择要遮盖的图片` |
| 无画布 / 无图片 | 置灰：`暂无画布` / `画布中没有图片` |
| `imageUrl` 非本地路径（`http(s)` / `data:` / `file://`） | 置灰：`该图片不是本地文件，无法遮盖` |

> 第二轮的「画布恰好一个图片节点」限制已解除——遮盖是**节点属性**，多图画布按选中节点作用即可。

### 工具条与交互

| 控件 | 说明 |
|---|---|
| 模式：文字识别 / 手动涂抹 | 同第二轮：图上点框 / 框选 / 列表勾选；涂抹按住拖动，轨迹按刷宽 1/4 插值补点 |
| 笔刷粗细（仅涂抹） | 12–64 步进 4，会话内记忆 `savedBrushSize` |
| 擦除（仅涂抹） | 开关式：涂抹已遮盖的 cell 将其移除 → **局部复原**旧笔迹；撤销可恢复 |
| 遮盖方式 | 马赛克 / 毛玻璃（`ImageCoverStyleOptions` 提供中文名） |
| 强度 | 马赛克 = 块边长 px（4–32，越小越细腻）/ 毛玻璃 = 模糊半径 px（2–24），随方式切换文案与范围 |
| 已标记 / 撤销 / 清空 | 计数 = 勾选文字框 + 涂抹笔数（擦除项不计）+ 遗留区域；撤销栈一次勾选 / 一次框选 / 一笔涂抹 / 一次擦除各一项 |

- **打开即回填**（`initial` = 节点已记录的区域）：涂抹区域按网格还原为 cell（`pointsToCells`）、文字区域按「文本 + 几何容差」匹配 OCR 框并勾选（`matchTextBox`），未匹配的存为**遗留区域**（照常渲染、照常写回，只能整体清空）。
- **块边长变化不漂移**：涂抹标记以 cell 存储，改块大小时按「像素区域」重排到新网格（`requantizeCells`：旧网格 → 行段矩形 → 新网格 cell），遮盖范围保持像素级不变。
- **预览 = 画布 = 导出**：三者共用 `mosaicDraw.drawCoverInto`（同网格、同模糊半径），弹窗内即所见即所得。

### 应用 / 复原（零文件产出）

- 标记非空 → `applyNodeMosaic`：区域归一化（取整、过滤退化轮廓）→ `batchEdit` patch `{ mosaic }` → **显式核对 `firstBatchError`** → 画布重渲染（叠加层出现）。
- 标记清空后点「应用」→ `clearNodeMosaic`：删除节点 `mosaic` 字段并落盘 → 立即回到未遮盖状态（按钮文案变「复原（清除记录）」，节点无记录时该按钮禁用）。
- 全程不发 IPC、不落任何图片文件；取消 / ESC / 右上角关闭都不写回（遮罩点击已禁，防误关丢编辑）。
- 两处应用逻辑都在 **applier**（`MosaicDialogContent.vue` 内的 `applyCanvasMosaic`）：返回值 `{ hasRecord }` 让编辑器知道「本次落点是否已留下记录」（决定同一次会话内清空标记后是否还能「复原」）；**失败必须抛出**，否则编辑器会把写回失败当成成功并关闭抽屉。

## 属性面板

`ImageMosaicFields.vue`（image 节点专属区块，仿 `TextPropertyFields.vue` 的子组件模式，`ElementPropertyPanel.vue` 已贴 300 行红线故必须外置）：

- 摘要：`马赛克 · 块边长 14px · 3 处` / `毛玻璃 · 模糊 8px · 1 处` / `未遮盖`。
- 「编辑」→ 打开弹窗（带 `initial` 回填，可局部增删）。
- 「复原」→ `clearNodeMosaic` 即时写回（与头部「删除元素」同为立即生效，不进 `usePropertyDraft` 草稿，避免与「保存」语义纠缠）。

## AI 工具侧

`image_mosaic` 两种落点（详见 [docs/tool/16](../tool/16-ocr-mosaic-tools.md)）：

- **画布内图片**（`node` 指定，或缺省按 `imageUrl === path` 匹配）：走 `applyNodeMosaic` 非破坏记录，`regions: []` = 复原 → AI 也能无损遮盖 / 还原。
- **画布外独立文件**：仍走 `mosaicCanvasImage` 烘焙落盘（`{base}-mask-{时间戳}.png`），因为对独立文件而言「产出一张遮盖后的图」才是可用结果。
- 参数新增 `style`（mosaic / blur）与 `strength`（强度），两种落点都生效。

## 关键文件

| 文件 | 职责 |
|---|---|
| `modules/canvas/mosaicGrid.ts` | 网格与区域几何纯函数：`resolveCover` / `createGrid` / `collectCircleCells` / `eraseCircleCells` / `cellsToRegions` / `pointsToCells` / `rectToPoints` / `pointsBounds` / 命中判定 |
| `modules/canvas/mosaicDraw.ts` | 绘制原语：`traceRegionPath` / `createPixelatedSmall` / `drawCoverInto`（马赛克与毛玻璃的唯一实现） |
| `modules/canvas/mosaicOverlay.ts` | 叠加位图生成与缓存、`prepareMosaicOverlays`、`getMosaicOverlayHref`、`buildMosaicOverlay` |
| `modules/canvas/canvasImage.ts` | `resolveImageHref`（唯一 href 转换点，原在 canvasRender）+ `loadImageElement`（crossOrigin 匿名加载） |
| `modules/canvas/canvasMosaic.ts` | `applyNodeMosaic`（非破坏写回）/ `clearNodeMosaic`（复原）/ `mosaicCanvasImage`（画布外烘焙）/ 节点查找 |
| `modules/canvas/canvasRender.ts` | `buildNodeWithExtras`（节点 + 遮盖叠加，替换三处 `buildNode` 调用点）；`exportCanvasPng` 预热叠加位图 |
| `modules/canvas/canvasPsd.ts` | PSD 逐图层光栅化改走 `buildNodeWithExtras`（遮盖随图层） |
| `components/mosaic/{mosaicMarks,mosaicPreview,useMosaicEditor}.ts` | 标记模型 / 绘制编排 / 编辑器编排（2026-09-25 自 `aside/design/modals/` 迁入成共享组件；`useMosaicEditor` 已从 441 行拆分，避免破 500 行红线） |
| `components/mosaic/MosaicEditor.vue` + `mosaicEditor.less` | 共享编辑器外壳（工具条 / 文字列表 / 双层舞台 / 页脚，props 驱动 + 注入 `MosaicApplier` 出口；样式抽出避免破 300 行红线） |
| `components/aside/design/modals/MosaicDialogContent.vue` | 画布抽屉接线（applier = `applyNodeMosaic` / `clearNodeMosaic`） |
| `components/aside/design/ImageMosaicFields.vue` | 属性面板遮盖区块（摘要 / 编辑 / 复原） |
| `src/common/types/mosaic.ts` | 共享：`ImageCoverStyle` + 名称映射、默认值与范围常量（main 与渲染层共用） |
| `src/preload/src/modules/sharp/sharpChannels.ts` | `sharp:mask` 通道与 `SharpCoverOptions`（main 共用契约） |

## 注意事项（踩坑与边界）

- **网格常量与算法同源**：弹窗预览、画布叠加、main 烘焙三处的块边长与「缩到 1/N → nearest 放大」算法必须一致（共享 `MOSAIC_CELL_PX` / `MOSAIC_CELL_RANGE`），否则「预览 ≠ 画布」。
- **⚠️ 粗化两步必须拆两条 sharp pipeline**：一条 pipeline 只认最后一次 resize，写在一起会只剩恒等变换、产物逐像素等于原图却报成功（`sharp-single-resize-per-pipeline` 记忆，本轮 `sharpMask` 保持拆开）。
- **叠加位图必须能 `toBlob`**：本地图片经事件服务 HTTP（`/file/...`，ACAO:\*）加载，`loadImageElement` 显式 `crossOrigin='anonymous'`；若某图源不支持跨域，叠加位图生成失败会**静默降级为「无遮盖叠加」**（主图仍正常渲染），不会崩画布。
- **大图性能**：叠加位图长边上限 1600px（`OVERLAY_MAX_PX`），模糊半径与块边长按缩放比换算；位图只在「图片 / 方式 / 强度 / 区域」变化时重生成，其余渲染走缓存。
- **异步渲染竞态**：`CanvasRenderer.render()` 在异步预热（字体 + 叠加位图）后加渲染世代 token，旧请求结果作废，避免慢请求覆盖新画面。
- **改图会让记录失效**：手工 / AI 直接改 `imageUrl`（如 `canvas_batch_edit` 或 `image` 操作）后，已记录的 `regions` 仍按旧图坐标渲染，可能错位——当前**不自动清理**，需要时由属性面板「复原」或重新打码。
- **EXIF 问题在画布路径上消失**：叠加位图与画布图片都由 Chromium 解码（EXIF 已应用），OCR 的坐标也是 EXIF 修正后的 → 三者同系。仅「画布外文件烘焙」路径仍保留旧的 EXIF 限制（见 docs/tool/16）。
- **双层 canvas 与 dpr**：overlay 绝对定位放进 `__frame`（`position: relative`）贴合底层；backing store 按 `devicePixelRatio` 放大 + `setTransform(dpr, …)` 防高分屏发虚。
- **文字框标记变化必须 `requestDraw(true)`**：只刷上层会出现「勾了没变遮盖」的假象。
- **OCR 提示层 `pointer-events: none`**：否则识别期间笔刷不可用。
- **回填的 OCR 匹配是启发式**：OCR 重跑结果若有偏移，按「文本 + 中心容差」匹配；匹配不上会退为遗留区域（不丢遮盖，只是不能在列表里单独取消）。

## 实测回归清单（未做自动化验证，需人工过一遍）

1. 单图画布：工具栏入口可用；打码后**原图文件与节点 `imageUrl` 均未变**，画布出现遮盖；`.canvas` 中出现 `mosaic` 字段。
2. 复原：属性面板「复原」/ 弹窗清空后「应用」→ 遮盖立即消失、`.canvas` 中 `mosaic` 字段被移除、原图完好。
3. 两种方式与强度：马赛克调块边长（4/14/32 观感明显不同）、毛玻璃调模糊半径；弹窗预览与画布一致。
4. 自动识别：勾选 / 框选 / 点选一致；斜排文字的四点轮廓比包围盒贴合（对比旧版）。
5. 手动涂抹 + 擦除：涂抹后重开弹窗回填为 cell；擦除局部后再应用，画布只剩剩余区域。
6. 多图画布：选中某张图 → 打码只作用于该节点；未选中 → 按钮置灰并提示。
7. 导出：下载图片 / 复制图片 / 下载 PSD / `canvas_export` 均包含遮盖；PSD 中该图层为遮盖后的位图。
8. 交互回归：遮盖区域上**单击仍能选中图片节点**、双击仍能注入聊天节点引用（验证 `hittable: false` 生效）。
9. AI 工具：对画布图片调用 `image_mosaic` → 画布出现遮盖且**不产生新文件**；`regions: []` → 复原；对画布外文件调用 → 生成 `-mask-*.png`。
