# 画布动画（v3）

> 在 v2 平面设计能力之上，为画布增加 **节点动画**：AI 通过 `animation` 字段描述动效，预览自动播放。
>
> 原随附的「视频 / GIF 导出」依赖 ffmpeg 编码，已于 2026-09 随 ffmpeg 功能整体移除
> （移除范围见 `docs/app/04-ffmpeg-ppt-removal.md`）；动画数据模型与预览播放能力保留。
>
> 关键文件（已落地）：
> - 数据模型 `src/renderer/src/modules/canvas/canvasTypes.ts`（`CanvasAnimation` + `animation` / `animationOut` 字段）
> - 渲染器 `src/renderer/src/modules/canvas/canvasRender.ts`（`import '@leafer-in/animate'` + 动画属性透传 + PNG 导出
>   `settleAnimations`）
> - schema `src/renderer/src/modules/canvas/canvasSchemas.ts`（animation / animationOut 的 TypeBox 校验）
> - 依赖：`@leafer-in/animate`（与 `leafer-editor` 同版本系；注意 leafer-editor / leafer-ui 不含动画插件，须单独安装）

---

## 1. 设计目标

- **声明式动画**：动效 = 节点上的 `animation` 字段（JSON），与「AI 生成 JSON → 渲染」管线零摩擦，无需命令式动画代码。AI
  描述"标题渐入、背景光晕呼吸"即可产出动效。
- **复用 v2 渲染语义**：预览与 PNG 导出共用 `buildDocElements`，单一事实源；无动画画布行为与 v2 完全一致。

## 2. 数据模型（canvasTypes.ts）

`CanvasNode` 可选字段，`.canvas` JSON 无需 schema 升级，旧文件天然兼容（无该字段 = 无动画）：

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

// CanvasNode 上：
// animation?: CanvasAnimation        // 入场 / 过渡动画
// animationOut?: CanvasAnimation     // 出场动画（元素移除/隐藏时执行）
```

**约定**：

- `animation.style` 支持 x/y/rotation/opacity/fill/cornerRadius/scaleX/scaleY 等所有渲染属性（与节点字段同源）；
- `keyframes` 优先于 `style`（Leafer 语义：`keyframes` 数组为关键帧动画，`style` 为单目标过渡）；
- 关键帧未设 `duration` 时由 `animation.duration` 按权重自动分配（Leafer `autoDuration` 语义）；
- 输入校验：`canvasSchemas.ts` 中为 `animation` / `animationOut` 提供 TypeBox schema
  （`additionalProperties: true` 放行未知样式键，仅约束选项结构），参数描述与运行时校验一致。

## 3. 渲染层（canvasRender.ts）

### 3.1 接入动画插件

入口处导入一次：

```ts
import '@leafer-in/animate'   // 注册动画能力到 Leafer 元素
```

### 3.2 动画属性透传

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

### 3.3 预览联动（CanvasRenderer.vue）

预览组件 `buildDocElements` 复用同一构建，动画自动生效（`autoplay` 默认 true → 打开画布即可见动效）。

## 4. PNG 导出与动画 settle

动画 autoplay 默认开启，静态 PNG 直接导出会抓到播放中间帧（如渐入首帧 opacity=0）。
`exportCanvasPng` 在 export 前对每个动画实例 `stop()`（→ 终态），保证静态图 = 设计终态（`settleAnimations`）。

## 5. 注意事项

- **不动 v2 语义**：`animation` 是纯增量字段，无动画画布行为与现状完全一致；`canvas_export`（PNG）保持不变。
- **AI 侧提示**：动画提示在 `canvasPrompt.ts`（渐入 / 呼吸 / 打字机，预览自动播放）、`animation` 字段速查在
  `guidelines/operations.md`。
- **循环语义**（来自原逐帧导出 POC 实测，对理解播放行为仍有用）：`seek(time)` 定位确定；`loop` / `swing` 不自动折算周期
  （loop 取模、swing 三角波折叠）；默认缓动为快进曲线（非线性）。
