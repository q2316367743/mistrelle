# 设计创意 HTML 引擎（designScene 双引擎分层）

> 2026-09-06 落地。设计创意（design ChatType）在画布引擎之外新增 **HTML 引擎**：
> AI 生成固定尺寸的自包含 HTML 设计稿 → 侧边栏 iframe 实时预览 → snapdom 导出 PNG。
> 引擎在**新建对话时选定、创建后锁定**（与 type / writingScene 同机制）。

## 1. 分层模型：DesignScene 子引擎

镜像 `WritingScene`（写作子场景）先例，design 类型内部分引擎层：

```ts
// modules/chat/designScene.ts
export type DesignScene = 'canvas' | 'html'
export const DESIGN_SCENE_OPTIONS: DesignSceneOption[] = [...]  // label/description/icon（LayersIcon / Html5Icon）
```

组合根在 `global/ChatTypeConfig.ts`：

```ts
export const DESIGN_SCENE_CONFIG: Record<DesignScene, DesignSceneConfig> = {
  canvas: { prompt: buildDesignCanvasPrompt(...), tools: canvasTools + designTools },
  html:   { prompt: buildDesignHtmlPrompt(...),  tools: designHtmlTools + designTools }
}
// CHAT_TYPE_CONFIG.design 委托：DESIGN_SCENE_CONFIG[ctx.designScene ?? 'canvas']
```

- **两份提示词独立成文**：canvas 版 `modules/canvas/canvasPrompt.ts`、HTML 版 `modules/designHtml/designHtmlPrompt.ts`（互不复用段落，各自演化）
- **设计素材工具两引擎共用**（icon_svg / website_logo / font_list / image_crop / chart_generate / image_generate 门控 / humanize_text 登录门控等，见 tool/13）
- `hasImageGenerate`（是否配置默认生图模型）判断保留在各分支内，与 `createDesignTools` 的 image_generate 注入同源

### 锁定链（创建时选定，问答中不可切换）

`PageNew.vue`（design 类型时显示引擎 segmented-control，风格 StyleSelect 两引擎通用）
→ `LChatSender`（initial.designScene 透传进首条消息，无切换 UI）
→ `AiChatStore.add`（写 `AiChatContent.designScene ?? 'canvas'`）
→ `ChatSessionManager.load`（水合 `chat.setDesignScene()`；`send()` 锁定属性注释含 designScene）
→ `AgentChat.typeToolsContext()`（ctx.designScene）→ `CHAT_TYPE_CONFIG.design` 自动按引擎分流提示词与工具。

- **存量 design 会话无 designScene → 缺省 canvas，行为完全不变**
- **子 Agent（sceneType='design'）ctx 无 designScene → 自动落 canvas 保持画布引擎**（design 聊天本就不可派 design 子 Agent，SUB_AGENT_ALLOW 只放行 research）
- `agentPrompts.buildTypePromptBody` / `agentFunctions.getTypeTools` 零改动（都经 CHAT_TYPE_CONFIG 委托自动分流）

## 2. 数据层 `modules/designHtml/`

| 文件 | 职责 |
|------|------|
| `designHtmlDoc.ts` | 文档契约纯函数：文件名 `outputs/html-{version}.html`、清洗、`<html data-design-*>` 元信息注入/解析、读取 |
| `DesignHtmlStore.ts` | 响应式 store（sandboxDir 键控单例 Map，镜像 CanvasStore）：`files` / `current` / `refreshFiles` / `open` / `read` / `readDoc` / `create` / `write` / `delete` |
| `designHtmlRender.ts` | 渲染管线：图片 dataURL 解析、预览文档装配、`exportDesignHtmlPng`（snapdom） |
| `designHtmlPrompt.ts` | HTML 引擎 system 提示词工厂 |

### 文档契约

- **纯 HTML 文件**（用户可直接双击打开），宽高/标题嵌在 `<html data-design-w data-design-h data-design-title>` 上，读取侧无需 sidecar 元数据
- `create({width, height, title, html})` 清洗后自动注入元信息；`write(html, size?)` 整页替换当前版本（可选调尺寸）
- 长度上限 `HTML_DESIGN_MAX_LENGTH = 400_000` 字符，超限整体拒绝（截断产出残缺结构）
- 元信息缺失的 html-*.html 文件不被 `refreshFiles` 识别（等同 canvas 的 schema 2 校验）

### 编辑模型（已拍板）

**全量重写**：`html_write` 每次提交完整 HTML 替换当前版本（Claude artifacts 同款模式）。
源码以模型上次提交为准，无需先 read；配合 `toolContextRules` 紧凑化（`html_create` / `html_write`
共享当前稿资源键，仅保留最后一次成功写原文）控制历史 token。

### 渲染管线（预览与导出共用）

`prepareDesignHtmlDocument(doc)`：
1. `resolveDesignHtmlImages`：`<img src>` 与 CSS `url()` 引用统一转 dataURL——本地绝对路径走
   `fs.readBinaryFile`、http(s) 走 fetch（失败保留原样降级，上限 40 个），防 iframe 无法加载本地路径
   与 snapdom 跨域污染 canvas；**AI 源文件保持原貌**（便于回读再编辑），仅渲染装配时转换
2. 注入基础画布样式（追加在 AI 样式之后强制生效）：`body{width:Wpx;height:Hpx;overflow:hidden}`

`exportDesignHtmlPng(doc, scale=2)`：屏幕外 iframe（`position:fixed;left:-10000px`）→
`doc.write` → `fonts.ready` + 图片加载等待（8s 兜底）→ `snapdom(body, {scale}).toBlob('png')`
→ finally 移除 iframe。与笔记卡片 `NoteCardRenderer.exportBlobs` 同一成熟模式。

### 安全（双层防御）

- **清洗**：落盘前 `sanitizeDesignHtml` 剔除 `<script>` 整块、`iframe/object/embed/link/base/form` 标签、
  `on*` 事件属性、`javascript:` 协议。注意与卡片模板 `stripDangerous` 的差异：**设计稿必须保留
  `<style>`**（内联样式是核心载体）。动机：预览 iframe 是同源 about:blank，脚本可触达
  `window.preload`，必须剔除
- **sandbox**：预览/导出 iframe 一律 `sandbox="allow-same-origin"`（同源可写文档、禁脚本）

## 3. AI 工具面 `tool/components/designHtml/designHtmlTools.ts`

全部 `internal: true`，结构与 canvasTools 镜像；`DESIGN_HTML_TOOL_NAMES` 单一数据源。

| 工具 | risk | 职责 |
|------|------|------|
| `html_list` | safe | 列出版本 |
| `html_create` | safe | 新建版本（width/height/html/title?），设为当前 |
| `html_write` | sensitive | **核心编辑**：整页重写当前版本（可选调尺寸） |
| `html_read` | safe | 读源码原文（默认当前） |
| `html_open` | safe | 切换当前版本 |
| `html_delete` | dangerous | 删除版本文件 |
| `html_export` | sensitive | 导出 PNG（scale 1~4 缺省 2；缺省落 `outputs/html-{version}.png`） |
| `html_guidelines` | safe | **白名单复用** canvas guidelines 注册表的引擎无关主题 |

- `html_guidelines` 白名单：style-guide / composition / typography / image-generation / styles / poster /
  book-cover / album-cover / social-media / knowledge-card；**剔除 operations / workflow**（canvas 专属操作文档会误导）
- 安全策略注册在模块底部（镜像 canvasTools）：html_* 默认 `allow`（仅读写自家沙盒 outputs/），
  `html_export` 路径感知（沙盒/工作空间内放行，外部 `ask`），计划模式写类仍 deny
- `contextRules.ts`：`ContextWalkState.htmlVersion`；`html_open`（resource+track）/
  `html_create`（writeResource=当前稿键 + track 清游标）/ `html_read`（resource）/
  `html_write`（writeResource）

## 4. 专有侧边栏

```
components/chat/aside/design/
├── DesignAside.vue          # 画布引擎（原有）
├── HtmlDesignAside.vue      # HTML 引擎外壳：版本 t-select + 刷新 + dropdown + 全屏树/预览分发 + 双击注入桥
├── HtmlDesignPreview.vue    # 预览子组件：iframe + contain 缩放 + 双击选中/滚轮升降级 + 元素树上报
├── HtmlElementTree.vue      # 全屏左栏元素树（镜像 CanvasElementTree 交互）
├── htmlPreviewDom.ts        # iframe DOM 纯函数：路径解析/描述链/树构建/蓝框样式（从 Preview 拆出守行数）
└── useHtmlDesignActions.ts  # 动作集合 composable（复制图片/下载图片/复制源码/文件夹中显示）
```

- 分发：`LChatAside.vue` 新增 `designScene` prop（default 'canvas'），design 分支
  `designScene === 'html'` 渲染 HtmlDesignAside；透传链
  `useChatSession(session.designScene)` → `LChatEngine` → `LChatAside`
- 预览缩放 contain 适配容器（`useElementSize` 监听，侧边栏拖宽/全屏自适应），上限 1x 防放大模糊
- 聊天 pending/streaming 时禁用版本切换（与画布侧边栏同口径）
- fullscreen 展示「左元素树 + 右预览」双栏（画布引擎是 树+画布+属性面板 三栏，HTML 无节点模型无属性面板）
- 聊天删除时 `AiChatStore.remove` 同步 `destroyDesignHtmlStore(sandboxDir)`

### 4.1 元素选中与修改（对齐画布双击交互）

- **定位模型**：元素无 id，用「body 相对索引路径」（`'0;1;2'`，每段 = 元素在父级 Element 子节点中的
  下标）作唯一标识；路径解析（resolvePath）、双击取路径（pathOfElement）、元素树构建（buildTree）
  三处共用 htmlPreviewDom.ts 同一套函数保证一致
- **单击选中 + 蓝框，双击注入聊天**：事件监听挂在 iframe 的 `contentWindow` 上（父侧挂一次，跨
  doc.write 存活，iframe 内零脚本不违反清洗规则；注意跨 realm 不能用 `instanceof Element`，
  用 `nodeType === 1` 判断）。单击元素 → 记录路径 → 注入 style 规则
  `[data-dsel]{outline:2px solid <brand> !important}` 圈出（颜色运行时读宿主 `--td-brand-color`
  token，不写裸色值；outline-offset:-2px 防边缘裁切；仅 Preview 渲染时注入，导出 PNG 不带蓝框）。
  单击 body 空白取消选中；**双击 = 注入聊天输入框**（单击已选中，双击仅补发 pick）
- **滚轮升降级**（解决「点 span 想选 div」的层级问题）：滚轮上 = 扩大到 parentElement（压栈当前路径）；
  滚轮下 = 弹回之前缩小的候选（栈空则进第一个元素子）。树/双击产生的选中变化清空候选栈
  （Preview 内用 lastWheelPath 区分来源）
- **全屏元素树**：Preview 每次渲染后遍历 body 上报树（深度≤12、总量≤400 防爆）；
  HtmlElementTree 树点击 ↔ 预览蓝框双向联动，选中变化自动展开祖先链，再点已选中 = 取消
- **选中元素注入聊天**（双击触发，镜像画布 CANVAS_NODE_PICK_KEY 全链）：双击 = 选中 + 注入——
  `HtmlElementItem { version, path, label }`（label = 完整描述链 `body > div.hero > h1 「文本…」`）
  → `HTML_ELEMENT_PICK_KEY`（htmlElementBridge.ts，useChatSession provide）→
  `LChatSender.addHtmlElementNode`（htmlElementMention 标签，attrs 存全量链、显示截断末段）→
  chatSenderContent 序列化 `HtmlElementContent` → `agentContext.buildPinnedContext` 渲染指令
  「按描述链特征定位元素、仅改该元素、html_write 整页重写其余保持不变」→
  designHtmlPrompt 有对应「元素引用」契约小节；无桥接时降级复制描述链
- 消息芯片：MChatUser 渲染 `设计稿(html-vN)元素(末段)` t-tag（title 全链）、RChatList locator tooltip 同步

## 5. 注意事项

- `html_write` / `html_create` 的 handler 捕获 store 抛错转 `{error}` 返回（模型可自纠），不要让异常炸掉整轮 agent loop
- 导出等待：字体 `fonts.ready` + 图片 load/error（8s 兜底）双等待，避免截图缺字/缺图
- 网络图片转 dataURL 用 `blob.type` 判定（URL 常无扩展名，如 picsum）；本地图片必须靠扩展名推 MIME
- `resolveDesignHtmlImages` 内的字符串替换在并发 await 间进行，JS 单线程下各 split/join 原子生效，无竞态
- 引擎描述文案在 `CHAT_TYPE_OPTIONS`（「画布 / HTML 双引擎」）与 `DESIGN_SCENE_OPTIONS` 两处维护
