# 画布动画与视频导出（v3）

> 在 v2 平面设计能力之上，为画布增加 **节点动画** 与 **视频 / GIF 导出**：AI 通过 `animation` 字段描述动效，
> 系统逐帧离屏渲染 + ffmpeg 合并成视频；导出由**用户**在画布面板触发，过程展示 **剪映式全屏进度遮罩**
> （Fluent Design 规范），支持取消，完成后自动打开视频所在目录。
>
> 关键文件（已落地）：
> - 数据模型 `../../src/modules/canvas/canvasTypes.ts`（`CanvasAnimation` + `animation` / `animationOut` 字段）
> - 渲染器 `../../src/modules/canvas/canvasRender.ts`（`import '@leafer-in/animate'` + 动画属性透传 + PNG 导出
>   `settleAnimations`）
> - 逐帧导出管线 `../../src/modules/canvas/canvasVideoExport.ts`（ **新增**，含用户侧入口 `startVideoExport`）
> - 导出状态单例 `../../src/modules/canvas/videoExportState.ts`（ **新增**）
> - 全局遮罩 `src/components/canvas/VideoExportOverlay.vue`（ **新增**，挂载于 `App.vue` 根）
> - 导出 UI `src/components/chat/aside/design/VideoExportDialog.tsx` + `VideoExportContent.vue`（ **新增**，
>   `DesignAside.vue` 下拉菜单「导出为视频」入口，仅存在动画时显示）
> - 依赖：已新增 `@leafer-in/animate@2.2.9`（与 `leafer-editor@2.2.9` 同版本系）

---

## 1. 设计目标

- **声明式动画**：动效 = 节点上的 `animation` 字段（JSON），与现有「AI 生成 JSON → 渲染」管线零摩擦， 无需命令式动画代码。AI
  描述"标题渐入、背景光晕呼吸"即可产出动效。
- **视频导出闭环**：静态设计 → 动态海报 / GIF / 短视频配图，支撑小红书、抖音、电商主图等动态内容渠道。
- **导出体验对标剪映**：导出是耗时操作（秒级 ~ 十秒级），必须全屏遮罩 + 实时进度 + 可取消 + 防误切页面； UI 遵循 Fluent
  Design 规范（材质 / 圆角 / 阴影 / 动效 / 排版）。
- **复用 v2 渲染语义**：预览、PNG 导出、视频导出共用 `buildDocElements`，单一事实源。

## 2. 整体架构

```text
                 ┌──────────────────────────────────────────────┐
                 │          用户在画布面板点击「导出为视频」       │
                 │  openVideoExportDialog → 选择帧率/时长/格式等  │
                 └──────────────┬───────────────────────────────┘
                                ▼
┌──────────────┐   ┌───────────────────────────┐   ┌─────────────────────────┐
│  CanvasDoc   │──▶│ canvasVideoExport.ts       │──▶│ 离屏 Leafer 实例         │
│ (nodes[].    │   │ 逐帧渲染管线                │   │ 等图片就绪 → 逐帧 seek    │
│  animation)  │   │ 写帧 PNG → ffmpeg 合并      │   │ → export('png')          │
└──────────────┘   └──────────────┬────────────┘   └─────────────────────────┘
                                  │ 进度 / 取消信号
                                  ▼
                 ┌──────────────────────────────┐
                 │ videoExportState.ts（单例）    │
                 │ status / phase / progress /   │
                 │ abortController / ffmpegProc  │
                 └──────────────┬───────────────┘
                                │ Vue 响应式
                                ▼
                 ┌──────────────────────────────┐
                 │ VideoExportOverlay.vue       │  挂载 App.vue 根
                 │ 全屏遮罩 · 进度 · 取消按钮     │  z-index 顶层拦截一切点击
                 └──────────────────────────────┘
                                │ 完成后
                                ▼
                 window.preload.shell.openPath(输出目录)
```

> **导出入口为用户侧**：AI 不提供导出工具（`canvas_export_video` 已移除），导出由用户在
> `DesignAside.vue` 下拉菜单「导出为视频」触发（仅当画布存在动画时显示），
> 通过 `VideoExportDialog.tsx` 命令式弹窗选择帧率 / 时长 / 格式 / 分辨率后调用 `startVideoExport`。

## 3. 数据模型扩展（canvasTypes.ts）

`CanvasNode` 新增可选字段，`.canvas` JSON 无需 schema 升级，旧文件天然兼容（无该字段 = 无动画）：

```ts
/** 节点动画：映射 Leafer 动画插件（@leafer-in/animate）的 IAnimation */
export interface CanvasAnimation {
  /** 样式过渡动画：目标样式 + 选项 */
  style?: Record<string, unknown>
  /** 关键帧动画：每帧样式 + 可选时长/延迟/缓动 */
  keyframes?: Array<{
    style?: Record<string, unknown>
    duration?: number
    delay?: number
    easing?: string
  }>
  // ── 动画选项（与 Leafer IAnimateOptions 对齐） ──
  duration?: number   // 总时长（秒）
  delay?: number      // 延迟（秒）
  easing?: string     // 'ease' | 'linear' | 'bounce-out' | ...
  loop?: boolean | number
  swing?: boolean | number   // 摇摆（往返）循环
  reverse?: boolean
  speed?: number      // 播放倍速
  join?: boolean      // 加入动画前元素状态作为 from 关键帧
  autoplay?: boolean
}

// CanvasNode 增加：
// animation?: CanvasAnimation        // 入场 / 过渡动画
// animationOut?: CanvasAnimation     // 出场动画（元素移除/隐藏时执行）
```

**约定**：

- `animation.style` 支持 x/y/rotation/opacity/fill/cornerRadius/scaleX/scaleY 等所有渲染属性（与节点字段同源）；
- `keyframes` 优先于 `style`（Leafer 语义：`keyframes` 数组为关键帧动画，`style` 为单目标过渡）；
- 关键帧未设 `duration` 时由 `animation.duration` 按权重自动分配（Leafer `autoDuration` 语义）；
- 输入校验：在 `canvasSchemas.ts` 的 TypeBox 节点 schema 中为 `animation` / `animationOut` 补 schema （
  `additionalProperties: true` 放行未知样式键，仅约束选项结构），保证喂给模型的参数描述与运行时校验一致。

## 4. 渲染层（canvasRender.ts）

### 4.1 接入动画插件

依赖清单新增 `@leafer-in/animate`（版本对齐 `leafer-editor` / `leafer-ui` 的 2.2.x）。入口处导入一次：

```ts
import '@leafer-in/animate'   // 注册动画能力到 Leafer 元素
```

> `leafer-editor` / `leafer-ui` **不含**动画插件（官方要求单独安装 `@leafer-in/animate`，或使用已集成的
> `leafer-game`）。当前 node_modules 中无任何 `@leafer-in/*` 包，需 `pnpm add @leafer-in/animate`。

### 4.2 动画属性透传

`buildNode(layout, palette)` 构建元素时，把节点 `animation` / `animationOut` 透传给 Leafer 元素构造参数：

```ts
const buildAnimationProps = (node: CanvasNode): Record<string, unknown> =>
  compact({
    animation: node.animation,
    animationOut: node.animationOut
  })

// 每个 case 构造元素时并入：
// { ...buildCommon(layout, true), ...buildAnimationProps(node), ... }
```

- Group / Rect / Text / Ellipse / Polygon / Star / Line / Path / Image 全部支持动画属性（Leafer UI 元素统一能力）；
- `compact` 过滤 undefined，无动画节点不产生额外开销。

### 4.3 预览联动（CanvasRenderer.vue）

预览组件 `buildDocElements` 复用同一构建，动画自动生效（`autoplay` 默认 true → 打开画布即可见动效）。 预览性能：动画元素数量少时由
Leafer 渲染循环驱动，无额外代码。

## 5. 逐帧导出管线（canvasVideoExport.ts，新增）

核心函数：

```ts
export interface CanvasVideoOptions {
  fps: number              // 默认 30
  duration: number         // 秒，默认按动画最长时长；无动画时默认 2
  format: 'mp4' | 'gif' | 'webm'   // 默认 mp4
  region?: CanvasExportRegion      // 复用 v2 区域导出语义
  scale?: number           // 分辨率缩放（0.5 = 半分辨率），默认 1
  outPath?: string         // 缺省 沙盒 outputs/canvas-{version}.{ext}
  loop?: boolean           // gif/webm 循环（mp4 忽略）
}

export const exportCanvasVideo = async (
  doc: CanvasDoc,
  options: CanvasVideoOptions,
  controller: VideoExportController   // 见 §7
): Promise<{ path: string }>
```

### 5.1 步骤

| # | 阶段         | 实现                                                                                                                                                                                                                                                                                            |
|---|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | 参数归一     | 计算帧总数 `total = round(fps × duration)`；解析 region（复用 `computeNodeBounds` / `normalizeRegion`）；输出路径缺省拼接沙盒 `outputs/`                                                                                                                                                        |
| 2 | 建临时帧目录 | `fs.mkdir(sandbox/outputs/.video-frames-{ts}/, true)`（隐藏目录，导出后清理）                                                                                                                                                                                                                   |
| 3 | 离屏实例     | 复用 `exportCanvasPng` 的离屏模式：`canvas` + `new Leafer({ view: canvas, width, height })`；`buildDocElements(doc, scale)` 后 `add` 全部元素                                                                                                                                                   |
| 4 | 等图片就绪   | 遍历 image / svg 节点，`await` 元素加载完成（`image.ready` / 一次性监听 `loaded` 事件，超时 5s 兜底跳过）——**防止首帧空白**                                                                                                                                                                     |
| 5 | 逐帧渲染     | `for frame in 0..total-1`：`t = frame / fps` → 同步动画到 `t`（见 §5.2）→ `await offscreen.export('png', { blob: true, screenshot })` → `writeBinaryFile(frameDir/frame_%05d.png)`；**每帧前检查 `controller.signal.aborted`，命中即抛 CancelledError**；更新进度 `frame / total`（映射 0–90%） |
| 6 | 合并编码     | 调 `window.preload.ffmpeg.run(args, onProgress)`（见 §6），进度映射 90–100%                                                                                                                                                                                                                     |
| 7 | 收尾         | `fs.rm(frameDir, { recursive: true, force: true })` 清理临时帧（含失败/取消路径）                                                                                                                                                                                                               |

### 5.2 动画同步到指定时间（POC 重点）

动画插件文档确认支持 `seek` 时间定位，批量同步有两种实现， **实施前先做最小 POC 验证**：

- **方案 A（优先）**：遍历所有含 `animation` 的元素，调用元素动画的时间定位 API（如 `element.animation.seek(t)` 或 Leafer
  全局时间轴）。优点：可任意跳帧、渲染耗时与动画时长无关（5s 动画 30fps 也只渲染 150 帧实际计算）。
- **方案 B（兜底）**：`speed` 倍速真实播放 + `requestAnimationFrame` 截帧。Leafer 按真实时间推进动画， 每帧 rAF 截屏写入。优点：不依赖
  seek API、行为 100% 与预览一致；缺点：渲染时长 ≈ 动画时长 ÷ speed （speed=3 时 5s 动画约 1.7s 真实渲染），可接受。

> 决策门槛：POC 验证方案 A 能在 150 帧级规模稳定输出正确帧（尤其文本打字机 / count 动画），否则切方案 B。

### 5.3 进度模型

```
渲染阶段（逐帧）：progress = 0 → 90（frame/total）
编码阶段（ffmpeg）：progress = 90 → 100（按 ffmpeg onProgress.frame / 总帧数）
```

## 6. ffmpeg 合并（inject.d.ts:433 能力）

`window.preload.ffmpeg.run(args: string[], onProgress?)` 返回 `InjectFfmpegPromise`（含 `kill()` / `quit()`）。

命令矩阵（`-y` 覆盖、`-hide_banner -loglevel error` 静默）：

```text
mp4:  ffmpeg -framerate {fps} -i frame_%05d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -y out.mp4
webm: ffmpeg -framerate {fps} -i frame_%05d.png -c:v libvpx-vp9 -b:v 0 -crf 32 -pix_fmt yuv420p -loop 0 -y out.webm
gif:  ffmpeg -framerate {fps} -i frame_%05d.png -vf "split[a][b];[a]palettegen[p];[b][p]paletteuse" -loop 0 -y out.gif
```

要点：

- `-framerate` 必须放在 `-i` 前（输入帧率）；`-pix_fmt yuv420p` 保证播放器兼容；
- gif 用 palette 两遍法保色准，`-loop 0` 无限循环（`options.loop=false` 时去掉）；
- 进度：`onProgress.frame` 除以编码总帧数（由 ffmpeg 输出 `frame=` 驱动）映射 90–100%；
- 取消：编码中调用 `ffmpegProc.kill()`（保留 `controller` 里的 promise 引用）。

## 7. 导出状态单例（videoExportState.ts，新增）

`ToolFunction.handler`（domain/ChatTool.ts:36） **无进度/取消通道**，且导出由 agent 触发、用户可能位于任意页面， 因此用
**模块级响应式单例**（对齐 `getCanvasStore` 惯例），遮罩组件订阅同一实例：

```ts
export type VideoExportStatus = 'idle' | 'rendering' | 'encoding' | 'done' | 'cancelled' | 'error'

export interface VideoExportState {
  status: VideoExportStatus
  phaseLabel: string        // '渲染帧中' | '合并视频中'
  progress: number          // 0–100
  frame: number
  totalFrames: number
  outputPath?: string
  error?: string
}

export interface VideoExportController {
  state: Readonly<VideoExportState>   // Vue reactive，供遮罩绑定
  signal: AbortSignal                 // 逐帧循环检查
  begin(totalFrames: number): void

  update(patch: Partial<VideoExportState>): void

  attachFfmpeg(proc: InjectFfmpegPromise): void

  cancel(): void                      // abort + ffmpeg.kill()
  reset(): void
}

export const getVideoExportController = (): VideoExportController  // 模块级单例
```

- `cancel()` 置 `signal.abort()` 并调已挂载的 `ffmpegProc.kill()`；渲染循环检测 abort 抛 CancelledError；
- 失败 / 取消均清理临时帧目录并置终态（cancelled / error + message），遮罩据此显示结果文案。

## 8. 导出 UI（VideoExportOverlay.vue，Fluent Design）

### 8.1 挂载与层级

- 挂载 `App.vue` 根（`t-layout` 内末尾），覆盖整个应用、所有路由；
- `position: fixed; inset: 0; z-index: 9999`（高于现有 `common-operator` 的 51 与一切弹窗）；
- **防切页**：遮罩 `pointer-events: all` 拦截一切点击；监听 wheel / touchmove `preventDefault` 阻止底层滚动。

### 8.2 Fluent Design 规范落地

| 维度     | 规范值（Fluent）                                                                             | 实现                                                                          |
|----------|----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------|
| 遮罩材质 | Smoke：`rgba(0,0,0,0.5)`（Dark），Light 用 `rgba(0,0,0,0.3)`                                 | 全屏半透明覆盖，聚焦导出卡片                                                  |
| 卡片材质 | Acrylic：`rgba(255,255,255,0.7)` + `backdrop-filter: blur(60px) saturate(125%)`              | 居中卡片 420px 宽，临时性浮层语义                                             |
| 圆角     | Dialog 8px；内层控件 4px（嵌套圆角外大内小）                                                 | 卡片 8px；按钮/进度 4px                                                       |
| 阴影     | Elevation 16（Dialog）：`0 8px 16px rgba(0,0,0,0.12), 0 0 2px rgba(0,0,0,0.06)`              | 卡片阴影，与内容形成 z 轴层次（Depth）                                        |
| 排版     | Title 28px Semibold / Body 14px / Caption 12px                                               | 标题「正在导出视频」、阶段文案 Body、帧数 Caption                             |
| 进度条   | ProgressBar 轨道 2px、圆角 1px                                                               | `t-progress`（轨道高度 2px，主题色 = accent）                                 |
| 按钮     | 32px 高、4px 圆角、底边加深 1px                                                              | 取消按钮 `t-button variant="outline" theme="danger"`；Critical 语义 `#C42B1C` |
| 动效     | 进入 Decelerate `cubic-bezier(0,0,0,1)` 167ms；退出 Accelerate `cubic-bezier(1,0,1,1)` 167ms | 遮罩淡入 + 卡片 scale 0.98→1 进入；取消后淡出                                 |
| 颜色     | 文字：Text Primary `rgba(0,0,0,0.9)` / Secondary `rgba(0,0,0,0.6)`                           | 卡片内标题 Primary、辅助信息 Secondary                                        |

> 项目 AGENTS.md 约定「颜色类必须使用 tdesign CSS Token，禁止裸色值」：材质 / 圆角 / 阴影 / 动效遵循 Fluent
> 规格， **颜色一律映射到 tdesign token**（`--td-text-color-primary` / `--td-text-color-secondary` /
> `--td-error-color` / `--td-bg-color-container` 等）；Fluent 值仅作为 token 选型的语义参考。

### 8.3 界面结构（剪映风）

```
┌────────────────────────────────────────────┐
│  (Smoke 全屏遮罩, backdrop-filter blur)      │
│  ┌──────────────────────────────────────┐  │
│  │ 正在导出视频            ← Title 28px   │  │
│  │ 渲染帧中 · 45/150 帧     ← Caption     │  │
│  │ ▓▓▓▓▓▓░░░░░░░░░  30%    ← 2px 进度条  │  │
│  │                                    │  │
│  │      ( 取消导出 )  ← danger 按钮      │  │
│  └──────────────────────────────────────┘  │  ← Acrylic 卡片 8px 圆角
└────────────────────────────────────────────┘
```

- 状态流转文案：rendering →「渲染帧中 · {frame}/{total} 帧」；encoding →「合并视频中」； done → 自动淡出并打开目录；cancelled /
  error → 短暂停留后淡出（错误显示原因）。

## 9. 导出入口（用户侧，AI 不提供导出工具）

> v3 实施后已移除 AI 侧 `canvas_export_video` 工具：AI 负责写 `animation` 字段、预览自动播放；
> 视频导出由**用户**手动触发（剪映式导出弹窗 + 全屏进度遮罩）。

```text
DesignAside.vue 下拉菜单（仅当前画布存在动画时显示「导出为视频」）
   │
   ▼
openVideoExportDialog({ sandbox })            // VideoExportDialog.tsx（DialogPlugin 命令式外壳）
   │  body: () => h(VideoExportContent, ...)  // VideoExportContent.vue（选项表单）
   │  帧率 fps: 24/30/60（默认 30）
   │  时长 duration: 数字（默认 = 动画最长时长）
   │  格式 format: mp4 / gif / webm（默认 mp4）
   │  分辨率 scale: 1 / 0.75 / 0.5（默认 1）
   │  循环 loop: gif/webm 显示（默认 true）
   ▼
startVideoExport(doc, options)                // canvasVideoExport.ts：用户侧导出入口
   │  1. exportCanvasVideo → begin(totalFrames)   // 全屏遮罩接管
   │  2. 成功 → shell.openPath(dirname(path)) + status 'done'
   │  3. 取消/失败 → status 'cancelled' / 'error'（遮罩展示文案）
   │  4. finally → 延迟 1.5s reset（若新导出已开始则不覆盖）
   ▼
VideoExportOverlay.vue（App.vue 根挂载，全屏遮罩）
```

- 动画检测：`maxAnimationTime(doc) > 0`（canvasVideoExport.ts 导出）决定是否显示「导出为视频」入口；
- 安全：导出写沙盒 `outputs/`（可信区），无需审批；无 AI 参数注入面（用户表单白名单：fps 数值、format 枚举）。

## 10. 性能与资源

| 指标        | 参考值                                                         |
|-------------|----------------------------------------------------------------|
| 帧渲染      | 1080p 单帧离屏 export 约 10–50ms；150 帧总计约 3–8s            |
| ffmpeg 编码 | 150 帧 mp4 约 1–3s                                             |
| 临时占用    | 150 帧 1080p PNG 约 100–200MB（导出后 `rm` 清理）              |
| 大画布      | 建议 AI 侧传 `scale: 0.5` 降分辨率；遮罩进度条如实反映耗时阶段 |

## 11. 待验证点（POC，已全部验证 ✅）

1. **seek 批量同步**（§5.2 方案 A）：动画插件元素级 seek 准确形态与多元素同步语义 ✅
2. **文本动画 seek**：打字机 / count 动画时间定位 ✅
3. **`@leafer-in/animate` 与 `leafer-editor@2.2.9` 版本兼容性** ✅

**POC 结论（浏览器实测）**：

- 插件注册到与 `leafer-editor` 相同的 `@leafer-ui/draw` 单实例（`pnpm` 去重为同一物理包），`animation` 属性自动播放生效，
  `el.animate()`（无参）返回当前动画实例；
- `seek(time, includeDelay?)` 定位确定，打字机 / count 文本动画均可 seek；`pause()` 后 rAF 不再推进、seek 仍可同步定位（导出前先
  pause 保证逐帧确定性）；
- **seek 不自动处理循环**：`loop` / `swing` 需自行折算到周期内时间（`canvasVideoExport.ts` 的 `seekToTime`：loop 取模、swing
  三角波折叠、有限次数超出后停在结束态、t < delay 停在起始态）；默认缓动为快进曲线（非线性），逐帧采样符合真实动画；
- 图片元素 `.ready` / `.image?.ready` 在加入 Leafer 后异步变为 true，轮询等待可防首帧空白；
- **方案 A（seek）为最终实现**，未启用方案 B 兜底。

## 12. 注意事项

- **不动 v2 语义**：`animation` 是纯增量字段，无动画画布行为与现状完全一致；`canvas_export`（PNG）保持不变。
- **图片加载时序**：image/svg 未就绪就导出会首帧空白，逐帧前必须等待（§5.1 step 4），这是视频导出区别于 PNG
  导出（静态图可容忍后补）的关键差异。
- **取消的幂等性**：取消后清理帧目录必须走 `finally`，避免残留 `outputs/.video-frames-*`。
- **并发导出**：单例 controller 同一时间只允许一个导出任务（新导出前 `reset` 并提示先取消上一个）。
- **遮罩不阻塞 agent 上下文**：遮罩仅 UI 层，agent 消息流（tool 结果回填）不受影响；导出由用户触发，取消通过遮罩按钮 → `controller.cancel()`。
- **ffmpeg 命令注入**：所有参数（fps / 路径 / format）经白名单校验（fps 数值、format 枚举、路径走
  `isPathUnder` 可信区），不拼接用户自由字符串。

---

## 13. 实现记录（v3 已落地）

### 13.1 落地文件与职责

| 文件                                           | 职责                                                                                                                                                                 |
|------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `canvasTypes.ts`                               | `CanvasAnimation` 接口 + `CanvasNode.animation` / `animationOut`（纯增量，无字段 = 静态）                                                                            |
| `canvasSchemas.ts`                             | `animation` / `animationOut` TypeBox schema（`style` / `keyframes[].style` 用 `additionalProperties: true` 放行任意样式键，仅约束选项结构）                          |
| `canvasRender.ts`                              | 顶部 `import '@leafer-in/animate'` 一次；`buildCommon` 并入 `buildAnimationProps`（`compact` 过滤 undefined）；新增 `settleAnimations` 供 PNG 导出把动画推进到结束态 |
| `canvasVideoExport.ts`（新增）                 | `exportCanvasVideo` 逐帧管线（seek 方案 A）+ `seekToTime` 时间折算 + `maxAnimationTime` + ffmpeg 合并 + `CancelledError` + **`startVideoExport` 用户侧导出入口**（成功开目录 / 遮罩状态流转 / 延迟复位） |
| `videoExportState.ts`（新增）                  | 模块级响应式单例 `getVideoExportController`（state / signal / begin / update / attachFfmpeg / cancel / reset）                                                       |
| `VideoExportOverlay.vue`（新增）               | 全屏导出遮罩（Fluent：Acrylic 卡片、2px 进度、进出场动效；颜色走 tdesign token），挂载 `App.vue`                                                                     |
| `DesignAside.vue`                              | 下拉菜单：画布存在动画时显示「导出为视频」（`maxAnimationTime(doc) > 0`），无动画仅「复制图片 / 下载图片」；文件夹 / 复制 / 下载保持原样                                        |
| `VideoExportDialog.tsx`（新增）                | 导出弹窗外壳（DialogPlugin 命令式，`footer: false`、`destroyOnClose: true`，`body: () => h(VideoExportContent)`）                                                        |
| `VideoExportContent.vue`（新增）               | 导出选项表单：格式（mp4/gif/webm）、帧率（24/30/60）、时长、分辨率（1/0.75/0.5）、循环（gif/webm）；「开始导出」调 `startVideoExport` 并 `emit('close')`                    |
| `canvasTools.ts`                               | **无 `canvas_export_video`**（导出入口为用户侧 UI，AI 不导出视频）；`CANVAS_TOOL_NAMES` 不含它；移除对应安全策略                                                        |
| `canvasPrompt.ts` / `guidelines/operations.md` | AI 侧动画提示（含「视频导出由用户操作，不要主动导出」）/ `animation` 字段速查                                                                                           |

### 13.2 关键实现决策

- **PNG 导出 settle**：动画 autoplay 默认开启，静态 PNG 直接导出会抓到播放中间帧（如渐入首帧 opacity=0），
  `exportCanvasPng` 在 export 前对每个动画实例 `stop()`（→ endingStyle 终态），保证静态图 = 设计终态。
- **逐帧时间折算**（`seekToTime`）：视频时间 `t` → 动画内部时间 `e`：`e = t - delay`；
  `loop` 取模、`swing` 三角波折叠（奇数腿反向进度）；有限次数超出后 `e = duration`（终态）；`t < delay` 时 `e = 0`（起始态）。
  `speed` 无需处理（`seek(time)` 内部已除以 speed，参数即真实播放秒）。
- **逐帧确定性**：构建元素后 `collectAnimated` 收集全部 `el.animate()` 实例并 `pause()`，避免 autoplay rAF 在 seek 间隙推进；
  每帧先 `seek` 再 `export('png')`（POC 验证 export 会同步捕获 seek 后状态）。
- **取消链路**：渲染阶段每帧前查 `controller.signal.aborted` 抛 `CancelledError`；编码阶段 `controller.cancel()` →
  `ffmpegProc.kill()`，
  `encodeFrames` 捕获拒绝后若已 abort 转抛 `CancelledError`；帧目录清理走 `finally`（含失败/取消）。
- **遮罩淡出竞态**：`startVideoExport` 延迟 1.5s `reset()`，带状态守卫——若期间新导出已开始（rendering/encoding）则不覆盖其状态。
- **并发导出**：`begin()` 会 abort 上一任务并重建 AbortController，单例保证同一时间仅一个导出。
- **导出入口归属用户**：AI 不提供导出工具（移除 `canvas_export_video`），`startVideoExport` 由 `VideoExportContent.vue`
  在用户点击「开始导出」后调用；动画检测 `maxAnimationTime` 驱动 DesignAside 下拉菜单入口显隐。

### 13.3 与文档 §12 注意事项的对账

- 不动 v2 语义：`animation` 纯增量，无动画画布行为与现状一致；`canvas_export`（PNG）保持签名不变（内部增加 settle 步骤）。
- 图片时序：逐帧前 `waitImagesReady` 轮询 `ready` / `image.ready`，超时 5s 兜底跳过。
- 取消幂等：帧目录 `finally` 清理；`startVideoExport` 捕获 `CancelledError` 置 `cancelled` 状态，遮罩展示「已取消」。
- 遮罩不阻塞 agent 上下文：遮罩仅 UI 层，tool 结果正常回填。
- ffmpeg 参数：format 白名单（mp4/webm/gif）、fps 数值 clamp、路径走沙盒 `outputs/`（用户侧无外部路径注入）。

### 13.4 验证结论

- `pnpm check`（vue-tsc）与 `pnpm build` 均通过；
- `@leafer-in/animate@2.2.9` 已正确打进主 bundle（store chunk 含 `requestAnimate` / `playedTotalTime` 等插件特征码）；
- 浏览器 POC 全绿：自动播放、`el.animate()` 取实例、seek（含打字机 / count）、loop 折算、逐帧 export 出帧差异、 图片就绪、
  `buildDocElements` 真实管线透传 + seek（element.x 20→320）。
