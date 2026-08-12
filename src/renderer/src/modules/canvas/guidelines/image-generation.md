# 生图与素材合成（image-generation）

> 设计时的文生图规范。核心：**省成本** —— 需要多张素材时，合并成一张 sprite 图**一次生成**，
> 再用 `image_crop` 切分成多张。1 次生图成本换取 N 个素材；裁剪在本地完成，不消耗模型额度。

## 1. 何时用 image_generate

- **无真实素材时，生图是主视觉（hero）的首选来源**：需要插画 / 合成素材 / 无真实来源的视觉元素（人物插画、抽象纹理、产品场景、
  动物形象等）时，调用 `image_generate(prompt, path?)` 生成，返回本地 path 填进 `image` 节点 `imageUrl`。
- 设计必须要有主视觉，**禁止只靠文字排版 + 色块拼出海报**——规划构图时先定主视觉来源（真实素材 → 生图 → 几何图形）再进构建，
  避免构建到一半没图可放、只能用文字填空。
- 有真实来源（logo / 品牌图 / 用户提供的图片）时**禁止生图**：优先 `website_logo` 或 `image` 操作 `web` 类型。
- 未配置默认生图模型（`image_generate` 工具不可用）时：回退 `stock` / `placeholder` 占位，
  或明确请用户提供素材；禁止编造图片 URL、禁止硬画近似品牌内容。

## 2. 省成本铁律：多素材拼一张 sprite 一次生成

**同一设计需要 ≥2 个生图素材时，绝不分开多次生成。**

1. **规划整张 sprite 图**：把需要的素材放进一张图，按**统一网格**排列（如 3×2、2×2）。
2. **一次 `image_generate`** 生成整张 sprite，prompt 里写清：
   - 整体布局：`a {cols}x{rows} grid of ...`
   - 每个格子独立描述：`Cell 1: ...; Cell 2: ...`（从左到右、从上到下编号）
   - 统一风格前缀（材质 / 配色 / 光照 / 视角 / 风格词），保证各格风格一致
   - 格子之间留**均匀间距**（建议 16~32px 留白）便于裁剪；背景统一**纯白**（便于 image_remove_background 去背景）
3. **切分**：用 `image_crop(path, { grid: { cols, rows, gap } })` 按网格切成多张 PNG；
   留白间距等于 gap 时用 `grid` 等分即可；间距不齐时用 `regions` 显式给出每个格子区域。
4. 把每张裁剪结果的 `path` 分别填进画布中对应的 `image` 节点。

> 记忆点：**1 次生成 = N 个素材**。生图只产出素材，构图与文字交给画布
> （禁止把整张海报交给生图模型——文字与排版不可控，且多轮返工更贵）。

## 3. sprite prompt 模板

```
A [统一风格] set of [数量] [主题] arranged in a {cols}×{rows} uniform grid on a solid white background,
with even spacing between cells.
Cell 1: [具体内容 A]
Cell 2: [具体内容 B]
...（每个格子依次描述）
Consistent [材质 / 配色 / 光照], same perspective, no text, no watermark.
```

示例（天气图标素材）：

```
A flat illustration set of 4 weather icons arranged in a 2x2 uniform grid on solid white background,
with even spacing.
Cell 1: bright yellow sun with soft rays
Cell 2: blue rain cloud with raindrops
Cell 3: gray snow cloud with snowflakes
Cell 4: gray cloud with lightning bolt
Consistent flat vector style, muted colors, rounded corners, no text.
```

## 4. 切分与使用

- `grid` 等分：`image_crop(path, { grid: { cols: 2, rows: 2, gap: 20 } })` —— 留白 20px 时 gap 传 20。
- `regions` 精确：`image_crop(path, { regions: [{ x, y, width, height }, ...] })` —— 间距不齐 / 局部裁剪时用。
- 切分返回 `images: [{ index, path, width, height }]`；把每个 `path` 填进 `image` 节点 `imageUrl`，
  用返回的 `width/height`（或 `image_info(path)`）设置节点尺寸，禁止猜尺寸。

## 5. 边界与回退

- 生图失败 / 服务未就绪（`image_generate` 返回 error）→ 如实告知用户，回退 `stock` / `placeholder`
  或请用户提供素材，不反复重试无意义的生图。
- 只需单个素材 → 直接 `image_generate` 一次即可，无需 sprite。
- **生图不支持真透明**：`image_generate` 产物必带不透明背景色（多为白底），prompt 写 `transparent background`
  模型也产不出真透明。需要透明底素材时：先用 `image_remove_background(path)` 去除背景（从边缘清除连续白底，
  产出带 alpha 的 PNG），再把去背景后的 path 填进画布 `image` 节点——禁止把带白底的图直接盖在深色 / 彩色背景上。
- sprite 图背景建议用**纯白**（非渐变、非透明区域穿插）：白色最易被去背景工具干净清除；若必须用 `regions`
  精确裁剪，让格子之间**不留间隙**（gap 传 0），避免切割线裁到主体。
