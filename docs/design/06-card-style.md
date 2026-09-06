# 卡片风格与 Markdown 卡片（card style & note card）

> 2026-09-05 落地，同日二次修订：**笔记卡片页（/attachment/card）从参考站 jinsan.ok.kimi.link（XHS Card Studio）
> 的 1:1 移植改为 Markdown 优先的主页面**——文章内容就是 Markdown 源码，卡片经仓库既有
> `NoteCardRenderer`（iframe 富渲染 + 实测分页 + snapdom 导出）以真实排版呈现；
> 参考站纯文本正文管线（`**加粗**`/`==高亮==`/`[img]` 标记与分页常量）已整体删除。
>
> 2026-09-06 三次修订：**卡片风格升级为三层结构**——白名单 props 之外新增自由层
> `template`（HTML 模板，data-nc 插槽契约）与 `css`（自定义 CSS），注册表表达不了的效果
> （信纸横线、纸纹、伪元素装饰、自定义结构）由此可行；新增内置预设「苹果备忘录」作自由层示范。
> 管理页在设计分组；卡片风格生成入口 = 内置专家「卡片风格创建助手」（同日移除 ChatType `'card'`，能力由内置专家承担）。

## 1. 全景与关键文件

```
卡片风格（样式约束，三层结构，双端共用）
├── src/renderer/src/global/card-style-props.ts    # ★ props 注册表（快捷层唯一扩展点）→ buildCardStyleCss
├── src/renderer/src/global/card-style-template.ts # ★ 自由层契约与清洗（data-nc 插槽 / normalize / AI 文档）
├── src/renderer/src/global/CardStylePresets.ts    # 7 套内置预设（isSystem，不落盘；含自由层示范「苹果备忘录」）
├── src/renderer/src/entity/ai/AiCardStyle.ts     # 实体 AiCardStyleItem / AiCardStyle / Form
├── src/renderer/src/windows/main/modules/card/service/CardStyleService.ts   # ~/.mistrelle/card-style/
├── src/renderer/src/windows/main/store/card/CardStyleStore.ts               # Pinia，会员硬门控
├── src/renderer/src/windows/main/pages/design/card/DesginCardPage.vue       # 管理页（/design/card，全抽屉）
│   ├── components/（CardStyleCard / CardStyleFace / CardStylePropField / CardStylePropsForm）
│   └── modals/（CardStylePutDrawer / CardStyleDetailDrawer，.tsx 外壳 + .vue 内容）
└── src/renderer/src/windows/main/modules/card/service/CardStylePrompt.ts    # Agent 提示词（注册表 + 契约生成）

Markdown 卡片主页面（/attachment/card，无本地持久化）
├── src/renderer/src/windows/main/pages/extend/card/index.vue     # 布局：顶部导出 + 左编辑 / 右预览
├── src/renderer/src/windows/main/pages/extend/card/state.ts      # 页面内存状态（content=Markdown/nickname/date/avatar/watermark/styleId）
├── src/renderer/src/windows/main/pages/extend/card/markdown-utils.ts   # md 外链图下载为 dataURL → note-markdown → HTML 块
└── src/renderer/src/windows/main/pages/extend/card/components/
    ├── MarkdownEditorPanel.vue   # 卡片风格选择 + Markdown 源码编辑（插入图片）+ 作者信息 + 水印
    └── MarkdownPreview.vue       # 实时预览（包 NoteCardRenderer，md→blocks 转换 + 页数计数 + 导出代理）

Markdown 卡片渲染核心（全仓共用单一事实源）
├── src/renderer/src/components/card/NoteCardRenderer.vue         # ★ iframe 富卡渲染/实测分页/exportBlobs
├── src/renderer/src/components/card/card-template.ts             # ★ 模板实例化（renderCardTemplate）+ 默认骨架 + 骨架基础 CSS
├── src/renderer/src/components/card/note-markdown.ts             # ★ marked（gfm+硬换行）+ ==高亮==→<mark> + sanitize + 分块
└── src/renderer/src/windows/main/modules/tool/components/card/cardStyleTools.ts  # Agent 4 工具
```

> 管理页（设计 → 卡片风格）的整卡预览、主页面（Markdown 卡片）的预览与导出，走**同一套**
> `NoteCardRenderer` + `note-markdown`，风格系统在主页面直接生效（不再有参考站 runtime 映射层）。

## 2. 卡片风格数据契约

### 2.1 属性注册表（`card-style-props.ts`，唯一扩展点）

```ts
interface CardStyleProp {
  key: string          // 样式 JSON 键，如 'title.color'（即白名单）
  label: string        // 中文名（表单 + AI 提示词共用）
  group: 'card' | 'title' | 'author' | 'body' | 'quote' | 'image' | 'footer'
  type: 'color' | 'length' | 'enum' | 'number' | 'font'
  options? / min? / max? / unit?    // 取值约束
  fallback: string     // 缺省 / 非法回落值；空字符串 = 不产出 CSS 规则
  css: (v) => string   // 合法值 → CSS 规则（作用于 iframe 骨架 .note-card / .nc-title / .nc-content 等）
}
```

- `normalizeCardStyleProps(raw)`：白名单外键剔除、逐键类型校验、非法回落 fallback，**输出恒完整**。
- 全部属性 CSS 作用于 `NoteCardRenderer` iframe 骨架固定类名（`.note-card` / `.nc-header` / `.nc-avatar` /
  `.nc-author` / `.nc-date` / `.nc-title` / `.nc-content`（h1-6/ul/ol/blockquote/mark/strong/a/hr/pre/img 等）/ `.nc-footer`），
  `buildCardStyleCss(props)` 逐条生成注入 iframe。
- **扩展新样式 = 注册表追加一条记录**，校验 / 渲染 / 表单 / AI 提示词 / 工具 schema 全部自动生效。

### 2.2 存储形状与落盘

```ts
interface AiCardStyleCore {
  name: string
  description: string
  tags: string[]
  props: Record<string, string>   // 快捷层：注册表白名单键值对
  template: string                // 自由层：HTML 模板（data-nc 插槽契约；空 = 默认骨架）
  css: string                     // 自由层：自定义 CSS（最后注入，可覆盖前两者）
}
interface AiCardStyleItem extends BaseEntity, AiCardStyleCore {}   // index.json 索引项（即完整数据）
interface AiCardStyle  extends AiCardStyleItem { isSystem: boolean }  // card-style-{id}.json
```

`~/.mistrelle/card-style/index.json` + `card-style-{id}.json`（镜像 design 模式，索引项即完整数据，编辑无需读单条文件）。
内置预设 7 套代码常量不落盘，`CardStyleStore.all` = 预设在前 + 用户自建；`put`/`remove` 硬门控 `extendedCardStyles`。
旧数据缺 template/css 字段：`normalizeCardStyleItem` 读时兜底补空串，无迁移。

### 2.3 自由层契约（`card-style-template.ts`）

- **插槽契约**：模板通过 `data-nc` 属性声明插槽，渲染器逐页实例化并填充——
  `content` 正文（**必填**，markdown 块注入点 + 分页实测测量目标）、`header` 卡头（首页，作者+头像+日期）、
  `title` 标题（首页）、`footer` 页尾水印（每页）；某页插槽内容为空时该元素被移除（防空占位）。
- **画布不变**：模板渲染在固定画布 `.note-card`（360×480、overflow:hidden）内部，尺寸/缩放/导出机制不受影响；
  实测装箱分页改为查询 `[data-nc="content"]`（默认骨架的 content 插槽即原 `.nc-content`）。
- **归一清洗**（`normalizeCardStyleTemplate` / `normalizeCardStyleCss`）：
  - 模板：剥 `<script>`/`<style>` 块、script/iframe/object/embed/link/meta/base/form 标签、`on*=` 事件属性、
    `javascript:` 协议、`</style|</body|</html` 闭合逃逸；**缺 content 插槽或超 20000 字符 → 整条作废回退默认骨架**。
  - CSS：剥 `</style` 闭合序列，超 8000 字符截断（CSS 截断只丢尾部规则，安全）。
- **注入顺序**（NoteCardRenderer）：`nc-style`（注册表 CSS）→ `nc-base`（骨架基础 CSS，现居 card-template.ts）→
  `nc-extra`（风格 css），后者可覆盖前两者。
- **实例化**（`card-template.ts` 的 `renderCardTemplate`）：DOMParser 填充插槽（不执行脚本、不加载资源），
  纯字符串进出，`doc.write` 全量写入与 `innerHTML` 增量更新两条路径共用。
- 面向表单/AI 的契约说明由 `describeCardStyleSlots()` / `describeCardStyleCss()` 自动生成。

## 3. Markdown 卡片主页面（2026-09-05 三改定稿）

> 需求拍板：**主界面就是 Markdown 卡片**——正文区整体改为 Markdown 源码编辑，预览按真实排版渲染；
> 作者 / 水印保留；配图走 Markdown 图链（本地图上传转 dataURL 插入）。曾短暂尝试的「富 Markdown 抽屉旁路」
> （rich/）已回退删除，主页面即为富卡本体。

- **布局 / 交互**：`page-layout` 头部 #extra = 导出卡片按钮（多页显示张数）。左栏 `MarkdownEditorPanel.vue`：
  顶部卡片风格选择（t-select，同参考站唯一入口惯例），Markdown 源码编辑（t-textarea autosize，「插入图片」
  把本地图转 dataURL 并以 `![配图](dataURL)` 插到光标处），作者信息（t-avatar 上传 / 昵称 / 日期）、底部水印。
  右栏 `MarkdownPreview.vue`：3:4 实时预览 · 长文自动分页。
- **Markdown → 卡片 HTML**：正文 Markdown 经 `markdown-utils.markdownToCardBlocks` → 先收集 `![](url)` 外链图，
  `fetch` 下载为 dataURL（失败保留原 URL；本地 dataURL 图已内嵌无下载）→ `renderMarkdownHtml`（marked：
  gfm + hard break + `==高亮==→<mark>`，渲染后 `sanitizeHtml` 纵深防御：剥 script/iframe/on*/javascript:）→
  `splitHtmlBlocks` 分块。外链图下载成本大，MarkdownPreview 对 content 变更做 **350ms debounce** 再转换。
- **渲染 / 分页 / 导出**：全部由 `NoteCardRenderer` 承担——iframe 沙箱渲染，探针卡实测各块 offsetHeight 装箱
  （首页含作者 + 标题占位、后续页仅页尾），图片异步加载完成二次重测；导出走其 `exportBlobs(pixelScale=3)`
  屏幕外 iframe 逐张 snapdom 截 PNG Blob → `MarkdownPreview.exportPngs` 转 dataURL，主页面单张下载 / 多张 jszip 打 zip。
- **作者卡头**：NoteCardRenderer 新增可选 `date` prop（昵称下方小字 `.nc-date`），主页面传入昵称 + 日期 +
  dataURL 头像；管理页预览不传 date，行为不变。
- **状态**：`state.ts` 模块单例（content=nickname/dateStr/avatar/watermark/styleId），路由切换不丢、重启即空，
  无任何落盘。风格缺省 = `buildDefaultCardStyleProps()`（默认预设全部 fallback，白底）。
- **删除的参考站层（勿再引入）**：`pages/extend/card/xhs/` 全部（protocol.ts 分页常量 / card-html.ts /
  exporter.ts / imports.ts / PreviewCard / EditorPanel / xhs-studio.css 等）与第一版富卡抽屉 `rich/` 已删；
  纯文本 `[img]` 标记语法、`buildXhsRuntime` 参考站 runtime 映射不再使用。

## 4. 设计 → 卡片风格管理页

- 页面 `/design/card`（DesginCardPage.vue）：hero（新建按钮 + 会员 badge）+ 搜索 + 网格；无详情路由，查看/编辑全抽屉。
- `CardStyleFace.vue` 用固定示例内容 + NoteCardRenderer 整卡所见即所得，含示例作者/水印（与主页面同款渲染器）。
- 编辑表单按注册表分组自动出控件（color→ColorPicker、length/number→InputNumber、enum→Select、font→真实字体下拉）；
  下方「自定义模板」区提供 HTML 模板 / 自定义 CSS 两个等宽 t-textarea（折叠面板展示插槽契约说明），预览实时联动。
- 详情抽屉在注册表分组值之外，风格含自由层时以等宽 `<pre>` 只读展示模板与 CSS 源码。

## 5. 「卡片风格创建助手」内置专家

- 内置专家 `builtin:card-style`（`BuiltInAgent.ts`，同族：agent-create / skill-create / design-style）：
  identity 覆盖三层模型（props 七组 / template 插槽契约 / css 自由层，含「注册表 props 只作用 `.nc-*` 类名」的作用域提醒），
  tools = cardStyleTools 直注 + `font_list`；placeholder「描述你想要的卡片风格，例如：一个苹果备忘录样式的横线信纸卡片」。
- **会员门控**：`AiAgentStore.BUILTIN_AGENT_FEATURE_GATES`（id → feature key 映射）按 `extendedCardStyles` 过滤，
  非会员不可见；会员期内开过的历史会话经 `getById`（全量查找）仍可继续（同 design-style 先例，见 docs/ai/02）。
- `cardStyleTools.ts`：`list_card_styles` / `get_card_style` / `create_card_style` / `update_card_style`，
  全部 `internal: true`（镜像 designStyleTools，同时注册进 toolGroups `card-style` 与 toolMap）；
  props 经注册表校验清洗（update 支持部分键合并）；template/css 经自由层清洗（**整体替换**语义，不传 = 不变）；
  list/get 概要含完整 props/template/css 供模型借鉴；系统预设只读。
- 注册表 / 契约扩展后，工具 schema 自动同步，无需改动。
- **历史沿革**：曾有 ChatType `'card'`「卡片样式生成」（prompt = buildCardStylePrompt + 同组工具），
  2026-09-06 因内置专家承接同一能力而整体移除（ChatType 联合 / CHAT_TYPE_OPTIONS / CHAT_TYPE_CONFIG /
  SUB_AGENT_ALLOW 的 card 键、CardStylePrompt.ts 均已删）；存量 `'card'` 类型会话不特殊处理（同 PPT 移除先例）。

## 6. 会员门控（`extendedCardStyles`）

- `AuthFeatureKey` / `AuthTierInfo` / `AuthStore.FREE_FEATURES` / preload `authChannels.ts`（type + FREE + normalize）+
  `MemberTierContent.vue` 权益表，五处同步；**服务端在 features 数组返回该键后自动生效**（服务端暂未启用）。
- 语义（同 design 的 `extendedDesignStyles`）：内置预设人人可用；新建/编辑/删除会员限定——UI 锁定（badge+disabled+warning）、
  Store 硬拒绝（防 AI 工具旁路）、AI 工具层再拦一次；非会员 AI 面仅见内置预设。Markdown 卡片页本身不设门控。

## 7. 注意事项

- 页面文件名 `DesginCardPage.vue` 为既有命名；菜单：设计→设计风格/卡片风格/字体，闲庭漫步→笔记卡片（/attachment/card）。
- **全仓只有一条 Markdown 卡片渲染链**：`note-markdown`（md→HTML 块）→ `NoteCardRenderer`（iframe 渲染/分页/导出）。
  主页面与管理页共用，改动影响两侧；卡片风格 = 这套 iframe + 注册表 CSS + 自由层（模板/CSS）。
- 卡片逻辑尺寸 360×480（3:4），预览按容器宽度缩放、导出按 1:1×3 截图；注册表 `title.*` 对应首行 `#` 之外的
  独立标题输入（主页面当前由 Markdown 内部 `##` 承担正文小标题，`.nc-content h1-6` 消费）。
- **模板与注册表 props 的作用域**：注册表 `title.*`/`body.*`/`quote.*` 等只作用于骨架类名（`.nc-*`），
  自定义模板用自己的类名时这些属性不生效，模板排版全靠风格 css（可复用 `nc-*` 类名继承注册表样式后再覆盖）；
  `card.*`（作用于 `.note-card`）在模板下仍有效。
- **预设「苹果备忘录」（preset-card-apple-notes）是自由层写法示范**：props 只配 `card.*`，横线信纸 =
  `.an-content` 上的 repeating-linear-gradient（行高 28px 与横线周期对齐、p margin 28px 保持节律），
  题头装饰 = `.apple-notes::before` 渐变条；做新主题可参照。
- 新依赖：`@zumer/snapdom`（iframe 预览导出）、`marked`（markdown 渲染）、`jszip`（多卡打包），均按需 dynamic import。
- 首版曾自研「iframe 渲染器 + 笔记落盘（~/.mistrelle/notes）」、二次修订为参考站 1:1 移植（字符串正文 + [img]）、
  三次修订（当前）改为 **Markdown 优先主页面**并删除参考站层；NoteCardRenderer 由此成为主页面与管理页共用的渲染器。
- 外链图片在预览转换时即下载为 dataURL（导出 iframe 不被跨域污染）；Markdown 源码里保留用户原图链不动，
  dataURL 只进渲染块。富卡 `==高亮==` 由 note-markdown 预处理为 `<mark>`，注册表 `body.highlight` 控制底色。
