# PPT 专家（ChatType: 'ppt'）：POM 库调研与实现方案

> 状态：**已实现**（Electron 迁移完成后按本文档第 10 节实施）。本文档基于对 `@hirokisakabe/pom@10.3.0` 的源码级调研写成，
> 实现时的实测差异见文末「实现记录」。
> 背景：项目已升级为最新版 Electron（不再兼容 uTools 旧内核），本方案按「升级后环境」实施；
> uTools 7.8 现状的兼容性分析仅作为决策依据保留。

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
AI (ppt_* 工具) ──写──▶ outputs/{name}.pom.xml（单一文件持续编辑，多 <Slide> 即多页）
        │ watch PptStore.current
        ▼
Node 侧（主进程或 preload）: buildPptx(xml) → convertPptxToSvg(pptx字节)   ← 零补丁直跑 POM + pptx-glimpse
        │
        ▼
{ svgs: string[] } ──IPC──▶ 渲染进程 PptRenderer.vue 以 <img> 显示（翻页/缩放）
```

- **生成 + 转换全在 Node 侧**（一次调用返回 SVG 数组），渲染进程只负责显示 —— 与 pom-cli 官方 preview 的职责拆分完全一致，icon 等全部节点可用。
- **导出（PPTX / PNG）也在主进程构建并直接落盘**：渲染进程只传 `(xml, 目标路径)`，不经手字节数组（避免主进程 → 渲染进程 → 主进程往返）。
- 备选：Node 侧只 `buildPptx` 返回 pptx 字节，渲染进程用 pptx-glimpse 的 `browser` 构建转 SVG（官方支持）—— 把渲染重活放渲染进程、可做渐进式预览；代价是渲染进程要多管理 wasm 初始化与字体 buffer。
- 第一版选「全 Node 侧」，渲染进程零新增依赖。
- 字体：POM 内置 Noto Sans JP base64 字体（`calcYogaLayout/fonts/`）作默认；中文可显示但字形偏日式，后续可映射系统字体（参考 pom-cli `glimpse.js` 的 `EXTRA_FONT_MAPPING` / `resolveBundledFontsDir`）。

## 4. 数据存储与状态（仿 design 的 CanvasStore）

- `src/modules/ppt/PptStore.ts`：按 sandboxDir 键控的全局单例（`getPptStore(sandboxDir)`，同 `CanvasStore` 模式）。
- 文件：`outputs/{name}.pom.xml`（**单一文件持续编辑**，AI 指定文件名；正则 `^(.+)\.pom\.xml$`；编辑原地写回，不产生版本文件）。
- 状态：
  - `files`：文件列表（id / name / path / updatedTime，id = 文件名）
  - `current`：当前打开的文档 `{ id, name, xml }`
  - `currentPage`：当前定位页（`ppt_select` 驱动，渲染器联动跳转）
  - `svgs`：渲染缓存（`string[]`，每页一个 SVG）+ `renderState: 'idle' | 'rendering' | 'error'`
- 自动渲染：`watch(current.xml)` → 防抖 ~500ms → Node 侧渲染 → 更新 `svgs`；渲染失败保留旧图并记录 `renderError`（AI 经 `ppt_read` 读取修正）。

## 5. 工具契约（ppt_*，第二版：单一文件持续编辑）

文件：`src/modules/tool/components/ppt/pptTools.ts`（内部工具，全部 `registerToolPolicy → 'allow'`，仅操作沙盒 outputs/）。

**契约模型**：一个 PPT = 一个文件（`outputs/{name}.pom.xml`，AI 指定文件名）。`ppt_create` 定文件名 + `<Theme>` 色板（0 页）→ `ppt_add_slide` 逐页添加 → `ppt_batch_edit` 编辑页内元素；后续编辑**原地写回**，不产生版本文件（用户要新版本时再 create 新文件）。一个文件的多个 `<Slide>` 页面对应 canvas 的「一组图片」。

| 工具 | 参数 | 说明 |
|---|---|---|
| `ppt_create` | `name`（必填）、`theme?`（token→颜色对象） | 创建文件（含 `<Theme/>`，0 页），返回文件标识；重名报错 |
| `ppt_add_slide` | `pptId?`、`elements?` | 文件末尾加页（缺省空白页），返回 **1 起始**页索引 |
| `ppt_batch_edit` | `pptId?`、`slideId`（1 起始）、`elements`（JSON 元素数组） | 替换指定页内容（整页覆盖） |
| `ppt_list` | - | 列出沙盒 outputs/ 下 PPT 文件 |
| `ppt_open` | `pptId` | 打开指定文件为当前（驱动侧边栏/渲染器切换） |
| `ppt_read` | `pptId?`、`slideId?` | 读文件全文（或指定页 `<Slide>` 片段），附渲染状态/错误 |
| `ppt_select` | `page: number`（1 起始） | 预览定位（设置 currentPage，渲染器跳转；越界给错误反馈） |
| `ppt_delete` | `pptId` | 删除文件 |
| `ppt_export_pptx` | `pptId?`、`path?` | 导出 PPTX（缺省写沙盒 outputs/） |
| `ppt_export_png` | `pptId?`、`path?`、`page?` | 导出 PNG（缺省写沙盒 outputs/，`page` 缺省导出全部页） |
| `ppt_guidelines` | `topic` | 按 topic 读取经验指南（layout / nodes / styling / pom-xml / workflow，见 03 文档） |

### 5.1 `ppt_batch_edit` 的元素数组规范（JSON 节点，TypeBox 严格校验）

- `elements` 为 **JSON 节点数组**（非 XML 字符串）：每个元素 `{ type, 属性..., children? }`，与 POM 规范一致。
- **TypeBox 严格校验**（`pptSchemas.ts`，单一数据源同时喂给模型参数描述）：type 枚举 20 种、`additionalProperties: false` 拒绝未知字段、children 递归；非法整批拒绝并返回中文错误文本反馈 AI 自纠。
- **页面根元素必须是 VStack / HStack 布局容器**（flexbox 先布局后内容）：1 个元素直接用；多个元素隐式包 VStack（对齐 parseXml 对 `<Slide>` 多子元素的语义）。
- 实现链路：`parseXml(xml)` → pages（POMNode[]）→ TypeBox 校验元素 → 组装 slide 节点 → `serializeXml(pages)` 写回（round-trip 可 parse）。
- 与 canvas 差异：canvas 是节点树粒度的增删改查（版本化文件）；PPT 是**页面式文档**，一个文件持续编辑，按页（slideId，1 起始）整页替换最自然。

## 6. UI 设计（侧边栏，完全仿设计创意）

- `src/components/chat/aside/ppt/PptAside.vue`（仿 `DesignAside.vue`）：
  - 顶部：t-select 选择 slides 文件（聊天进行中 disabled）+ 刷新 + 下拉菜单（导出 PPTX / 导出 PNG / 文件夹中显示）
- `src/components/chat/aside/ppt/PptRenderer.vue`：
  - 全屏（fullscreen）：左侧缩略图栏 + 右侧当前页大图（WPS 左右结构，点击 / hover 预览）；非全屏窄侧边栏隐藏缩略图
  - 顶部页码拖拽条（t-slider 切页）+ 页码指示；`currentPage` 变更自动滚动定位缩略图
  - SVG 用 `data:image/svg+xml` 经 `<img>` 渲染（**杜绝 v-html 脚本注入**）
- 导出：**主进程构建并直接落盘**（渲染进程只传目标路径，不经手字节）——`window.preload.ppt.exportPptx` / `exportPptxToPngs` 写沙盒 / 用户选择路径。

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

## 12. 实现记录（2026-08，实测差异与补充）

### 12.1 已落地的实现

| 项 | 说明 |
|---|---|
| 依赖 | `@hirokisakabe/pom@10.3.0` + `pptx-glimpse@3.2.8`（均 `dependencies`，主进程 externalize 后打包进 asar） |
| 主进程渲染 | `src/main/src/ppt/pptRenderer.ts`（buildPptx → SVG / PPTX 字节 / PNG）+ `src/main/src/ipc/pptIpc.ts` |
| IPC | `PptChannels`：`ppt:renderPptxToSvgs`（XML→每页 SVG）/ `ppt:exportPptx`（XML→构建 PPTX 并落盘）/ `ppt:exportPptxToPngs`（XML→指定页 PNG 并落盘，preload `window.preload.ppt`） |
| 渲染进程 | `src/renderer/src/modules/ppt/`：`PptStore.ts`（500ms 防抖自动渲染）/ `pptTypes.ts` / `pptRender.ts` / `pptPrompt.ts` / `pptGuidelines.ts` |
| 工具 | `src/renderer/src/modules/tool/components/ppt/pptTools.ts`（10 个 ppt_* 工具 + 策略：全 allow，导出工具走 `isPathUnder` 路径感知审批） |
| UI | `src/components/chat/aside/ppt/PptAside.vue` + `PptRenderer.vue`（SVG `<img>` 渲染、翻页 / 缩放 / 缩略图导航 / 自动滚动定位） |
| 注册 | `chatType.ts`（ChatType + CHAT_TYPE_OPTIONS，design 后插入，图标 `SlideshowIcon`）/ `ChatTypeConfig.ts` / `LChatAside.vue` / `LChatEngine.vue` / `SUB_AGENT_ALLOW`（ppt 无子 Agent，空数组） |
| 指南 | `docs/ppt/02-pom-xml-guide.md`（= `src/renderer/src/modules/ppt/guidelines/pom-xml.md`）+ `docs/ppt/03-ppt-experience-guides.md`（layout / nodes / styling 经验指南，`ppt_guidelines` 经 `?raw` 读取） |

### 12.2 实测差异（相对调研结论）

1. **CJS 无法 `require` POM**：`exports` 无 `require` 条件，`ERR_PACKAGE_PATH_NOT_EXPORTED`（Node 22 / 24 均如此）。
   主进程（CJS）用**动态 `import('@hirokisakabe/pom')`** 加载（走 import 条件），electron-vite 构建会保留原生 `import()`（`dynamicImportInCjs`），POC 与构建产物均已验证。
2. **`buildPptx` 只接受 XML 字符串**：源码 `buildPptx(xml)` 内部先 `parseXml(xml)`，README 中「传 POMNode 数组」的示例不成立。
3. **`parseXml` 返回「页列表」**：顶层 `<Slide>` 解析为 POMNode 数组（单子元素直接返回该节点，多子元素隐式包 `{type:'vstack'}`）；
   `serializeXml` 输出顶层即 `<Slide>`（round-trip 可 parse）——`ppt_batch_edit` 的「解析 → 操作 → 序列化写回」由此实现。
4. **Table 无 `data` / `header*` 属性**：用子元素 `<Tr><Td .../></Tr>`（`Td` 文字色属性为 `color`，非 `textColor`）；Chart 用 `<ChartSeries><ChartDataPoint label value/></ChartSeries>` 子元素（JSON 属性形式亦可，但需 `&quot;` 转义）。
5. **Theme round-trip 处理**：POM 的 `parseXml` 把 `<Theme>` 解析为色板（**不保留为节点**），`serializeXml` 写回会丢失它——`PptStore.withPages` 写回时用 `extractThemeXml` 从原文件提取 Theme 声明并**拼回文件头**（`<Theme/>` 持续有效，新提交元素的 `$token` 引用保留）；但**未被编辑的页**经 parse 写回时其 `$token` 会内联为实色（视觉等价），已写入指南提示 AI。
6. **ChatService.ts 无需改动**：`aiChatSandbox` 已对所有聊天类型统一预建 `outputs/`，满足 ppt 需求。
7. **PNG 导出**：直接用 `pptx-glimpse` 的 `convertPptxToPng`（含 resvg），无需自接 resvg-wasm。
8. **图标**：`SlideshowIcon` 在 tdesign 确认存在；`FilePptIcon` 不存在（导出 PPTX 菜单用 `FileIcon`）。

### 12.4 第二版契约调整（2026-08，用户反馈后重构）

第一版参考 canvas 的「版本化文件 + slide 粒度 ops」，不符合 PPT 实际使用（create 后通常持续编辑同一文件；一个文件多页 = canvas 的一组图片）。重构为：

1. **单一文件持续编辑**：`outputs/{name}.pom.xml`（AI 指定文件名），编辑原地写回，无版本文件；「用户要第二个版本」时再 `ppt_create` 新文件。
2. **页面元素 JSON 编辑**：`ppt_batch_edit(pptId?, slideId, elements)` —— `elements` 为 **JSON 节点数组**（非 XML 字符串），`@sinclair/typebox` 严格校验（`pptElementSchemas.ts`，20 种节点 type 枚举 + `additionalProperties: false` + children 递归），校验 schema 同时喂给模型参数描述（单一数据源，仿 canvas 的 canvasSchemas 模式）。
3. **`ppt_add_slide`** 替代原 ops 的 add/remove/move/rewrite：加页 → 编辑页（整页替换）两步走，slideId **1 起始**（与 UI 页码一致）。
4. **TypeBox 工具提取**：`toToolProperty` / `collectErrors` 提取到 `src/renderer/src/modules/tool/typeboxUtil.ts`（canvas / ppt 共用），canvasSchemas 行为不变。
5. **经验指南**：基于 POM 官方三文档（nodes / layout-system / styling-guide）转写为经验提示词（layout.md / nodes.md / styling.md），`ppt_guidelines` topics 扩展为 layout / nodes / styling / pom-xml / workflow。
6. 提示词强化：**页面根元素必须是 VStack / HStack 布局容器**（flexbox 先布局后内容）；字号分级按官方规范（标题 28-40 / 小标题 18-24 / 正文 13-16 / 注释 10-12）。
7. **设计风格支持**（与 design 同源）：新建 PPT 会话可选设计风格（PageNew 开放选择），风格在创建后锁定，水合时经 `buildDesignStylePrompt` 注入稳定 system 前缀；PPT 不接生图，跳过「正向/反向提示词」段（`withVisualPrompt: false`），只注入配色方案 / 字体规范 / 布局约束——AI 创建 PPT 时按风格色板写 `<Theme>`、按风格字体排版。

### 12.3 已知限制（第一版范围，与 §8 一致）

- SVG 经 `<img>` + data URI 渲染，无元素级点击交互；图片仅 base64 / 沙盒本地文件；无 ppt 型子 Agent。
- 渲染失败保留旧图，错误文本记录在 `PptStore.renderError`，AI 经 `ppt_read` 返回值读取自纠。
- 中文默认用 POM 内置 Noto Sans JP（字形偏日式），后续可映射系统字体（参考 pom-cli `EXTRA_FONT_MAPPING`）。
- JSON 元素暂不支持内联 runs（`<B>/<Span>` 等装饰标签），复杂装饰建议用纯文本 + 属性表达。
