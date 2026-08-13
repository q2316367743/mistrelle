# PPT 专家（ChatType: 'ppt'）：POM 库调研与实现方案

> 状态： **已实现**（Electron 迁移完成后按本文档第 10 节实施）。本文档基于对 `@hirokisakabe/pom@10.3.0` 的源码级调研写成，
> 实现时的实测差异见文末「实现记录」。
> 背景：项目已升级为最新版 Electron（不再兼容 uTools 旧内核），本方案按「升级后环境」实施；
> uTools 7.8 现状的兼容性分析仅作为决策依据保留。

---

## 1. 背景与目标

- 在「设计创意」（`design`，Leafer 画布做海报）之后新增第 4 种聊天类型 **「PPT 专家」**（`ppt`）：AI 通过声明式 XML 直接设计 PPT。
- 选中库： **POM**（`@hirokisakabe/pom`，https://pom.pptx.app ），声明式 XML → 原生可编辑 PPTX，专为 AI 场景设计。
- 页面形态完全参考设计创意：聊天主界面 + 自定义侧边栏（选择 PPT 文件 + 实时预览渲染）。

## 2. POM 库调研结论

### 2.1 库是什么

- 声明式 XML 描述幻灯片：`<Slide>` / `<VStack>` / `<HStack>` / `<Text>` / `<Shape>` / `<Icon>` / `<Chart>` / `<Table>` /
  `<Timeline>` / `<Flow>` / `<Image>` / `<Svg>` 等 **20 种内置节点**，flexbox 式布局（VStack/HStack，底层 yoga-layout）。
- 核心 API（ESM）：

```ts
import {buildPptx, parseXml, serializeXml} from '@hirokisakabe/pom'

const {pptx, diagnostics} = await buildPptx(xml, {w: 1280, h: 720})
await pptx.writeFile({fileName: 'presentation.pptx'}) // 或 write('arraybuffer' | 'base64' | ...)
```

- 产出真实可编辑的 PPTX 形状（非图片），接收方可继续编辑。
- MIT 协议。版本：10.3.0（2026 年仍在活跃迭代，注意锁定版本）。

### 2.2 依赖与运行要求

依赖全部为纯 JS / WASM， **无 native 二进制**：

| 依赖                                                                                          | 用途                                 | 浏览器友好性                            |
|-----------------------------------------------------------------------------------------------|--------------------------------------|-----------------------------------------|
| `yoga-layout@3.2.1`                                                                           | flexbox 布局（wasm）                 | ✅ bundler 友好（`yoga-layout/load`）   |
| `@resvg/resvg-wasm@^2.6.2`                                                                    | SVG → PNG（渲染 icon / svg 节点）    | ⚠️ POM 内部用 Node-only 加载器，见 §2.4 |
| `jszip` / `fast-xml-parser` / `zod` / `opentype.js` / `image-size` / `@pptx-glimpse/document` | 打包 / 解析 / 校验 / 字体 / 图片尺寸 | ✅                                      |

运行要求：

- **`engines: node >= 22`**（Node 22 硬性声明）
- **ESM-only**：`exports` 只有 `import` 条件， **无 CJS 构建**；另有子路径 `@hirokisakabe/pom/clientApi`（仅聚合导出
  `parseXml` / `serializeXml` / `ParseXmlError`，环境无关）。
- `buildPptx` 本身不碰文件系统，`pptx.write()` 支持 `arraybuffer / base64 / blob / nodebuffer` 等输出类型（浏览器可用 Blob
  分支）。

### 2.3 官方预览链路（重要：不存在「XML → HTML」渲染器）

- 常见直觉是「声明式 XML 很容易直接渲染成 HTML 预览」—— **POM 没有提供 XML→HTML 渲染器**，源码中无任何 render-to-html 模块。
- 官方 preview（`pom preview`，localhost:3000 live 预览）的真实链路是：

```
pom XML → buildPptx() → PPTX 字节 → convertPptxToSvg()（pptx-glimpse 库）→ 每页一个 SVG 字符串
```

- `pptx-glimpse@3.2.8` 是 PPTX → SVG/PNG 的转换库，`exports` 带 **`browser` 条件**（`dist/browser.js`，官方支持浏览器端，resvg
  走浏览器版 `initWasm`）。
- 结论： **回显 = 镜像官方 preview 架构**：生成 PPTX（Node 侧）→ 转 SVG → 渲染进程直接显示 SVG。所见即所得，效果与官方
  Playground 一致。

### 2.4 渲染进程（浏览器）直跑 `buildPptx` 的三个卡点

即便纯 JS+WASM，源码级扫描发现 3 处 Node API 泄漏， **浏览器直跑不可行或需打补丁**：

| # | 文件                                                           | 问题                                                                                                                           |
|---|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| 1 | `shared/measureImage.js`、`renderPptx/utils/glimpsePicture.js` | **静态 `import * as fs from 'fs'`**（Vite externalize 成空桩）；`Buffer.from` 无保护使用（需 polyfill）                        |
| 2 | `icons/renderIcon.js`                                          | resvg wasm 加载是 **Node-only**：`import('node:module')`(createRequire) + `require.resolve('@resvg/resvg-wasm/index_bg.wasm')` |
| 3 | `renderPptx/writablePptx.js`                                   | `writeFile()` 里 `await import('node:fs/promises')`（浏览器分支走 downloadInBrowser，可避开）                                  |

其中 **#2 是硬伤**：`registry/definitions/icon.js` 在 **布局阶段**就调用 `rasterizeIcon()`，任何含 `<Icon>` 节点的 deck
在浏览器必然抛错（动态 `import('node:module')` 无解）。而 icon 是 POM 的核心卖点（内置 lucide 图标库），AI 生成 PPT
大概率使用 → **生成侧必须放 Node 环境**。

> 例外：若 deck 完全不用 `<Icon>` / `<Svg>` 节点、图片只用 base64，浏览器可跑（仍需 Buffer polyfill + fs 桩），但功能阉割 + 依赖
> patch，不值得。

## 3. 运行环境分析：uTools 旧内核 vs 升级 Electron

### 3.1 uTools 7.8 现状（本次升级前必须知道的坑）

- uTools 7.8.0 实际运行时： **Electron 22.3.27 → Node 16.17.0 / Chromium 108**（对安装包二进制的分析确认；官方 preload 文档亦写
  Node 16.x）。
- 与 POM 的冲突：
  - `engines >= 22`：npm 只警告不拦截，但属「文档不承诺」状态；逐文件扫描 dist 未发现 Node 22 特有 API（V8 10.8 语法可解析），
    **大概率可跑但需 POC 实测**。
  - Node 16 **无全局 fetch**：仅 `measureImage` 对 http (s) 图片测尺寸时用到 → 需 prompt 约束 AI 只用 base64 / 本地文件图片。
  - preload 必须是 CommonJS，而 POM 是 ESM-only → 需 esbuild 打成 CJS bundle（`--target=node16`）+ 处理 resvg wasm 文件分发（
    `index_bg.wasm` 复制 + shim `require.resolve`）。
- 上述三个补丁全部在「升级 Electron」后消失（见下）。

### 3.2 升级 Electron 后的简化点

| 项        | uTools 7.8（旧）               | Electron 最新版（新）                      |
|-----------|--------------------------------|--------------------------------------------|
| Node 版本 | 16.17                          | ≥ 22（满足 POM engines）                   |
| 模块系统  | preload 必须 CJS               | preload 支持 ESM；主进程 / Node 侧原生 ESM |
| fetch     | 无                             | ✅ 原生                                    |
| POM 部署  | esbuild CJS bundle + wasm shim | **直接 npm 依赖**，无需任何打包补丁        |

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

- **生成 + 转换全在 Node 侧**（一次调用返回 SVG 数组），渲染进程只负责显示 —— 与 pom-cli 官方 preview 的职责拆分完全一致，icon
  等全部节点可用。
- **导出（PPTX / PNG）也在主进程构建并直接落盘**：渲染进程只传 `(xml, 目标路径)`，不经手字节数组（避免主进程 → 渲染进程 →
  主进程往返）。
- 备选：Node 侧只 `buildPptx` 返回 pptx 字节，渲染进程用 pptx-glimpse 的 `browser` 构建转 SVG（官方支持）——
  把渲染重活放渲染进程、可做渐进式预览；代价是渲染进程要多管理 wasm 初始化与字体 buffer。
- 第一版选「全 Node 侧」，渲染进程零新增依赖。
- 字体：POM 内置 Noto Sans JP base64 字体（`calcYogaLayout/fonts/`）作默认；中文可显示但字形偏日式，后续可映射系统字体（参考
  pom-cli `glimpse.js` 的 `EXTRA_FONT_MAPPING` / `resolveBundledFontsDir`）。

## 4. 数据存储与状态（仿 design 的 CanvasStore）

- `src/modules/ppt/PptStore.ts`：按 sandboxDir 键控的全局单例（`getPptStore(sandboxDir)`，同 `CanvasStore` 模式）。
- 文件：`outputs/{name}.ppt.json`（ **单一文件持续编辑**，AI 指定文件名；正则 `^(.+)\.ppt\.json$`；编辑原地写回，不产生版本文件）。
- **全程 JSON（SlideNode）**：渲染进程不涉及任何 xml，仅在导出时由主进程转换为 POM XML（见 12.5 第三版契约）。
- 状态：
  - `files`：文件列表（id / name / path / updatedTime，id = 文件名）
  - `current`：当前打开的文档 `{ id, name, json }`（json 为 `PptJsonDoc`，见 12.5 契约）
  - `currentPage`：当前定位页（`ppt_select` 驱动，渲染器联动跳转）
  - `svgs`：渲染缓存（`string[]`，每页一个 SVG）+ `renderState: 'idle' | 'rendering' | 'error'`
- 自动渲染：`watch(current.json)` → 防抖 ~500ms → 主进程（json→xml 转换 + buildPptx）渲染 → 更新 `svgs`；渲染失败保留旧图并记录
  `renderError`（AI 经 `ppt_info` / `ppt_get_nodes` 读取修正）。

## 5. 工具契约（ppt_*，第四版：元素级批量操作）

文件：`src/modules/tool/components/ppt/pptTools.ts`（内部工具，全部 `registerToolPolicy → 'allow'`，仅操作沙盒 outputs/）。

**契约模型**：一个 PPT = 一个文件（`outputs/{name}.ppt.json`，AI 指定文件名）。`ppt_create` 定文件名 + `theme` 色板 +
初始页数（slideCount，slide 放对应数量空页）→ `ppt_add_slide` 加页 / `ppt_delete_slide` 删页 → `ppt_batch_edit` 对指定页做
**元素级批量操作**（仿 canvas canvas_batch_edit）；后续编辑 **原地写回**，不产生版本文件（用户要新版本时再 create
新文件）。一个文件的多个 slide 页面对应 canvas 的「一组图片」。

| 工具               | 参数                                              | 说明                                                                                  |
|--------------------|---------------------------------------------------|---------------------------------------------------------------------------------------|
| `ppt_create`       | `name`（必填）、`theme?`、`slideCount?`           | 创建文件（含 theme 色板，slide 放 slideCount 个空页，缺省 1），返回文件标识；重名报错 |
| `ppt_info`         | `pptId`（必填）                                   | 文档级信息：id / name / 页数 / theme + 渲染状态 / 错误                                |
| `ppt_open`         | `pptId`（必填）                                   | 打开指定文件为当前（驱动侧边栏/渲染器切换）                                           |
| `ppt_get_nodes`    | `pptId`、`slideId`（必填）、`ids?`                | 指定页完整元素树（含节点顶层 id）+ theme + 渲染状态；`ids` 只返回命中节点（保留祖先） |
| `ppt_batch_edit`   | `pptId`、`slideId`（1 起始）、`operations`（≤15） | 对指定页做元素级批量操作（insert / copy / update / move / delete，单操作容错）        |
| `ppt_add_slide`    | `pptId`（必填）                                   | 文件末尾加空白页，返回 **1 起始**页索引与总页数                                       |
| `ppt_delete_slide` | `pptId`、`slideId`（必填）                        | 删除一页（不可恢复），返回总页数                                                      |
| `ppt_set_theme`    | `pptId`、`theme`（必填）                          | 更新全局 theme 令牌（canvas_set_palette 类比），$token 全篇联动换肤                   |
| `ppt_list`         | -                                                 | 列出沙盒 outputs/ 下 PPT 文件                                                         |
| `ppt_select`       | `page: number`（1 起始）                          | 预览定位（设置 currentPage，渲染器跳转；越界给错误反馈）                              |
| `ppt_delete`       | `pptId`                                           | 删除文件                                                                              |
| `ppt_export_pptx`  | `pptId?`、`path?`                                 | 导出 PPTX（缺省写沙盒 outputs/）                                                      |
| `ppt_export_png`   | `pptId?`、`path?`、`page?`                        | 导出 PNG（缺省写沙盒 outputs/，`page` 缺省导出全部页）                                |
| `ppt_guidelines`   | `topic`                                           | 按 topic 读取经验指南（operations / layout / nodes / styling / json / workflow）      |

### 5.1 `ppt_batch_edit` 的批量操作规范（仿 canvas，元素级增删改查）

- `operations` 为操作数组（ **1-15 个/批，硬性上限**——元素过多 AI 生成的 JSON 容易出错），按顺序执行：
  - `insert`：`{op, as?, parent: "root"/容器id/"@绑定名", node: SlideNode}` —— 插入页根或容器子元素
  - `copy`：`{op, as?, id, parent, overrides?: {attr?, text?}}` —— 深拷贝节点（子树 id 重生成）
  - `update`：`{op, id, patch: {attr?, text?, child?}}` —— 按节点 id 精准编辑（attr 点表示法合并 / text 覆盖 / child 替换）
  - `move`：`{op, id, parent?, index?}` —— 移动 / 重排（可跨容器）
  - `delete`：`{op, id}` —— 删除节点（含子树）
- **as 绑定名**：同批内 `insert` / `copy` 可声明，后续 op 用 `parent:"@绑定名"` 引用刚创建的节点（搭层级用）；仅本批有效。
- **TypeBox 严格校验**（`pptSchemas.ts` 的 `pptBatchOpSchemaT`，单一数据源同时喂给模型参数描述）：op 判别联合、attr
  `additionalProperties: false` 拒绝未知字段、node 递归校验； **单操作非法只让该操作失败**（错误写入返回的 `results`
  ），其余照常执行并整体落盘。
- **页面根元素必须是 VStack / HStack 布局容器**（flexbox 先布局后内容）：一页 = SlideNode 数组，导出时包进 `<Slide>`。
- 实现链路：JSON 读文件 → 逐 op 校验执行（`pptBatchOps.ts` 纯页面逻辑，仿 canvas `CanvasStore.batchEdit`）→ JSON 写回（ **无
  xml round-trip**）。
- 与 canvas 差异：canvas 的 batch 是「节点树 + 版本化文件」；PPT 的 batch 是「单页元素 + 单一文件持续编辑」，op 语义一致（都按
  id 增删改查）。

## 6. UI 设计（侧边栏，完全仿设计创意）

- `src/components/chat/aside/ppt/PptAside.vue`（仿 `DesignAside.vue`）：
  - 顶部：t-select 选择 slides 文件（聊天进行中 disabled）+ 刷新 + 下拉菜单（导出 PPTX / 导出 PNG / 文件夹中显示）
- `src/components/chat/aside/ppt/PptRenderer.vue`：
  - 全屏（fullscreen）：左侧缩略图栏 + 右侧当前页大图（WPS 左右结构，点击 / hover 预览）；非全屏窄侧边栏隐藏缩略图
  - 顶部页码拖拽条（t-slider 切页）+ 页码指示；`currentPage` 变更自动滚动定位缩略图
  - 主内容（`PptSlideViewer.vue` + `usePptPanZoom.ts`）：滚轮 **围绕鼠标指针缩放**（0.5x ~ 5x，deltaY 方向，指针下内容锚点不动）+
    **拖拽平移**（PointerEvent + `setPointerCapture`，移出视口不中断）；工具栏显示缩放百分比 + 「重置」按钮恢复 1x 居中；状态为
    CSS transform（`translate(tx,ty) scale(s)`），切页保持缩放（同文件页面尺寸一致）；SVG `max-width/max-height: 100%` 适配视口；
    **键盘翻页**：视口可聚焦（`tabindex="0"` + `:focus-visible` 焦点环），点击视口任意位置自动聚焦，↑/↓ 方向键上一页 / 下一页
    （边界内 clamp，无页时无操作；仅视口聚焦时生效，slider / 按钮聚焦不受影响）
  - 主图 **内联 SVG 渲染**（不再 `<img>`）：主进程渲染加 `textOutput: 'text'`（SVG 输出真实 `<text>` 而非字形 path）；渲染进程
    `DOMParser.parseFromString` 解析为 DOM 后挂载（解析产生的脚本不执行，安全，无需 DOMPurify）；缩略图 / hover 大图仍用
    `data:image/svg+xml` 经 `<img>` 展示
  - **节点点选**（`usePptNodePick.ts` + `pptSvgMapping.ts`）：单击选中节点（高亮框追加到 SVG 用户坐标系，随缩放平移同步）→
    工具栏「引用此节点」→ 经 `PPT_NODE_PICK_KEY` 桥注入聊天输入框 `pptMention` 标签 → AI 用 `ppt_batch_edit` 的 update 操作按
    nodeId 精准编辑（详见 §8）
- 导出： **主进程构建并直接落盘**（渲染进程只传目标路径，不经手字节）——`window.preload.ppt.exportPptx` / `exportPptxToPngs`
  写沙盒 / 用户选择路径。

## 7. 注册链路与改动文件清单

表驱动注册，无需改 AgentChat 逻辑：

| 层     | 文件                                          | 动作                                                                                                                |
|--------|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| 类型   | `src/modules/chat/chatType.ts`                | `ChatType` 加 `'ppt'`；`CHAT_TYPE_OPTIONS` 在 design 后插入「PPT 专家」（图标 `SlideshowIcon`，tdesign 已确认存在） |
| 配置   | `src/global/ChatTypeConfig.ts`                | `CHAT_TYPE_CONFIG` 加 `ppt: { label, prompt, tools }`                                                               |
| 提示词 | `src/modules/ppt/pptPrompt.ts`                | PPT 专家提示词 + POM XML 语法精要（16:9 画布、字号层级/留白/对齐铁律、禁止 http 图片）                              |
| 工具   | `src/modules/tool/components/ppt/pptTools.ts` | §5 工具集 + `PPT_TOOL_NAMES` + 安全策略                                                                             |
| 状态   | `src/modules/ppt/PptStore.ts`                 | §4                                                                                                                  |
| 侧边栏 | `src/components/chat/aside/LChatAside.vue`    | 加 `v-else-if="type === 'ppt'"` → `PptAside`                                                                        |
| 展开   | `src/components/chat/LChatEngine.vue`         | asideType 自动展开数组加 `'ppt'`                                                                                    |
| 沙盒   | `src/modules/chat/service/ChatService.ts`     | `aiChatSandbox` 为 ppt 预建 `outputs/`                                                                              |
| 渲染   | `src/modules/ppt/pptRender.ts`                | 封装 Node 侧渲染调用（IPC），类型声明                                                                               |
| 文档   | `docs/ppt/02-pom-xml-guide.md`                | AI 用 XML 语法指南（`ppt_guidelines` 读取）                                                                         |

## 8. 节点引用与精准编辑（已实现）

**目标**：用户点选预览中的节点，告诉 AI「改这个节点」，AI 精准修改而不整页重建。

- **节点 id（SlideNode 顶层字段，与 tag 并列）**：创建 / 加载 / 编辑时由 `ensureNodeIds` 用 nanoid 自动生成（`n-` + 10
  位），同页内去重； **所有节点（含 Li / Td / TimelineItem 等子元素）都有 id**。id 是纯 JSON 层引用标识：不进 attr、不进 POM
  XML（`jsonToPomXml` 不写 id），只服务渲染进程节点映射 / 引用与 `ppt_batch_edit` 精准编辑；`attr.id`（FlowNode 必填 id /
  Arrow 端点 id）是 POM 功能型标识，原样保留透传 XML。
- **映射（`pptSvgMapping.ts`）**：主进程渲染加 `textOutput: 'text'` 使 SVG 含真实 `<text>`；渲染进程把 SVG 顶层 `<g>` 按 POM
  前序发射规则对齐到 JSON 节点（确定性形状计数 + Text/Shape 文本校验；复合节点
  Timeline/Flow/Tree/Matrix/Pyramid/ProcessArrow 以"下一个文本锚点"为界整体绑定；含 zIndex / Arrow 或校验失败 →
  整页不可点降级），就地注入 `data-node-id`。
- **交互（`PptSlideViewer.vue` + `usePptNodePick.ts`）**：单击选中节点（区分拖拽，阈值 5px）→ 高亮框 → 工具栏「引用此节点」→ 经
  `PPT_NODE_PICK_KEY`（`components/chat/ppt/pptNodeBridge.ts`，LChatEngine provide）注入输入框 `pptMention` 标签 → 序列化为
  `{ type: 'ppt', data: { pptId, slide, nodeId, label } }`。
- **AI 闭环**：`agentContext.buildPinnedContext` 识别 ppt 内容类型 → 引导 AI 用 `ppt_get_nodes` 读该页元素树拿 id，再用
  `ppt_batch_edit` 的 update 操作按 id 精准编辑（patch = attr 合并 / text 覆盖 / child 替换，结构校验 + 深搜 id）；
  `ppt_batch_edit` 返回该页全部节点摘要 `nodes`（含 id）。
- 降级：节点被删除 / 移动会使旧 nodeId 失效 → update 报"未找到更新目标"引导 AI 重读。

## 9. 第一版范围声明（明确不做）

- ❌ **高级设计类 tool**：不接生图 `image_generate`、素材 `icon_svg` / `website_logo`、字体 `font_*`；AI 仅用 POM 内置 lucide
  图标、形状、图表、表格节点。图片仅允许 base64 / 沙盒本地文件。
- ❌ **子 Agent（`SUB_AGENT_ALLOW`）**：不加 ppt 型子 Agent，主 Agent 直用。

## 10. 风险与待验证项

- **POC 必做**（实现第一步）：Node ≥ 22 环境装 POM + pptx-glimpse，跑通含 `<Icon>`/`<Chart>` 的 XML → `buildPptx` →
  `convertPptxToSvg` → SVG 输出；确认 resvg wasm 加载与字体默认值。
- 锁定 POM 版本（活跃迭代中，升级需回归）。
- http (s) 图片：Node 侧 `measureImage` 用 fetch（Node 22 有原生 fetch），但跨域/网络失败会兜底 1x1 占位 → prompt 仍建议
  base64 / 本地文件。
- 字体：内置 Noto Sans JP 中文可显示但字形偏日式；后续映射系统字体。

## 11. 实施步骤（升级 Electron 完成后）

1. **POC**：Node 侧跑通「XML → PPTX → SVG」全链路（含 icon）。
2. Node 侧封装：`pptRender.ts`（IPC 暴露 `renderPptxToSvgs(xml, { w, h }) → Promise<string[]>`）。
3. `PptStore.ts` + `PptRenderer.vue` + `PptAside.vue`。
4. `pptTools.ts`（含 `ppt_batch_edit` ops 实现与校验）+ `pptPrompt.ts`。
5. 注册链路 7 处改动。
6. `docs/ppt/02-pom-xml-guide.md`（AI 指南）+ 本方案文档转「已实现」状态。

## 12. 参考资料

- POM 官网：https://pom.pptx.app （Requires Node.js 22+ / MIT）
- 仓库：https://github.com/hirokisakabe/pom （monorepo：pom / pom-cli / pom-md / pom-jsx / pom-editor）
- `@hirokisakabe/pom@10.3.0`（unpkg 源码扫描）、`@hirokisakabe/pom-cli@0.10.0`（preview 链路）、`pptx-glimpse@3.2.8`（browser
  构建）
- uTools 7.8.0 运行时：Electron 22.3.27 / Node 16.17（本机安装包二进制分析 + 官方 preload 文档）

## 13. 实现记录（2026-08，实测差异与补充）

### 12.1 已落地的实现

| 项         | 说明                                                                                                                                                                                                                                                                                               |
|------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 依赖       | `@hirokisakabe/pom@10.3.0` + `pptx-glimpse@3.2.8`（均 `dependencies`，主进程 externalize 后打包进 asar）                                                                                                                                                                                           |
| 主进程渲染 | `src/main/src/ppt/pptRenderer.ts`（PptJsonDoc → jsonToPomXml → buildPptx → SVG / PPTX 字节 / PNG）+ `src/main/src/ppt/jsonToPomXml.ts`（SlideNode JSON → POM XML 纯函数转换）+ `src/main/src/ipc/pptIpc.ts`                                                                                        |
| IPC        | `PptChannels`：`ppt:renderPptxToSvgs`（PptJsonDoc→每页 SVG）/ `ppt:exportPptx`（PptJsonDoc→构建 PPTX 并落盘）/ `ppt:exportPptxToPngs`（PptJsonDoc→指定页 PNG 并落盘，preload `window.preload.ppt`）；载荷类型 `SlideNode` / `PptJsonDoc` 定义在 `src/preload/src/channels.ts`（main/preload 共享） |
| 渲染进程   | `src/renderer/src/modules/ppt/`：`PptStore.ts`（500ms 防抖自动渲染，JSON 存储零 pom）/ `pptTypes.ts`（SlideNode / PptJsonDoc）/ `pptRender.ts` / `pptPrompt.ts` / `pptGuidelines.ts`                                                                                                               |
| 工具       | `src/renderer/src/modules/tool/components/ppt/pptTools.ts`（14 个 ppt_* 工具 + 策略：全 allow，导出工具走 `isPathUnder` 路径感知审批）                                                                                                                                                             |
| UI         | `src/components/chat/aside/ppt/PptAside.vue` + `PptRenderer.vue` + `PptSlideViewer.vue` + `usePptPanZoom.ts`（SVG `<img>` 渲染、翻页 / 滚轮缩放（围绕指针）+ 拖拽平移 / 缩略图导航 / 自动滚动定位）                                                                                                |
| 注册       | `chatType.ts`（ChatType + CHAT_TYPE_OPTIONS，design 后插入，图标 `SlideshowIcon`）/ `ChatTypeConfig.ts` / `LChatAside.vue` / `LChatEngine.vue` / `SUB_AGENT_ALLOW`（ppt 无子 Agent，空数组）                                                                                                       |
| 指南       | `docs/ppt/02-pom-xml-guide.md` + `docs/ppt/03-ppt-experience-guides.md`（layout / nodes / styling 经验指南，`ppt_guidelines` 经 `?raw` 读取；第三版起 topic `pom-xml` 改为 `json`，第四版新增 `operations`，指南源为 `src/renderer/src/modules/ppt/guidelines/`）                                  |

### 12.2 实测差异（相对调研结论）

1. **CJS 无法 `require` POM**：`exports` 无 `require` 条件，`ERR_PACKAGE_PATH_NOT_EXPORTED`（Node 22 / 24 均如此）。
   主进程（CJS）用 **动态 `import('@hirokisakabe/pom')`** 加载（走 import 条件），electron-vite 构建会保留原生 `import()`（
   `dynamicImportInCjs`），POC 与构建产物均已验证。
2. **`buildPptx` 只接受 XML 字符串**：源码 `buildPptx(xml)` 内部先 `parseXml(xml)`，README 中「传 POMNode 数组」的示例不成立。
3. **`parseXml` 返回「页列表」**：顶层 `<Slide>` 解析为 POMNode 数组（单子元素直接返回该节点，多子元素隐式包
   `{type:'vstack'}`）；
   `serializeXml` 输出顶层即 `<Slide>`（round-trip 可 parse）——`ppt_batch_edit` 的「解析 → 操作 → 序列化写回」由此实现。
4. **Table 无 `data` / `header*` 属性**：用子元素 `<Tr><Td .../></Tr>`（`Td` 文字色属性为 `color`，非 `textColor`）；Chart 用
   `<ChartSeries><ChartDataPoint label value/></ChartSeries>` 子元素（JSON 属性形式亦可，但需 `&quot;` 转义）。
5. **Theme round-trip 处理**：POM 的 `parseXml` 把 `<Theme>` 解析为色板（ **不保留为节点**），`serializeXml` 写回会丢失它——
   `PptStore.withPages` 写回时用 `extractThemeXml` 从原文件提取 Theme 声明并 **拼回文件头**（`<Theme/>` 持续有效，新提交元素的
   `$token` 引用保留）；但 **未被编辑的页**经 parse 写回时其 `$token` 会内联为实色（视觉等价），已写入指南提示 AI。
6. **ChatService.ts 无需改动**：`aiChatSandbox` 已对所有聊天类型统一预建 `outputs/`，满足 ppt 需求。
7. **PNG 导出**：直接用 `pptx-glimpse` 的 `convertPptxToPng`（含 resvg），无需自接 resvg-wasm。
8. **图标**：`SlideshowIcon` 在 tdesign 确认存在；`FilePptIcon` 不存在（导出 PPTX 菜单用 `FileIcon`）。

### 12.4 第二版契约调整（2026-08，用户反馈后重构）

第一版参考 canvas 的「版本化文件 + slide 粒度 ops」，不符合 PPT 实际使用（create 后通常持续编辑同一文件；一个文件多页 =
canvas 的一组图片）。重构为：

1. **单一文件持续编辑**：`outputs/{name}.pom.xml`（AI 指定文件名），编辑原地写回，无版本文件；「用户要第二个版本」时再
   `ppt_create` 新文件。
2. **页面元素 JSON 编辑**：`ppt_batch_edit(pptId?, slideId, elements)` —— `elements` 为 **JSON 节点数组**（非 XML 字符串），
   `@sinclair/typebox` 严格校验（`pptElementSchemas.ts`，20 种节点 type 枚举 + `additionalProperties: false` + children
   递归），校验 schema 同时喂给模型参数描述（单一数据源，仿 canvas 的 canvasSchemas 模式）。
3. **`ppt_add_slide`** 替代原 ops 的 add/remove/move/rewrite：加页 → 编辑页（整页替换）两步走，slideId **1 起始**（与 UI
   页码一致）。
4. **TypeBox 工具提取**：`toToolProperty` / `collectErrors` 提取到 `src/renderer/src/modules/tool/typeboxUtil.ts`
   （canvas / ppt 共用），canvasSchemas 行为不变。
5. **经验指南**：基于 POM 官方三文档（nodes / layout-system / styling-guide）转写为经验提示词（layout.md / nodes.md /
   styling.md），`ppt_guidelines` topics 扩展为 layout / nodes / styling / pom-xml / workflow。
6. 提示词强化： **页面根元素必须是 VStack / HStack 布局容器**（flexbox 先布局后内容）；字号分级按官方规范（标题 28-40 / 小标题
   18-24 / 正文 13-16 / 注释 10-12）。
7. **设计风格支持**（与 design 同源）：新建 PPT 会话可选设计风格（PageNew 开放选择），风格在创建后锁定，水合时经
   `buildDesignStylePrompt` 注入稳定 system 前缀；PPT 不接生图，跳过「正向/反向提示词」段（`withVisualPrompt: false`
   ），只注入配色方案 / 字体规范 / 布局约束——AI 创建 PPT 时按风格色板写 `<Theme>`、按风格字体排版。
8. **POM 布局 bug 规避（实测）**：嵌套 HStack 链（≥2 层无像素宽）中的 Text 未显式声明 `w` 时，POM 10.3.0 布局测量产生 NaN
   宽度 → `buildPptx` 抛 `addTextBox: width must be a finite positive EMU value`（导出 PPTX/PNG 全部失败，渲染保留旧图）。
   `PptStore.prepareElements` 自动为受影响 Text 补 `w="max"`（视觉等价，实测修复 13 页真实文件）；渲染错误附边界提示供 AI
   自纠。已写入 layout 指南。
9. **Svg 节点 w/h 仅数字（实测）**：POM 的 `<Svg>` 只接受数字 `w`/`h`（`"max"` / `"50%"` 被拒且报误导性的
   `Missing required attribute "w"`，而 w 缺失反而通过）。`pptElementSchemas` 的 svg 分支 w/h 改为纯数字；
   `PptStore.withPages` 写回前用 `parseXml` 严格校验（serializeXml 宽容，坏数据会静默落盘、下次读取才炸——写回前拦截并当场反馈
   AI，不污染文件）。已写入 nodes 指南。

### 12.5 第三版契约调整（2026-08，SlideNode JSON 存储重构）

第二版存储为 `{name}.pom.xml`（XML 与 POM 库格式完全耦合），渲染进程编辑链路依赖 `parseXml` / `serializeXml` round-trip，且
`<Theme>` 声明写回需正则提取拼回文件头——设计不佳。重构为 **全程 SlideNode JSON，渲染进程零 pom**：

1. **存储格式**：`outputs/{name}.ppt.json`（旧 `.pom.xml` 忽略不迁移），内容为 `PptJsonDoc`：

```json
{
  "name": "第一个 ppt",
  "createdAt": 1755058092000,
  "updatedAt": 1755058092000,
  "theme": {
    "surface": "0F172A",
    "accent": "38BDF8",
    "textMain": "F8FAFC",
    "textMuted": "94A3B8"
  },
  "slide": [
    [
      {
        "tag": "VStack",
        "attr": {
          "w": "100%"
        },
        "child": [
          ...
        ]
      }
    ]
  ]
}
```

2. **SlideNode 通用结构**：`{ id?, tag, attr, child }`——`id` 为 **顶层节点标识**（与 tag 并列，自动生成、所有节点都有，不进
   attr/XML），tag 即 POM XML 标签名（VStack / Text / TimelineItem 等，一一对应），attr 为 `Record<string, string>`
   （对象属性点表示法展开：`border.color`、`shadow.blur`、`padding.top`），child 为子元素数组或 **文本字符串**（Text
   节点内容）。结构化数据全部用子元素表达（Table→Tr/Td、Timeline→TimelineItem、Flow→FlowNode/FlowConnection、Ul/Ol→Li 等，POM
   NODE_METADATA 全支持）；Chart 的 `data`/`chartColors` 为 attr 中的 JSON 字符串（pom 支持 JSON 属性解析）。

3. **渲染进程完全排除 pom**：`PptStore.ts` 删除 `parseXml`/`serializeXml`/`POMNode` 依赖，编辑链路为「JSON 读文件 → TypeBox
   校验（tag 判别）→ 替换页面数组 → JSON 写回」；`PptCurrentDoc` 从 `{xml}` 改为 `{json: PptJsonDoc}`，watch 依赖
   `current.json`；attr 值入站统一 toString（AI 可输出数字/布尔，存储恒为字符串）。

4. **json → xml 转换只在导出时（主进程）**：新增 `src/main/src/ppt/jsonToPomXml.ts`（纯函数，不依赖 pom）：递归
   nodeToXml（attr/文本 XML 转义、空 child 自闭合）+ `<Theme/>` + `<Slide>` 包裹 + `normalizeHStackText`（12.4-8 的 POM 布局
   bug 规避从渲染进程迁移至此，幂等）。`pptRenderer.ts` 三函数签名 `xml: string` → `json: PptJsonDoc`，内部先转换再
   `buildPptx`；IPC 载荷类型 `SlideNode`/`PptJsonDoc` 定义在 `channels.ts`（main/preload 共享），renderer 侧 `pptTypes.ts`
   同形状。

5. **schema 重写为 SlideNode**：`pptElementSchemas.ts` / `pptComplexElementSchemas.ts` 的节点从扁平 `{type, ...}` 改为
   `{tag, attr, child}`（tag 大写 Literal、attr 精确属性 + 点表示法、child 递归）；`pptSchemas.ts` 按 tag 判别校验；attr 值允许
   string/number/boolean（AI 友好）。Table 用 Tr 子元素形式后 POM 自动补 columns（12.2-4 的 normalizeTableColumns 不再需要）。

6. **prompt / guidelines 同步**：`pptPrompt.ts` 改为 SlideNode JSON 规范；`guidelines/` 的 pom-xml.md 重写为
   json.md（存储结构速查），topic `pom-xml` → `json`；layout / nodes / styling / workflow 全部改为 attr JSON 写法；内联 runs（
   `<B>/<Span>` 装饰标签）暂不支持（字符串 child 会转义，装饰用多 Text + HStack 组合，见 12.3 限制）。

### 12.6 第四版契约调整（2026-08，元素级批量操作重构）

用户反馈第三版「整页覆盖 elements」设计不合理（AI 每页重建 JSON 体量大、样式 / 布局难以精细控制，元素过多还易产出坏 JSON）。参考
canvas_batch_edit 重构为 **元素级批量操作**：

1. **`ppt_batch_edit(pptId, slideId, operations)`**：从「替换整页元素数组」改为「对指定页做批量操作」（insert / copy /
   update / move / delete， **≤15 个/批**，单操作容错），按节点 id 精准增删改查。执行器
   `src/renderer/src/modules/ppt/pptBatchOps.ts`（纯页面逻辑，as 绑定名 + `parent:"@绑定名"` 引用，仿 canvas
   `CanvasStore.batchEdit`）；schema 与校验在 `pptSchemas.ts`（`pptBatchOpSchemaT` 判别联合 + `validatePptBatchOp(s)`，复用
   `pptElementPatchSchemaT` 作 update.patch / copy.overrides）。
2. **工具面精简**：移除 `ppt_read`（被 `ppt_info` + `ppt_get_nodes` 取代）与 `ppt_edit_element`（被 batch 的 update 操作取代）；新增
   `ppt_info`（文档级信息）、`ppt_get_nodes`（单页元素树，ids 可选过滤）、`ppt_delete_slide`（删页）、`ppt_set_theme`（更新 theme
   令牌，canvas_set_palette 类比）。
3. **`ppt_create` 增加 `slideCount`**：slide 数组按页数放空页（`[]`，缺省 1）；`ppt_add_slide` 简化为只加空白页（去掉 elements
   参数）。
4. **无兼容处理**：模块未发布、无历史数据——旧文件 / 旧工具 / attr.id 兼容回退（`findNodeById` / `ensureNodeIds` 只认顶层
   node.id）直接清理，不写迁移逻辑。
5. **指南同步**：`ppt_guidelines` 新增 topic `operations`（`guidelines/operations.md`，5 种 op 语法 + as 绑定 +
   易错点）；workflow / json 指南按新契约改写；删除未加载的过时 `guidelines/pom-xml-guide.md`；`pptPrompt.ts` 工作流段重写；
   `agentContext` 的 PPT 节点 pinned 上下文改为引导 `ppt_get_nodes` + update 操作。

### 12.3 已知限制（第一版范围）

- 节点点选映射对 **含 zIndex / Arrow 的页**降级为不可点（POM
  发射顺序不可保序）；复合节点（Timeline/Flow/Tree/Matrix/Pyramid/ProcessArrow）整体绑定到整节点（不可细分到子项）；含复合节点且后续跟无文本简单节点的页，其后节点可能被并入复合节点跨度（仍可点，引用整节点）。
- 渲染失败保留旧图，错误文本记录在 `PptStore.renderError`，AI 经 `ppt_info` / `ppt_get_nodes` 返回值读取自纠。
- 中文默认用 POM 内置 Noto Sans JP（字形偏日式），后续可映射系统字体（参考 pom-cli `EXTRA_FONT_MAPPING`）。
- JSON 元素暂不支持内联 runs（`<B>/<Span>` 等装饰标签），复杂装饰建议用纯文本 + 属性表达。

## 13. 三端展示一致修复（2026-08，WPS / 快速预览字体替换错乱）

### 13.1 现象与根因

- 现象：SVG 预览 / PNG 导出正常，但导出的 PPTX 在 **WPS / macOS 快速预览**打开时，个别文本换行后与下方元素重叠（预览与 PPT
  展示不一致）。
- 关键事实：三条链路（`renderPptxToSvgs` / `exportPptxPngFiles` / `exportPptxFile`）共用同一份 `buildPptx` 字节，
  **不是两套逻辑**。不一致来自渲染方：POM 用内置 Noto Sans JP 测宽，把文本框冻结为「Noto 测宽 + 10px」绝对坐标（
  `measureText.js` 写死 `widthPx + 10`），导出不内嵌字体、不写 autofit；本机预览（pptx-glimpse）字体与 Noto 度量差 <1%
  所以不重排，WPS / 快速预览缺 Noto 替换更宽字体 → `wrap="square"` 重排成多行 → 超出冻结框高 → 重叠。
- 定量证据：拉丁 / 数字 / 空格占比高的 hug 框在替代字体（微软雅黑 / 等线类）下实测超宽 0.4~19.3px；纯中文行 1em/字最稳。

### 13.2 修复：主进程后处理 `postprocessPptx.ts`

- 位置：`src/main/src/ppt/postprocessPptx.ts`（纯函数，fflate 解压 → 改写 `ppt/slides/slideN.xml` → 重打包）。
- 三路共用：`pptRenderer.ts` 抽 `buildPptxBytes`（`buildPptx → write → postprocessPptx`），预览 / PNG / PPTX 用同一份字节 →
  任何渲染器结构一致。
- 改写规则：
  1. 正文文本框（`<p:txBody>`）：`wrap="square"` → `"none"` + 注入 `<a:normAutofit fontScale="100000" lnSpcReduction="0"/>`
     。POM 输出本就是「每段一行」，禁止软换行后行数恒定 → 不再出现「多出一行顶到相邻元素」；某行过宽时由渲染端收缩字号适配冻结框（PowerPoint「Shrink
     text on overflow」语义）。
  2. 表格单元格（`<a:txBody>`）：rPr 缺 typeface 时补 `<a:latin/a:ea/a:cs typeface="Noto Sans JP"/>`，与正文统一（实测表格
     run 原本无 typeface，中文字体走主题空 ea，与正文不一致）。
- **两个坑（已踩过）**：
  - `lnSpcReduction` 必须写 `0`：glimpse 的 `getLineHeightPx` 对固定 `spcPts` 也乘 `(1 - lnSpcReduction)`（`val/1e5`），写
    100000 会让行高归零。
  - **不做 spcPts→spcPct 换算**：spcPct 是相对字体「自然行高」的百分比，导出端无法移植换算（同一百分比在不同字体下行高不同），改了反而让
    WPS 行距失控；wrap=none 已冻结行数，固定 spcPts 保垂直适配。
- 副作用与边界：
  - WPS / 快速预览中原本会溢出的文本，字号会比预览略小（收缩所致），但结构一致、不重叠、不截断。
  - glimpse 对 `wrap="none"` **不执行 autofit 收缩**（`chunk-B5GBQS2M.js` 仅在 `wrap !== "none"` 时
    `computeShrinkToFitScale`）；本机字体与 Noto
    度量一致所以预览正常，个别临界文本横向最多溢出几像素（属于"去掉预览对单行设计的多绕换行"，反而更贴合 POM 冻结的单行意图）。

### 13.3 提示词侧配合（让 AI 少触发收缩）

- `src/renderer/src/modules/ppt/pptPrompt.ts` 设计铁律新增「文字宽度」：单行文本避免长英文连串、中英混排按英文更宽预留、文字不贴边、长内容用
  `\n` 拆行。
- `src/renderer/src/modules/ppt/guidelines/layout.md` 新增 §8「文字宽度经验」，含按有效性排序的 5 条写作经验。

### 13.4 验证要点

- `npm run typecheck:node` 通过（web 侧报错为仓库既有 `Ref<T>` 问题，与本次无关）。
- 样例 `海报设计Agent技术架构.ppt.json` 重导出 PPTX：136 个正文框 bodyPr 均为 `wrap="none"` + `normAutofit`、表格 14 个
  run 已补 typeface、无残留 `wrap="square"`、XML 格式校验通过。
- 预览 SVG 像素对比：slide9（表格字体统一）与 slide2/4/10（去掉 glimpse 多余换行）有预期差异，其余 6 页完全一致。
- **待真机验证**：WPS / macOS 快速预览打开新导出 PPTX，确认无重叠、无截断。
