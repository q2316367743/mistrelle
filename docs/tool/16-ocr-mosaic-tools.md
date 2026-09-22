# 16 - OCR 识别与图片遮盖工具（ocr_image / image_mosaic）

> 2026-09-21 落地，2026-09-22 随「非破坏遮盖」重构扩展。引入 `@arcships/light-ocr`（PP-OCRv6 离线原生引擎），提供图片文字识别与区域遮盖两个配套工具：OCR 返回的文字包围盒可直通作为遮盖区域。
>
> UI 侧的图片遮盖（工具栏 → 抽屉弹窗：识别文字勾选 / 图上框选 / 手动涂抹 / 擦除，马赛克或毛玻璃 + 强度）见 [docs/canvas/07-canvas-mosaic.md](../canvas/07-canvas-mosaic.md)：**画布内图片走非破坏记录，本文件里的烘焙落盘只服务画布外的独立文件**。

## 实现思路

三层结构（跟随 sharp 模块既有模式：契约放 preload 侧由 main/preload 共用，main 实现经 IPC 暴露，渲染层工具薄封装）：

```
AI 工具（渲染层 tool/components/design/）
  ocr_image → inject.ocr.recognize(path)
  image_mosaic → 画布内：applyNodeMosaic()（非破坏记录，modules/canvas/canvasMosaic.ts）
                 画布外：mosaicCanvasImage()（烘焙落盘）
                     ↓ IPC
preload 桥（src/preload/src/modules/ocr/ocr.ts、modules/sharp/sharp.ts）
                     ↓ ipcRenderer.invoke
main 进程
  modules/ocr/ocrService.ts   light-ocr engine 懒加载单例 + 四点 box → 包围盒 + 轮廓点
  modules/sharp/image.ts      sharpMask：按 style 生成遮盖底图（粗化方块 / 高斯模糊）+ 掩码像素替换
```

### OCR（@arcships/light-ocr）

- **依赖**：`@arcships/light-ocr`（dependencies，原生包）。yarn 安装时自动带上平台二进制（`@arcships/light-ocr-darwin-arm64` 等 optional deps）、模型包（ppocrv6-small）与 runtime。`electron-builder.yml` 的 `asarUnpack` 已加 `'**/node_modules/@arcships/**/*'`。
- **engine 生命周期**：首次识别时 `createEngine()`（模型加载较慢，之后复用），创建失败清空缓存允许重试；`app.on('will-quit')` 时 `engine.close()`（ocrIpc.ts 内注册）。识别在引擎内部 worker 执行，并发由引擎排队。
- **坐标换算**：包返回的四点四边形 `box: readonly [Point, Point, Point, Point]` 在 main 侧同时换算为**包围盒** `x/y/w/h` 与**四点轮廓** `points`（扁平 `[x1,y1,...]`，像素取整）。包围盒供列表展示、点选与旧口径使用；轮廓点供遮盖区域落盘（贴合倾斜文字）。
- **坐标契约（pageSpace）**：**左上原点、x 向右、y 向下、像素单位、EXIF 修正后**（light-ocr README 明示）。故 main 侧不做任何 y 翻转——OCR 的 `x/y/w/h` 与 `points`、`image_mosaic` 的 `regions`、画布图片像素三者同系直通。
- **图片尺寸**：main 侧用 sharp `metadata()` 读取（不依赖 OCR 结果自带的尺寸）。

### 遮盖（sharpMask，画布外烘焙路径）

`modules/sharp/image.ts` 的 `sharpMask(input, regions, output, cover?)`：

1. 原图 `ensureAlpha().raw()` 读像素。
2. 生成「遮盖底图」（`cover.style`）：
   - `mosaic`：`resize(w/N, h/N)`（N 取共享常量 `MOSAIC_CELL_PX`，可用 `cellPx` 覆盖）→ nearest kernel 放大回原尺寸（统一网格，相邻区域观感无缝）。**⚠️ 这两步必须拆成两条 sharp pipeline**：同一条 pipeline 只允许一次 resize（官方文档：Only one resize can occur per pipeline，先前的会被忽略），写在一起会只剩「按原尺寸 nearest 放大」＝恒等变换，产物与原图逐像素相同——马赛克静默失效，且因为是「成功产出新文件」极难发现（2026-09-21 踩坑，见 `sharp-single-resize-per-pipeline` 记忆）。
   - `blur`：`blur(sigma)`（sigma = `blurPx`，与渲染层 CSS `blur()` 半径同义）。
3. 区域掩码（Uint8Array）逐矩形填充，越界自动钳制。
4. 一次遍历把掩码命中像素从底图拷回原图（逐通道拷贝，通道数取 `info.channels`——灰度图经 `ensureAlpha()` 为 2 通道，同样支持），`png().toFile(output)`。

选 raw 掩码而非 composite 逐区域裁贴的原因：笔刷轨迹栅格化可能产生数百个行段矩形，composite 循环数百次 sharp pipeline 慢；raw 方案固定两次解码 + 一次遍历。

> 渲染层（弹窗预览 / 画布叠加层）用 `mosaicDraw.drawCoverInto` 复刻同一算法：马赛克贴「像素化小图 nearest 放大」、毛玻璃贴 `ctx.filter = blur(Npx)` 画的原图，保证「预览 = 画布 = 烘焙」三者观感一致。

## 关键文件

| 文件 | 职责 |
|---|---|
| `src/main/src/modules/ocr/ocrService.ts` | engine 懒加载单例、`ocrRecognizeImage(path)`、四点 box → 包围盒 + 轮廓点 |
| `src/main/src/modules/ocr/ocrIpc.ts` | `ocr:recognize` handler + will-quit 释放 |
| `src/main/src/modules/sharp/image.ts` | `sharpMask`（按 style 生成底图 + 掩码 raw 替换） |
| `src/preload/src/modules/ocr/{ocrChannels,ocr}.ts` | IPC 契约与桥（main 共用 channels） |
| `src/preload/src/modules/sharp/sharpChannels.ts` | `sharp:mask` 通道 + `SharpCoverOptions` / `SharpMaskResult`（main 共用契约） |
| `src/renderer/src/types/inject.d.ts` | `InjectOcrLine`（含 points）/ `InjectSharp.mask` 声明 |
| `src/renderer/src/windows/main/modules/canvas/canvasMosaic.ts` | `applyNodeMosaic` / `clearNodeMosaic`（画布非破坏记录）、`mosaicCanvasImage`（画布外烘焙）、`findCanvasNode` / `findImageNodeByUrl` |
| `src/common/types/mosaic.ts` | `ImageCoverStyle` + 名称映射、`MOSAIC_CELL_PX` / `MOSAIC_BLUR_PX` 与取值范围（main 与渲染层共用） |
| `src/renderer/src/windows/main/modules/tool/components/design/ocrImage.ts` | `ocr_image` 工具 |
| `src/renderer/src/windows/main/modules/tool/components/design/imageMosaic.ts` | `image_mosaic` 工具 + 路径感知 policy |

## API 契约

### ocr_image（risk: safe，免审批）

```
参数：{ path: string }（图片绝对路径；沙盒黑名单校验同 image_info）
返回：{ path, width, height, lines: [{ text, confidence, x, y, w, h, points }], note }
      无文字时 lines 为空数组并带 note
```

坐标为相对原图左上角的像素坐标（左上原点，y 向下）：`x/y/w/h` 为包围盒，`points` 为四点四边形轮廓（扁平 `[x1,y1,x2,y2,x3,y3,x4,y4]`）。

### image_mosaic（risk: sensitive + 路径感知 policy）

```
参数：{ path: string, regions: [{x,y,w,h}], style?: 'mosaic' | 'blur', strength?: number, node?: string }
      regions 必填（坐标系与 ocr_image 一致，可直通）；画布图片传空数组 = 复原
      style 缺省 mosaic；strength 缺省 14（马赛克块边长）/ 8（毛玻璃模糊半径）
      node 为画布 image 节点 id，可选
返回（画布内）：{ success, mode: 'canvas', path(原图), node, style, applied, note }
返回（画布外）：{ success, mode: 'file', path(新图), width, height, applied, node?, note }
```

行为要点：

- **画布内图片 = 非破坏记录**：目标解析为「显式 `node`（未找到 / 非图片即报错）→ 缺省按 `imageUrl === path` 匹配画布节点」；命中则把区域与参数写进该节点 `mosaic` 字段（`batchEdit` + 显式核对 `firstBatchError`），**原图不变、零文件产出**，可随时由 `regions: []` 或属性面板复原。区域以 `kind: 'text'` 记录（AI 给的矩形 → 4 点轮廓）。
- **画布外独立文件 = 烘焙**：产物写 `{sandboxDir}/outputs/images/{base}-mask-{时间戳}.png`。文件名必带时间戳——重名文件会让 leafer/Chromium 图像缓存不失效，画布不刷新（踩坑预防）。若显式给了 `node` 却完全未命中会报错（避免「以为画布已更新」）。
- **policy**：`registerToolPolicy` 路径感知——`path` 在沙盒/工作空间/home 可信区内 allow，否则 ask（仿 image_crop）。
- **画布内不叠加**：非破坏记录是**覆盖式**（每次应用替换整份区域列表），需要叠加请在 regions 里带上旧区域或改走弹窗回填（弹窗打开即回填既有区域，可继续追加）。

## 注意事项

- **注入点**：两工具在 `tool/components/design/index.ts` 注册，design canvas / design html 两场景自动获得（`createDesignTools`）。
- **EXIF 一致性（画布内已消失）**：画布叠加位图与画布图片都由 Chromium 解码（EXIF 已应用）、OCR 坐标也是 EXIF 修正后的 → 画布路径三者同系，不再错位。**画布外烘焙路径仍有旧限制**：light-ocr 修正 EXIF 旋转，而 `sharp.metadata()` 与 `sharpMask` 不修正（未调 `.rotate()`），带 EXIF orientation 的 JPEG（手机直出）会错位；验收实测建议用 PNG（截图 / 网图）避开，根治需在上传链路用 sharp 归一化落盘。<!-- 未修，见 docs/canvas/07 同名条目 -->
- **提示词**：未写入 canvasPrompt（与 image_info 同策略，工具 description 自解释）。
- **Node 版本**：light-ocr 要求 Node 22/24；Electron 39 内置 Node 22.x 满足。原生 addon 兼容性首次调用 OCR 即可验证。
- **yarn 平台包**：yarn classic 会装全部平台的 optional 二进制（约数百 MB dev 磁盘），属预期；打包时 electron-builder 只取当前平台。
