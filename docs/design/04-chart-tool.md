# 图表工具（chart_generate + ECharts SSR 渲染助手）

## 功能概述

「设计创意」对话的 AI 可通过 `chart_generate` 工具生成专业数据图表并放入画布：把 echarts option
渲染成 SVG 矢量图落盘沙盒 `outputs/charts/`，返回本地路径，AI 用现有 `svg` 节点（`imageUrl`）引用。
支持 **echarts 全部内置图表类型**。

## 集成形式调研结论（为什么是 SVG 文件 + Image 元素）

- **leafer 2.x 无 SVG 元素类**：`new SVG({...})` 不存在（1.x 已移除），SVG 只能以「图片」形式经
  `Image` 元素（`url`）或图案填充加载。项目现有 `canvasRender.ts` 的 `svg` 节点分支
  （`node.svg ? Platform.toURL(...) : resolveImageHref(node.imageUrl)`）正是这条路径，`svg` 节点
  可直接接受 `imageUrl` 指向的 `.svg` 文件（本地路径自动转 file 协议）。
- **支持全部图表 = echarts SVG 渲染器（SSR 模式）**：`echarts.init(null, null, { renderer:'svg',
  ssr:true, width, height })` → `setOption({animation:false, backgroundColor:'transparent', ...})`
  → `renderToSVGString({useViewBox:true})`。SVG 渲染器与图表类型无关，全部内置图表
  （line/bar/pie/scatter/radar/funnel/gauge/heatmap/tree/treemap/sankey/graph/map/boxplot/
  candlestick/parallel/sunburst/themeRiver/pictorialBar/effectScatter/lines/custom 等）均可渲染。
- **为什么落盘文件而非返回内联字符串**：复杂图表 SVG 可达几十~上百 KB，走工具结果回传会被
  `MAX_TOOL_RESULT_BYTES` 截断、且模型需在 `canvas_batch_edit` 中回显超长字符串（token 大、易幻觉）。
  落盘返回路径与 `image_generate` / `website_logo` 模式一致，画布文档只存路径。
- **leafer 解码确认**：leafer web 平台 `loadImage` 用浏览器原生 `HTMLImageElement` 加载
  （`@leafer/web-core/src/index.ts`），Electron 的 Chromium 完整支持 zrender 输出的 `<style>`+class
  SVG，着色正常。

## 文件结构

| 文件                                                      | 角色                                                              |
|-----------------------------------------------------------|-------------------------------------------------------------------|
| `src/modules/tool/components/design/chartRender.ts`       | 纯渲染助手：`renderChartOptionToSVG(option, width, height)`，SSR → SVG 字符串；echarts 动态 import 代码分割 |
| `src/modules/tool/components/design/chartGenerate.ts`     | `chart_generate` 工具：渲染 → 落盘沙盒 `outputs/charts/chart-{ts}.svg` → 返回 path；注册 allow 策略 |
| `src/modules/tool/components/design/index.ts`             | 无条件注册工具 + re-export `renderChartOptionToSVG`（其他模块复用） |
| `src/modules/canvas/canvasPrompt.ts`                      | 图层模型速查追加 chart_generate 用法说明                           |
| `src/modules/canvas/guidelines/operations.md`             | 素材工具列表追加 chart_generate（AI 运行时读取）                   |

## API 契约

### `renderChartOptionToSVG(option: EChartsOption, width: number, height: number): Promise<string>`

- SSR 渲染，无 DOM 依赖，同步产出（await 仅首次加载 echarts 模块）。
- 强制 `animation:false` + `backgroundColor:'transparent'`（透明背景，可叠任意底色）。
- 输出 `viewBox` 定位的 SVG 字符串；echarts 全量包经动态 import 拆分 chunk，首次调用才加载。
- 依赖 echarts ≥ 5.3（本项目 6.1.0）；`import('echarts/renderers')` 副作用注册 SVG 渲染器。

### `chart_generate(option, width, height)`

| 参数     | 类型   | 必填 | 说明                                                    |
|----------|--------|------|---------------------------------------------------------|
| `option` | object | 是   | 完整 echarts option（series 等，JSON，additionalProperties 放行） |
| `width`  | number | 是   | 输出宽度 px（1~4096）                                   |
| `height` | number | 是   | 输出高度 px（1~4096）                                   |

返回：`{ success, path, width, height }`。AI 随后把 `path` 填进 `svg` 节点 `imageUrl`（或 image 节点），
并显式设置与返回值一致的 width/height。

- 策略：`risk` 默认 sensitive（有写副作用），注册 `registerToolPolicy` allow——路径由 handler 自动生成在
  沙盒 outputs/ 可信区，不接收外部路径（与 `canvas_*` 一致，默认模式免审批，计划模式仍 deny）。
- 路径：`{sandboxDir}/outputs/charts/chart-{时间戳}.svg`。

## 注意事项

- **静态限制**：leafer 按图片加载 SVG，图表无动画 / 交互 / tooltip（SSR 输出 CSS 动画也不生效）。
  需要动效时应改用文字描述需求（可另接 Canvas 元素方案，超出本工具范围）。
- **颜色固定**：SVG 内颜色是渲染时写死的值，不参与 `$token` 调色板替换（`$token` 只对 svg 节点内联
  字符串生效）。提示词要求 AI 在 option 里直接取画布调色板实色。
- **第三方扩展**：wordCloud / liquidFill 等非核心扩展不在 echarts 全量包内，需额外注册，未纳入。
- **更新数据**：重新调用 `chart_generate` 生成新文件，再 `update` 节点 `imageUrl`。
- **map 图表**：内置地图需注册 geoJSON（`echarts.registerMap`），如需中国/世界地图可按需扩展。
- **打包体积**：echarts 全量包较大，动态 import 已拆独立 chunk；若后续对体积敏感，可改
  `echarts/core` + 按需 `use()` 注册（需同时注册 SVG 渲染器）。
