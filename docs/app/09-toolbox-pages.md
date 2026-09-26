# 09 - 朝花夕拾工具箱（生图 / 打水印 / 去 AI 味儿）

> 2026-09-25。侧边栏新增分组菜单「朝花夕拾」，收纳三个独立工具页；原顶级菜单「生图」移入该分组。
> 其中「打水印」是设计侧边栏图片遮盖（马赛克 / 毛玻璃）的整页形态，「去 AI 味儿」是写作侧边栏去 AI 味能力的整页形态。
> **画布内遮盖入口与写作侧边栏入口都保持不变**，两处能力改为共享同一套组件 / 客户端。

## 菜单与路由

- 菜单定义在 `windows/main/pages/app/AppSide.vue` 的 `menuTree`：

  ```ts
  { label: '朝花夕拾', icon: SunFallIcon, children: [
    { label: '生图',      icon: AiImageIcon, to: '/attachment/image' },
    { label: '打水印',    icon: MosaicIcon,  to: '/attachment/watermark' },
    { label: '去 AI 味儿', icon: AiEditIcon,  to: '/attachment/humanize' }
  ] }
  ```

  - 与「设计 / 闲庭漫步 / 更多拓展」同形态：**无落地页**，分组只做展开 / 收起；子项 `label` 必须同级唯一（`SideMenuNode` 以 `:key="item.label"` 渲染）。
  - 图标全部取自 `tdesign-icons-vue-next`（`SunFallIcon` / `MosaicIcon` / `AiEditIcon`），无手写 SVG。
- 路由在 `windows/main/router.ts`：新增分区「朝花夕拾（工具箱）」，`/attachment/image` 的路由 `name` 由 `闲庭漫步/文生图` 改为 `朝花夕拾/生图`（路由 name 仅作标识，全库无按 name 跳转），并新增两条：

  | name | path | 页面组件 |
  |---|---|---|
  | 朝花夕拾/打水印 | `/attachment/watermark` | `pages/extend/watermark/index.vue` |
  | 朝花夕拾/去 AI 味儿 | `/attachment/humanize` | `pages/extend/humanize/index.vue` |

- keep-alive：`windows/main/App.vue` 的 `keepAliveNames` 追加 `ExtendWatermarkPage` / `ExtendHumanizePage`，切菜单再回来不丢已上传图片 / 已输入正文（页面内以 `defineOptions({ name })` 对齐）。

## 打水印页（`/attachment/watermark`）

形态：空态上传卡片（点击 = 原生文件对话框；也可把图片拖到卡片上，磁盘路径经 `webUtils.getPathForFile` 还原）→ 载入后即为**与侧边栏抽屉同款**的编辑器 → 底部「导出图片」。

页头（`#extra` 插槽）在载入图片后提供两个动作：**更换图片**（重开对话框 + `:key` 递增重挂载）与**清空图片**（`t-popconfirm` 二次确认后把 `source` 置空，回到上传空态；OCR 结果与标记只活在编辑器内部，随卸载一并丢弃）。两者都不触碰磁盘，原图与已导出文件不受影响。

能力完全复用设计侧边栏的遮盖链路，靠「共享编辑器 + 注入应用出口」实现两种落点：

```
components/mosaic/MosaicEditor.vue（工具条 + MosaicTextBoxList + 双层 canvas + 页脚，props 驱动）
  └─ components/mosaic/useMosaicEditor.ts（加载 / 绘制 / 指针 / 样式强度 / 应用编排）
        ├─ mosaicMarks.ts / mosaicPreview.ts（标记模型 / 两层绘制，均无画布依赖）
        └─ apply(payload) ← 宿主注入的应用出口
              ├─ 画布场景（MosaicDialogContent.vue）：applyNodeMosaic / clearNodeMosaic 写回节点字段
              └─ 整页场景（watermark/mosaicExport.ts）：离屏 canvas 烘焙 PNG 并写出
```

- `MosaicApplier` 契约（`{ regions, style, cellPx, blurPx }` → `Promise<{ hasRecord } | void>`）：
  - **正常返回 = 成功**（抽屉据此关闭）；**失败必须抛出**（宿主先自行提示错误，编辑器只兜底 `console.error`，且不会触发成功收场）。
  - 返回 `{ hasRecord }` 会改写编辑器内的「是否已有记录」态——画布场景据此让「标记清空后再应用 = 复原（清除记录）」在同一次会话内仍然可用；独立页省略该返回值（页面没有记录概念）。
- `MosaicEditor.vue` 的 props：`source` / `initial?` / `apply` / `applyLabel?`（主按钮文案）/ `restoreLabel?`（空标记时的文案）/ `cancelLabel?`（不传则不渲染取消按钮，独立页即不传）；`emits: close / done`。
- 打开即自动跑离线 OCR（`inject.ocr.recognize`），与侧边栏行为一致；换图靠 `:key="sourceKey"` 递增强制重挂载（图片 / OCR / 标记全部重来）。

### 导出链路（`pages/extend/watermark/mosaicExport.ts`）

`loadImageElement`（本地路径 → 事件服务 HTTP，`crossOrigin='anonymous'`）→ 离屏 canvas **按原图像素尺寸**绘制 + `drawCoverInto`（与预览同一绘制原语，scale=1）→ `toBlob('image/png')` → `inject.dialog.save`（默认文件名 `<原名>-打水印.png`）→ `fs.writeBinaryFile`。用户取消保存 = 静默返回（不提示成功 / 失败）。

- 原图只读：不写回、不拷贝、不落中间产物；页面因此**没有「复原」概念**。
- 支持格式白名单 `WATERMARK_IMAGE_EXTS = png / jpg / jpeg / webp / bmp`（遮盖与 OCR 都吃位图，不含 svg / gif / ico），拖入非法格式给警告且不载入。

### 为什么不走 main 的 `sharp.mask` 烘焙

预览底图与 OCR 坐标同属**浏览器解码系**（EXIF 方向已应用），而 `sharp` 读原始文件不修 EXIF——手机竖拍 JPEG 走 sharp 烘焙会与 OCR 框整体错位。渲染层导出与预览同源，天然「所见即所得」；`sharp.mask` 通道继续只服务画布外的 `image_mosaic` 工具（见 docs/tool/16）。

## 去 AI 味儿页（`/attachment/humanize`）

左「原文（Markdown）」+ 右「去 AI 味结果」双栏，底部动作条：主按钮「去 AI 味儿」（未登录 / 原文为空 / 进行中禁用，tooltip 说明原因），进行中改为显示「停止」。

- 编辑器 `pages/extend/humanize/components/MarkdownRichEditor.vue`：TipTap `StarterKit(heading 1-4, link.openOnClick:false)` + `Markdown` + `TableKit`，正文以 markdown 进出（`getMarkdown()` / `setContent(md, { contentType: 'markdown', emitUpdate: false })`）。
  - 工具栏复用文章编辑器的**纯函数命令面**（`applyCommand` / `readCommandActive` / `readCommandEnabled` / `ArticleBlockTypeOptions`）与按钮元数据（`ARTICLE_FORMAT_BUTTONS` 过滤子集），不带文章场景的版本 / 插图 / 悬浮框。
  - `editable` 由父级切换：流式期间两侧锁定；流式结束后结果区**恢复可编辑**（就地微调，复制 / 导出取编辑后的内容）。
- 主流程：`openHumanizeDepth({ defaultDepth: getLastHumanizeDepth() })` 选深度 → `requestHumanizeStream({ text, depth, signal, onDelta })` 流式写入结果。
  - 停止（`AbortController.abort()`）与失败都**保留已得进度**；无进度时清空结果并提示取消 / 失败。
  - 门控与写作侧一致：`AuthStore.status === 'signed-in'`（服务端未登录会抛「未登录，无法使用去 AI 味」），按字符计费由服务端扣积分，客户端不感知。
- 结果区动作：复制 Markdown（`inject.clipboard.copyText`）、导出 .md（`dialog.save` + `fs.writeTextFile`）、清空（`t-popconfirm` 二次确认，清左右两侧）。
- **不建版本、不落盘**（与写作侧边栏「产出新版本」的流程区分）。

### 配套迁移

`openHumanizeDepth`（深度弹窗两件套 `HumanizeDepthDialog.tsx` + `HumanizeDepthContent.vue`）由 `components/aside/writing/components/` 移到 `components/humanize/`，写作侧 3 处引用（`useArticleAssist` / `useSelectionHumanize` / `useNovelAssist`）改绝对路径——让独立页不必反向依赖写作侧边栏目录。深度记忆（`getLastHumanizeDepth` / `setLastHumanizeDepth`）仍由 `modules/ai/humanize.ts` 持有，两侧共用。

## 关键文件

| 文件 | 职责 |
|---|---|
| `windows/main/pages/app/AppSide.vue` | 「朝花夕拾」分组菜单（原顶级「生图」移入） |
| `windows/main/router.ts` | 分区「朝花夕拾（工具箱）」+ 两条新路由 |
| `windows/main/App.vue` | `keepAliveNames` 追加两个页面名 |
| `windows/main/components/mosaic/MosaicEditor.vue` | 共享遮盖编辑器（工具条 / 文字列表 / 双层舞台 / 页脚，props 驱动） |
| `windows/main/components/mosaic/useMosaicEditor.ts` | 编辑器编排（画布耦合清零，改为注入 `apply` 出口） |
| `windows/main/components/mosaic/mosaicEditor.less` | 编辑器样式（抽出以保证 `.vue` ≤ 300 行） |
| `windows/main/components/mosaic/{mosaicMarks,mosaicPreview}.ts`、`MosaicTextBoxList.vue` | 标记模型 / 绘制编排 / 文字列表（自 `aside/design/modals/` 迁入） |
| `windows/main/components/aside/design/modals/MosaicDialogContent.vue` | 画布抽屉接线（applier = 写 / 删节点 `mosaic` 字段） |
| `windows/main/pages/extend/watermark/index.vue` | 打水印页（上传空态 + 编辑器 + 导出） |
| `windows/main/pages/extend/watermark/mosaicExport.ts` | 全分辨率渲染 PNG + 保存对话框写出 |
| `windows/main/pages/extend/humanize/index.vue` | 去 AI 味儿页（双栏 + 流式 + 复制 / 导出 / 清空） |
| `windows/main/pages/extend/humanize/components/MarkdownRichEditor.vue` | Markdown 富文本编辑器（TipTap + 紧凑工具栏 + 排版样式 less） |
| `windows/main/components/humanize/HumanizeDepthDialog.tsx` + `HumanizeDepthContent.vue` | 改写深度选择弹窗（自 `aside/writing/components/` 迁入） |

## 注意事项

- **共享编辑器的两种落点只差一个 applier**：新增宿主（例如把遮盖接进别的页面）只需实现 `MosaicApplier`，编辑器与标记模型不必再改。
- **导出尺寸 = 原图像素**：`drawCoverInto` 内部按「目标尺寸 / 图片自然尺寸」换算，scale=1 时与预览逐像素同算法；马赛克网格按原图尺寸与当前 `cellPx` 重建，块感与预览一致。
- **两个页面常驻内存**：keep-alive 会保留 TipTap 实例与已载图片；若未来要回收，先确认用户输入是否需保留（`keepAliveNames` 一并调整）。
- **图片路径只在内存**：打水印页不持有工作目录概念，仅记住绝对路径；进程重启后需重新选图。
- **OCR 与导出都只吃位图**：拖入 svg / gif / ico 会被拒绝；需要用这些格式请先转 PNG / JPG。
- 功能验证（真机跑一遍上传 → 打码 → 导出、流式改写与停止）由人工完成，本轮只过了 `yarn typecheck`。
