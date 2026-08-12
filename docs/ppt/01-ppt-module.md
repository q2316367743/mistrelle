# PPT 专家（ChatType: 'ppt'）：POM 库调研与实现方案

> 状态：**方案文档（待实现）**。本文档基于对 `@hirokisakabe/pom@10.3.0` 的源码级调研写成。
> 背景：项目计划升级为最新版 Electron（不再兼容 uTools 旧内核），因此本方案以「升级后环境」为主，
> 同时保留 uTools 7.8 现状的兼容性分析作为决策依据。

---

## 1. 背景与目标

- 在「设计创意」（`design`，Leafer 画布做海报）之后新增第 4 种聊天类型 **「PPT 专家」**（`ppt`）：AI 通过声明式 XML 直接设计 PPT。
- 选中库：**POM**（`@hirokisakabe/pom`，https://pom.pptx.app ），声明式 XML → 原生可编辑 PPTX，专为 AI 场景设计。
- 页面形态完全参考设计创意：聊天主界面 + 自定义侧边栏（选择 PPT 文件 + 实时预览渲染）。

## 2. POM 库调研结论

### 2.1 库是什么

- 声明式 XML 描述幻灯片：`<Slide>` / `<VStack>` / `<HStack>` / `<Text>` / `<Shape>` / `<Icon>` / `<Chart>` / `<Table>` / `<Timeline>` / `<Flow>` / `<Image>` / `<Svg>` 等 **20 种内置节点**，flexbox 式布局（VStack/HStack，底层 yoga-layout）。
- 核心 API（ESM）：

```ts
import { buildPptx, parseXml, serializeXml } from '@hirokisakabe/pom'
const { pptx, diagnostics } = await buildPptx(xml, { w: 1280, h: 720 })
await pptx.writeFile({ fileName: 'presentation.pptx' }) // 或 write('arraybuffer' | 'base64' | ...)
```

- 产出真实可编辑的 PPTX 形状（非图片），接收方可继续编辑。
- MIT 协议。版本：10.3.0（2026 年仍在活跃迭代，注意锁定版本）。

### 2.2 依赖与运行要求

依赖全部为纯 JS / WASM，**无 native 二进制**：

| 依赖 | 用途 | 浏览器友好性 |
|---|---|---|
| `yoga-layout@3.2.1` | flexbox 布局（wasm） | ✅ bundler 友好（`yoga-layout/load`） |
| `@resvg/resvg-wasm@^2.6.2` | SVG → PNG（渲染 icon / svg 节点） | ⚠️ POM 内部用 Node-only 加载器，见 §2.4 |
| `jszip` / `fast-xml-parser` / `zod` / `opentype.js` / `image-size` / `@pptx-glimpse/document` | 打包 / 解析 / 校验 / 字体 / 图片尺寸 | ✅ |

运行要求：
- **`engines: node >= 22`**（Node 22 硬性声明）
- **ESM-only**：`exports` 只有 `import` 条件，**无 CJS 构建**；另有子路径 `@hirokisakabe/pom/clientApi`（仅聚合导出 `parseXml` / `serializeXml` / `ParseXmlError`，环境无关）。
- `buildPptx` 本身不碰文件系统，`pptx.write()` 支持 `arraybuffer / base64 / blob / nodebuffer` 等输出类型（浏览器可用 Blob 分支）。

### 2.3 官方预览链路（重要：不存在「XML → HTML」渲染器）

- 常见直觉是「声明式 XML 很容易直接渲染成 HTML 预览」——**POM 没有提供 XML→HTML 渲染器**，源码中无任何 render-to-html 模块。
- 官方 preview（`pom preview`，localhost:3000 live 预览）的真实链路是：

```
pom XML → buildPptx() → PPTX 字节 → convertPptxToSvg()（pptx-glimpse 库）→ 每页一个 SVG 字符串
```

- `pptx-glimpse@3.2.8` 是 PPTX → SVG/PNG 的转换库，`exports` 带 **`browser` 条件**（`dist/browser.js`，官方支持浏览器端，resvg 走浏览器版 `initWasm`）。
- 结论：**回显 = 镜像官方 preview 架构**：生成 PPTX（Node 侧）→ 转 SVG → 渲染进程直接显示 SVG。所见即所得，效果与官方 Playground 一致。

### 2.4 渲染进程（浏览器）直跑 `buildPptx` 的三个卡点

即便纯 JS+WASM，源码级扫描发现 3 处 Node API 泄漏，**浏览器直跑不可行或需打补丁**：

| # | 文件 | 问题 |
|---|---|---|
| 1 | `shared/measureImage.js`、`renderPptx/utils/glimpsePicture.js` | **静态 `import * as fs from 'fs'`**（Vite externalize 成空桩）；`Buffer.from` 无保护使用（需 polyfill） |
| 2 | `icons/renderIcon.js` | resvg wasm 加载是 **Node-only**：`import('node:module')`(createRequire) + `require.resolve('@resvg/resvg-wasm/index_bg.wasm')` |
| 3 | `renderPptx/writablePptx.js` | `writeFile()` 里 `await import('node:fs/promises')`（浏览器分支走 downloadInBrowser，可避开） |

其中 **#2 是硬伤**：`registry/definitions/icon.js` 在**布局阶段**就调用 `rasterizeIcon()`，任何含 `<Icon>` 节点的 deck 在浏览器必然抛错（动态 `import('node:module')` 无解）。而 icon 是 POM 的核心卖点（内置 lucide 图标库），AI 生成 PPT 大概率使用 → **生成侧必须放 Node 环境**。

> 例外：若 deck 完全不用 `<Icon>` / `<Svg>` 节点、图片只用 base64，浏览器可跑（仍需 Buffer polyfill + fs 桩），但功能阉割 + 依赖 patch，不值得。

## 3. 运行环境分析：uTools 旧内核 vs 升级 Electron

### 3.1 uTools 7.8 现状（本次升级前必须知道的坑）

- uTools 7.8.0 实际运行时：**Electron 22.3.27 → Node 16.17.0 / Chromium 108**（对安装包二进制的分析确认；官方 preload 文档亦写 Node 16.x）。
- 与 POM 的冲突：
  - `engines >= 22`：npm 只警告不拦截，但属「文档不承诺」状态；逐文件扫描 dist 未发现 Node 22 特有 API（V8 10.8 语法可解析），**大概率可跑但需 POC 实测**。
  - Node 16 **无全局 fetch**：仅 `measureImage` 对 http(s) 图片测尺寸时用到 → 需 prompt 约束 AI 只用 base64 / 本地文件图片。
  - preload 必须是 CommonJS，而 POM 是 ESM-only → 需 esbuild 打成 CJS bundle（`--target=node16`）+ 处理 resvg wasm 文件分发（`index_bg.wasm` 复制 + shim `require.resolve`）。
- 上述三个补丁全部在「升级 Electron」后消失（见下）。

### 3.2 升级 Electron 后的简化点

| 项 | uTools 7.8（旧） | Electron 最新版（新） |
|---|---|---|
| Node 版本 | 16.17 | ≥ 22（满足 POM engines） |
| 模块系统 | preload 必须 CJS | preload 支持 ESM；主进程 / Node 侧原生 ESM |
| fetch | 无 | ✅ 原生 |
| POM 部署 | esbuild CJS bundle + wasm shim | **直接 npm 依赖**，无需任何打包补丁 |

### 3.3 推荐架构（升级后）

```
AI (ppt_* 工具) ──写──▶ outputs/slides-{version}.pom.xml
        │ watch PptStore.current
        ▼
Node 侧（主进程或 preload）: buildPptx(xml) → convertPptxToSvg(pptx字节)   ← 零补丁直跑 POM + pptx-glimpse
        │
        ▼
{ svgs: string[] } ──IPC──▶ 渲染进程 PptRenderer.vue 以 <img> 显示（翻页/缩放）
```

- **生成 + 转换全在 Node 侧**（一次调用返回 SVG 数组），渲染进程只负责显示 —— 与 pom-cli 官方 preview 的职责拆分完全一致，icon 等全部节点可用。
- 备选：Node 侧只 `buildPptx` 返回 pptx 字节，渲染进程用 pptx-glimpse 的 `browser` 构建转 SVG（官方支持）—— 把渲染重活放渲染进程、可做渐进式预览；代价是渲染进程要多管理 wasm 初始化与字体 buffer。
- 第一版选「全 Node 侧」，渲染进程零新增依赖。
- 字体：POM 内置 Noto Sans JP base64 字体（`calcYogaLayout/fonts/`）作默认；中文可显示但字形偏日式，后续可映射系统字体（参考 pom-cli `glimpse.js` 的 `EXTRA_FONT_MAPPING` / `resolveBundledFontsDir`）。

## 4. 数据存储与状态（仿 design 的 CanvasStore）

- `src/modules/ppt/PptStore.ts`：按 sandboxDir 键控的全局单例（`getPptStore(sandboxDir)`，同 `CanvasStore` 模式）。
- 文件：`outputs/slides-{version}.pom.xml`（版本化，正则 `^slides-(\d+)\.pom\.xml$`）。
- 状态：
  - `files`：版本文件列表（version / name / path / updatedTime）
  - `current`：当前打开的文档 `{ version, xml, name }`
  - `currentPage`：当前定位页（`ppt_select` 驱动，渲染器联动跳转）
  - `svgs`：渲染缓存（`string[]`，每页一个 SVG）+ `renderState: 'idle' | 'rendering' | 'error'`
- 自动渲染：`watch(current.xml)` → 防抖 ~500ms → Node 侧渲染 → 更新 `svgs`；渲染失败保留旧图并 console 报错（AI 可通过工具读错误修正）。

## 5. 工具契约（ppt_*，参考 canvas 工具形态）

文件：`src/modules/tool/components/ppt/pptTools.ts`（内部工具，全部 `registerToolPolicy → 'allow'`，仅操作沙盒 outputs/）。

| 工具 | 参数 | 说明 |
|---|---|---|
| `ppt_list` | - | 列出沙盒 outputs/ 下 slides 版本文件 |
| `ppt_read` | `version?` | 读取当前（或缺省最新）版本的 pom xml |
| `ppt_create` | `title?` | 创建新 PPT（生成初始 XML 骨架） |
| `ppt_open` | `version` | 打开指定版本（设置 current，驱动侧边栏/渲染器切换） |
| `ppt_select` | `page: number` | 打开指定页面（设置 currentPage，渲染器跳转；越界给错误反馈） |
| `ppt_delete` | `version` | 删除版本 |
| `ppt_batch_edit` | `ops: PptBatchOp[]` | 批量编辑（slide 粒度，见下） |
| `ppt_export_pptx` | `path?` | 导出 PPTX（缺省写沙盒 outputs/） |
| `ppt_export_png` | `path?`, `page?` | 导出 PNG（缺省写沙盒 outputs/，`page` 缺省导出全部页） |
| `ppt_guidelines` | `topic` | 按 topic 读取 POM XML 语法指南（`docs/ppt/02-pom-xml-guide.md`） |

### 5.1 `ppt_batch_edit` 的 ops 定义（slide 粒度，对齐 canvas_batch_edit 的「批量操作数组 + 校验」精神）

```ts
type PptBatchOp =
  | { op: 'add'; at?: number; xml: string }        // 插入新页（缺省追加到末尾）
  | { op: 'update'; index: number; xml: string }   // 替换指定页
  | { op: 'remove'; index: number }                // 删除页
  | { op: 'move'; from: number; to: number }       // 调整页序
  | { op: 'rewrite'; xml: string }                 // 全量重写（兜底）
```

- 实现：`parseXml(xml)` 解析为 slide 列表 → 按 index 定位 → apply ops（**同批校验**，任一失败整体回滚）→ `serializeXml` 写回新版本文件。
- 每个 `xml` 片段用 `parseXml` 校验，`DiagnosticsError` 的完整错误文本反馈给 AI 自行修正。
- 与 canvas 差异：canvas 是节点树粒度的增删改查；PPT 是**页面式文档**，按 slide 粒度编辑最自然（AI 只需重写目标页而非整个文档），`rewrite` 兜底全量。

## 6. UI 设计（侧边栏，完全仿设计创意）

- `src/components/chat/aside/ppt/PptAside.vue`（仿 `DesignAside.vue`）：
  - 顶部：t-select 选择 slides 文件（聊天进行中 disabled）+ 刷新 + 下拉菜单（导出 PPTX / 导出 PNG / 文件夹中显示）
- `src/components/chat/aside/ppt/PptRenderer.vue`：
  - SVG 页面列表 + 上一页/下一页 + 缩放（t-slider）+ 缩略图导航（t-popup 悬停预览）
  - `currentPage` 变更自动滚动定位到对应页
  - SVG 用 `data:image/svg+xml` 经 `<img>` 渲染（**杜绝 v-html 脚本注入**）
- 导出：`window.preload.fs.writeBinaryFile` 写沙盒 / 用户选择路径。

## 7. 注册链路与改动文件清单

表驱动注册，无需改 AgentChat 逻辑：

| 层 | 文件 | 动作 |
|---|---|---|
| 类型 | `src/modules/chat/chatType.ts` | `ChatType` 加 `'ppt'`；`CHAT_TYPE_OPTIONS` 在 design 后插入「PPT 专家」（图标 `SlideshowIcon`，tdesign 已确认存在） |
| 配置 | `src/global/ChatTypeConfig.ts` | `CHAT_TYPE_CONFIG` 加 `ppt: { label, prompt, tools }` |
| 提示词 | `src/modules/ppt/pptPrompt.ts` | PPT 专家提示词 + POM XML 语法精要（16:9 画布、字号层级/留白/对齐铁律、禁止 http 图片） |
| 工具 | `src/modules/tool/components/ppt/pptTools.ts` | §5 工具集 + `PPT_TOOL_NAMES` + 安全策略 |
| 状态 | `src/modules/ppt/PptStore.ts` | §4 |
| 侧边栏 | `src/components/chat/aside/LChatAside.vue` | 加 `v-else-if="type === 'ppt'"` → `PptAside` |
| 展开 | `src/components/chat/LChatEngine.vue` | asideType 自动展开数组加 `'ppt'` |
| 沙盒 | `src/modules/chat/service/ChatService.ts` | `aiChatSandbox` 为 ppt 预建 `outputs/` |
| 渲染 | `src/modules/ppt/pptRender.ts` | 封装 Node 侧渲染调用（IPC），类型声明 |
| 文档 | `docs/ppt/02-pom-xml-guide.md` | AI 用 XML 语法指南（`ppt_guidelines` 读取） |

## 8. 第一版范围声明（明确不做）

- ❌ **点击元素选择元素**：不做点击/双击 SVG 元素向输入框注入引用（SVG 用 `<img>` 渲染本就无 DOM 交互）。后续如需，需改 v-html/iframe 渲染 + 绑定事件（参考 design 的 `canvasNodeBridge`）。
- ❌ **高级设计类 tool**：不接生图 `image_generate`、素材 `icon_svg` / `website_logo`、字体 `font_*`；AI 仅用 POM 内置 lucide 图标、形状、图表、表格节点。图片仅允许 base64 / 沙盒本地文件。
- ❌ **子 Agent（`SUB_AGENT_ALLOW`）**：不加 ppt 型子 Agent，主 Agent 直用。

## 9. 风险与待验证项

- **POC 必做**（实现第一步）：Node ≥ 22 环境装 POM + pptx-glimpse，跑通含 `<Icon>`/`<Chart>` 的 XML → `buildPptx` → `convertPptxToSvg` → SVG 输出；确认 resvg wasm 加载与字体默认值。
- 锁定 POM 版本（活跃迭代中，升级需回归）。
- http(s) 图片：Node 侧 `measureImage` 用 fetch（Node 22 有原生 fetch），但跨域/网络失败会兜底 1x1 占位 → prompt 仍建议 base64 / 本地文件。
- 字体：内置 Noto Sans JP 中文可显示但字形偏日式；后续映射系统字体。

## 10. 实施步骤（升级 Electron 完成后）

1. **POC**：Node 侧跑通「XML → PPTX → SVG」全链路（含 icon）。
2. Node 侧封装：`pptRender.ts`（IPC 暴露 `renderPptxToSvgs(xml, { w, h }) → Promise<string[]>`）。
3. `PptStore.ts` + `PptRenderer.vue` + `PptAside.vue`。
4. `pptTools.ts`（含 `ppt_batch_edit` ops 实现与校验）+ `pptPrompt.ts`。
5. 注册链路 7 处改动。
6. `docs/ppt/02-pom-xml-guide.md`（AI 指南）+ 本方案文档转「已实现」状态。

## 11. 参考资料

- POM 官网：https://pom.pptx.app （Requires Node.js 22+ / MIT）
- 仓库：https://github.com/hirokisakabe/pom （monorepo：pom / pom-cli / pom-md / pom-jsx / pom-editor）
- `@hirokisakabe/pom@10.3.0`（unpkg 源码扫描）、`@hirokisakabe/pom-cli@0.10.0`（preview 链路）、`pptx-glimpse@3.2.8`（browser 构建）
- uTools 7.8.0 运行时：Electron 22.3.27 / Node 16.17（本机安装包二进制分析 + 官方 preload 文档）
