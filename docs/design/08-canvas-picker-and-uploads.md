# 08 - 画布选择面板与图片上传管理（2026-09-21）

设计侧边栏（canvas 引擎）改造：`t-select` 下拉替换为 **div 自绘触发器 + t-popup 悬浮面板**。核心模型：**上传的图片本身就是一个画布**——上传后拷入沙盒并创建一个引用该图片的画布（画布上放一个铺满的 image 图层），与 AI 创建的画布在同一个列表混排，点击即在主画布区显示。普通画布可归档；上传来源的图片画布不可归档、可删除（连源头图片一起删）。仅覆盖 canvas 引擎 `DesignAside`；html 引擎 `HtmlDesignAside` 保持 t-select 现状，后续需要再对齐。

## 实现思路

- **归档 = 文件移动**：画布本质是 `outputs/canvas-{N}.canvas` JSON 文件、纯目录扫描发现，无数据库。归档即把文件 `fs.rename` 移入 `outputs/archived/`，取消归档移回根目录。`refreshFiles()` 同时扫两个目录，但 **返回值仍只有活跃列表**，`archivedFiles` 单独存 ref —— AI 的 `canvas_list` 等工具零改动，归档画布对 AI 自然不可见。
- **上传即建画布**：`uploadImages(sandboxDir, store, paths)` 对每张图片：拷入 `outputs/uploads/`（保留原文件名、重名 `-1/-2` 后缀）→ `store.create({ source: 'upload', width/height=图片原始尺寸 })` → push 一个铺满画布的 image 节点（imageUrl 指向 uploads 落位路径）→ 落盘。一图一画布，最后一张自动设为当前画布（主画布区立即显示）。图片字节只存 uploads/，画布 JSON 存引用。
- **两类产物区分**：`CanvasDoc.source: 'upload'` 标记上传来源（经 `toFileInfo` 同步到 `CanvasFileInfo.source` 供面板消费）。面板单一列表中：普通画布 = PaletteIcon + 「归档」；图片画布 = ImageIcon + 「图片」tag + 「删除」。删除走 `store.delete` → 检测 `source==='upload'` 后连带删除画布引用的 uploads/ 源图片（`isPathUnder` 限定只清理 uploads 目录内路径，防越界）。
- **触发器/面板**：`CanvasFilePicker` 自绘 trigger div（当前画布标题 + chevron 图标），`t-popup trigger="click" destroy-on-close` 弹出面板；面板每次展开重扫列表（AI 与本地文件变更即时可见）；「显示归档」为本地勾选态不持久化。

## 关键文件

| 文件 | 职责 |
|---|---|
| `modules/canvas/canvasDocOps.ts` | **新**，从 CanvasStore 拆出的纯函数区段（文件名/目录构建、readDoc、toFileInfo、节点树工具、sanitize、SVG token、applyImageOp）；新增 `buildCanvasArchivedDir` |
| `modules/canvas/CanvasStore.ts` | 拆分后 300 行；新增 `archivedFiles` ref、`archive()/unarchive()`、`create()` 版本号全量 max+1 + `source` 透传、`delete()` 连带清理上传源图片 |
| `modules/canvas/canvasUploads.ts` | **新**，`uploadImages`（拷贝+建画布）、`removeUploadSourceFiles`、`buildCanvasUploadsDir`、`CANVAS_UPLOAD_EXTS`；纯异步函数无全局状态 |
| `modules/canvas/canvasTypes.ts` | 新增 `CanvasDocSource`（'upload'）、`CanvasDoc/CanvasFileInfo.source` |
| `aside/design/components/CanvasFilePicker.vue` | **新**，触发器 + 面板（单一混排列表、类型图标/标签、归档与删除、显示归档开关、上传按钮） |
| `aside/design/components/useCanvasPickerActions.ts` | **新**，面板动作集（归档/取消归档/删除确认/上传），从 CanvasFilePicker 拆出以贴 300 行红线 |
| `aside/design/DesignAside.vue` | t-select → `CanvasFilePicker`；删除 selected/canvasOptions/syncSelected/双 watch（选中态由 picker 直读 `store.current`） |

## 数据结构 / API 契约

```ts
// canvasTypes.ts
type CanvasDocSource = 'upload'   // 扩展位：产物来源

interface CanvasDoc {
  /* ...原有字段... */
  source?: CanvasDocSource       // 缺省 = AI 创建的常规画布
}

interface CanvasFileInfo {
  /* ...原有字段... */
  source?: CanvasDocSource       // 与 CanvasDoc.source 同步
}

// CanvasStore 新增 / 变更
archive(version): Promise<void>     // 移入 archived/；若为当前画布则同时关闭
unarchive(version): Promise<void>   // 移回 outputs/ 根目录
archivedFiles: Ref<CanvasFileInfo[]> // 归档列表（refreshFiles 时同步刷新）
create(input): source?: CanvasDocSource 透传
delete(version): source=upload 时连带 rm 画布引用的 uploads/ 源图片
```

目录约定（沙盒内）：

```text
{chatId}/outputs/
├── canvas-{N}.canvas           # 画布（含 AI 画布与上传图片画布，AI 工具可见）
├── archived/canvas-{N}.canvas  # 归档画布（仅侧边栏可见）
├── images/                     # AI 生成 / 画布导出图片
└── uploads/                    # 上传源图片字节（画布 JSON 只存引用）
```

## 注意事项

- **store 方法必须返回响应式代理**：`create()/open()` 落盘赋值后 `return this.current.value`（代理）而非局部原始对象。渲染层是 `watch(() => store.current.value, render, { deep: true })`，拿到原始对象做就地变更（如上传画布 push 图片节点）会绕过代理 set 陷阱，深 watch 不触发、画布不渲染，直到切换画布重新赋值才显示。与封面/配图 store 的 refresh() 返回 raw 对象是同类坑。
- **归档当前画布必须关闭 current**：`persistDoc` 恒写根目录路径，不关闭会导致编辑已归档画布时在根目录复活出重复文件。
- **`create()` 版本号在「活跃 ∪ 归档」全量上取 max+1**：否则归档版本号被新画布复用后，归档时 `rename` 会互相覆盖。
- **打开归档画布前须先取消归档**（面板 `handleOpen` 已处理）：保证同一画布只有唯一写入路径。
- **图片画布不可归档**：面板按 `source` 给出删除入口；归档入口只对普通画布出现。若手动把图片画布移入 archived/，面板勾选显示归档后按「取消归档」处理。
- **删除图片画布连带删源文件**：`store.delete` 对 `source='upload'` 画布统一生效（含 AI 的 `canvas_delete` 工具调用）；`isPathUnder` 保证只清理 uploads/ 目录内的路径。
- **删除有确认弹窗**（`MessageBoxUtil.confirm`），文案注明将同时删除上传的图片文件。
- **上传尺寸兜底**：`readImageInfo` 读不到宽高（如 sharp 不可用）时按 800×600 建画布。
- `CanvasFilePicker` 的 disabled 透传 `isChatRunning`（聊天进行中禁用切换/归档/上传/删除，与原 t-select 行为一致）。
- 拆分后 `modules/canvas/index.ts` 以 `export *` 追加 `canvasDocOps` / `canvasUploads`，对外导出面保持兼容（`parseCanvasVersion` 等原导出不变）。
