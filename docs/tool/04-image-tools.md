# 生图 / 裁剪 / 去背景 / 颜色分析工具（image_generate / image_crop / image_remove_background / image_color_map）

> design 对话注入的 4 个图片处理工具：生图（依赖默认生图模型，多素材合并省钱）+ 本地裁剪 + 本地去背景 + 本地颜色分析（uTools Sharp）。
> 定位：解决「AI 无插画素材 / 想省生图成本 / 生图产物带白底盖住画布背景 / 需要判断合成图哪里颜色突兀」——多素材拼 sprite 一次生成，
> 本地切分；需要透明底时本地 flood fill 去背景；需要检查配色是否协调时本地网格色差分析。

> 关键文件：
>
> - 工具工厂 `src/modules/tool/components/design/index.ts`
> - 生图工具 `src/modules/tool/components/design/imageGenerate.ts`
> - 裁剪工具 `src/modules/tool/components/design/imageCrop.ts`
> - 去背景工具 `src/modules/tool/components/design/imageRemoveBackground.ts`
> - 颜色分析工具 `src/modules/tool/components/design/imageColorMap.ts`
> - 生图服务：main `ImageService` + `RelayService`（`/api/images/*`）
> - Sharp 封装 `src/main/src/modules/sharp/image.ts`（sharpColorMap）+ IPC `src/main/src/modules/sharp/sharpIpc.ts` + 类型 `src/types/inject.d.ts`
> - 省钱指南 `../../src/modules/canvas/guidelines/image-generation.md`
> - 注入点 `src/global/ChatTypeConfig.ts`（design 配置）

---

## 1. 工具契约

### `image_generate`（文字生图，写沙盒）

| 项       | 值                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 参数     | `prompt`（必填，建议详细英文描述）+ `path?`（输出路径，缺省沙盒 `outputs/images/image-{时间戳}.png`）+ `size?`（如 `1024x1024`） |
| 返回成功 | `{ success, path, width?, height? }`                                                                                             |
| 返回失败 | `{ error }`（未配置模型 / 模型无效 / 接口失败 / 缺 prompt）                                                                      |
| 风险     | sensitive，注册路径感知策略（沙盒 / 工作空间内放行）                                                                             |
| 注入条件 | 仅当「默认生图模型」（设置 → 默认设置）已配置时注入                                                                              |

- 真实生图逻辑收口在 `window.preload.image.generate({ record: false, path, ... })`
  （main `ImageService` 工具直出模式 → `RelayService` 调 `/api/images/generations` 与轮询）。
  流程：`defaultImageModel`（服务端档位 code）→ 提交任务拿 `taskId` → 轮询至 completed → 落盘。
- 工具从具体文件路径导入，不经过 chat 桶文件，避免循环依赖。

### 生图服务端契约（mistrelle-server `/api/images`）

统一异步任务模型（Result + camelCase），由 main `RelayService` 解包：

| 端点 | 说明 |
| ---- | ---- |
| `POST /api/images/generations` | 提交；`data` 为 `{ taskId, status, n, error, images? }` |
| `GET /api/images/tasks/{taskId}` | 轮询；completed 时 `images` 为 `{ url }` 或 `{ b64Json }` |

- **轮询参数**：每 3s 一次，最多 100 次（≈5 分钟）；查询连续失败 ≥5 次才判 resumable 失败。
- **错误提取**：优先 Result `msg`；HTTP 非 2xx 透出可读中文。
- **size**：缺省补 `1024x1024`；显式传入则原样透传。
- **落盘**：先 `mkdir(dirname,true)`；URL 下载 / base64 写盘均在 main。
- **宽高**：落盘后优先 `sharpMetadata(path)`，回退从 `size` 正则解析。

### `image_crop`（本地裁剪，不耗模型）

| 项       | 值                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| 参数     | `path`（源图）+ `regions[]`（x/y/width/height）**或** `grid{cols,rows,gap?}` + `outDir?`（缺省源图同目录） |
| 返回成功 | `{ success, source:{path,width,height}, images:[{index,path,width,height}] }`                              |
| 返回失败 | `{ error }`                                                                                                |
| 风险     | sensitive，路径感知策略（源图 / 输出目录限沙盒 / 工作空间 / 主目录）                                       |

- 基于 **uTools 内置 Sharp**：`src-utools/src/inject.js` 包装为 `inject.sharp.metadata(input)` /
  `inject.sharp.crop(input, region, output)`（底层 `.extract().png().toFile()`）；ZTools / browser 环境
  缺失（undefined），工具判空报错。
- `grid` 等分：`cellW = floor((W − gap×(cols−1)) / cols)`，末行 / 末列吸收余量保证全覆盖；
  `regions` 显式区域自动取整并钳制到图片边界内。

### `image_remove_background`（本地去背景，不耗模型）

| 项       | 值                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| 参数     | `path`（源图，必填）+ `color?`（默认白 `#ffffff`）+ `tolerance?`（0~255，默认 40）+ `output?`（缺省同目录 `{basename}_no-bg.png`） |
| 返回成功 | `{ success, path, width, height, removedPixels?, note }`                                                         |
| 返回失败 | `{ error }`（缺 path / 非 uTools 无 sharp / color 非法 / 处理失败）                                               |
| 风险     | sensitive，路径感知策略（源图 / 输出限沙盒 / 工作空间 / 主目录）                                                  |
| 注入条件 | 无条件注入（本地处理，不依赖生图模型）                                                                            |

- **算法**：flood fill（BFS）——从图片四条边像素为种子，四邻域扩展，凡与目标色在容差内
  （RGB 各通道差值 ≤ tolerance）且与边缘连通的像素，alpha 置 0，输出 PNG。
  只清除「从外到内的连续背景」，主体内部未被边缘连通的同色区域不受影响。
- **实现**：`inject.sharp.removeBackground(input, options, output)`（`src-utools/src/inject.js`）：
  `ensureAlpha().raw().toBuffer({ resolveWithObject: true })` 读 RGBA → JS BFS → `sharp(data, { raw })` PNG 写回；
  ZTools / browser 环境缺失（undefined），工具判空报错。
- **color 支持**：hex（`#ffffff`）/ `rgb(r,g,b)` / `[r,g,b]`；非法回退纯白。
- **removedPixels = 0**：边缘未匹配到背景色（主体占满整图 / 背景不连续 / 容差过小），返回成功但带提示，
  AI 应提高 tolerance 或改用 color 指定实际背景色后重试。

### `image_color_map`（本地颜色分析，不耗模型）

| 项       | 值                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 参数     | `path`（源图，必填）+ `grid?`（长边格数 4~48，默认 24）+ `top?`（palette/anomalies 条数 1~16，默认 8）                     |
| 返回成功 | `{ success, source:{path,width,height}, cols, rows, palette:[{hex,ratio}], anomalies:[{row,col,x,y,width,height,color,deviation}], note }` |
| 返回失败 | `{ error }`（缺 path / 非 uTools 无 sharp / 处理失败）                                                                     |
| 风险     | sensitive，路径感知策略（源图限沙盒 / 工作空间 / 主目录）                                                                  |
| 注入条件 | 无条件注入（本地处理，不依赖生图模型）                                                                                     |

- **用途**：判断图片 / 画布某区域颜色是否与周围差距过大（突兀）。AI 不必脑补整张网格，
  直接读 `anomalies`（按 deviation 降序）定位问题区。
- **算法**：`sharp(input).resize(cols, rows, { fit:'fill' }).ensureAlpha().raw()` 一次读入——
  按宽高比缩放（`cols=grid` 长边，`rows=round(cols×h/w)`，非强制正方形），下采样即每格平均色。
  - `palette`：非透明格 RGB 直方图计数，按占比降序取 Top-N。
  - `anomalies`：每格 sRGB→CIELAB（D65），与 8 邻域格求 ΔE76 最大差值作 deviation，取 Top-N 降序；
    `x/y/width/height` 映射回**原始像素坐标**（末行 / 末列吸收余量）。
  - 透明格（alpha < 128）剔除，不参与统计。
- **deviation 参考**：>30 明显突兀，15~30 轻微（note 内告知 AI）。
- **实现**：`inject.sharp.colorMap(input, gridSize, top)`（`src/main/src/modules/sharp/image.ts`，
  纯 JS，一次 raw 读取）+ IPC `sharp:colorMap`（`src/main/src/modules/sharp/sharpIpc.ts`）。

## 2. 与 canvas / 指南的关系

- 产出 path 填进画布 `image` 节点 `imageUrl` 使用。
- `canvas_guidelines("image-generation")` 内建省钱规范：**多个素材合并一张 sprite 一次生成 → image_crop
  切分**（1 次生图换 N 素材，裁剪本地免费）。
- **生图不支持真透明**：`image_generate` 产物必带不透明背景（多为白底）；需要透明底素材时
  先用 `image_remove_background` 去背景再填画布，禁止把白底图直接盖在深色 / 彩色背景上
  （`image_generate` description、canvasPrompt 生图增强规则、指南均已告知 AI）。
- canvas 的 `image` 操作 `ai` 类型仍按 stock 兜底（未接入 image_generate），不在本次范围。

## 3. 注意事项

- 未配置默认生图模型或模型无效时工具返回明确 error，AI 应如实告知用户并回退 stock / placeholder / 用户素材。
- 接口返回无法识别（无 url / b64Json / taskId）时同样返回明确 error，避免静默失败。
- image_generate 只在配置默认生图模型后注入；未配置时模型上下文里看不到该工具，不会误调用。
- 裁剪 / 去背景输出固定 PNG；去背景输出按 `{basename}_no-bg.png` 命名（可用 output 覆盖）。
- **路径包含判断统一用 `isPathUnder(target, parent)`**（`src/utils/sandbox.ts`，两端 `normalizePath` 归一化并去尾部 `/`）；
  工具策略里不要再本地重复实现，直接 `import { isPathUnder } from '@/utils/sandbox'`。
