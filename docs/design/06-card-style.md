# 卡片风格与笔记卡片（card style & note card）

> 2026-09-05 落地，同日二次修订：**笔记卡片页改为参考站 jinsan.ok.kimi.link（XHS Card Studio）的 1:1 移植**
> （用户拍板：不要自由发挥，除「卡片风格」可选外其余完全照搬，且不需要本地保存笔记）。
> 卡片风格 = **白名单属性注册表 + JSON 键值对**（数据驱动可扩展）；管理页在设计分组；Agent「卡片样式生成」不变。

## 1. 全景与关键文件

```
卡片风格（样式约束，JSON 键值对，双端共用）
├── src/renderer/src/global/card-style-props.ts   # ★ 属性注册表（唯一扩展点）
├── src/renderer/src/global/CardStylePresets.ts   # 6 套内置预设（isSystem，不落盘）
├── src/renderer/src/entity/ai/AiCardStyle.ts     # 实体 AiCardStyleItem / AiCardStyle / Form
├── src/renderer/src/windows/main/modules/card/service/CardStyleService.ts   # ~/.mistrelle/card-style/
├── src/renderer/src/windows/main/store/card/CardStyleStore.ts               # Pinia，会员硬门控
├── src/renderer/src/windows/main/pages/design/card/DesginCardPage.vue       # 管理页（/design/card，全抽屉）
│   ├── components/（CardStyleCard / CardStyleFace / CardStylePropField / CardStylePropsForm）
│   └── modals/（CardStylePutDrawer / CardStyleDetailDrawer，.tsx 外壳 + .vue 内容）
└── src/renderer/src/windows/main/modules/card/service/CardStylePrompt.ts    # Agent 提示词（注册表生成）

笔记卡片页（jinsan.ok.kimi.link 的 1:1 移植，无本地持久化）
├── src/renderer/src/windows/main/pages/extend/card/index.vue     # 入口（/attachment/card）＝参考站 Home
└── src/renderer/src/windows/main/pages/extend/card/xhs/
    ├── xhs-studio.css        # 参考站编译产物整体搬入，全部选择器作用域化到 .xhs-studio（防污染全局）
    ├── protocol.ts           # ★ 解析/分页/常量 1:1 移植 + buildXhsRuntime（注册表→渲染参数）
    ├── card-html.ts          # ★ 卡片/量测器 HTML 单一事实源（预览与导出共用）
    ├── exporter.ts           # snapdom 导出（屏幕外渲染同源卡片 → 逐张截图），多卡走 jszip 打包 zip
    ├── imports.ts            # 图片降采样 / Markdown / Word(mammoth 懒加载) / 剪贴板 HTML 导入
    ├── PreviewCard.vue       # DOM 实时预览（与导出共用分页器与卡片 HTML，隐藏量测容器量块高）
    ├── EditorPanel.vue + useEditorPanel.ts   # 内容/作者/配图/水印/导入/粘贴 + 卡片风格选择（唯一增量）
    ├── ErrorBoundary.vue     # 预览崩溃兜底（参考站同名组件）
    ├── icons.ts + XhsIcon.vue / state.ts / default-avatar.png
└── src/renderer/src/windows/main/modules/tool/components/card/cardStyleTools.ts  # Agent 4 工具

Agent「卡片样式生成」（ChatType 'card'）
├── src/renderer/src/windows/main/modules/chat/chatType.ts + global/ChatTypeConfig.ts
└── src/renderer/src/windows/main/modules/subagent/types.ts（SUB_AGENT_ALLOW.card = ['research']）
```

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
  css: (v) => string   // 合法值 → CSS 规则（作用于 .note-card / .nc-title / .nc-content 骨架）
}
```

- `normalizeCardStyleProps(raw)`：白名单外键剔除、逐键类型校验、非法回落 fallback，**输出恒完整**。
- 首批 26 个属性（含作者 author.* 与页尾 footer.* 两组，服务于管理页预览面）。
- **扩展新样式 = 注册表追加一条记录**，校验 / 渲染 / 表单 / AI 提示词 / 工具 schema 全部自动生效。

### 2.2 存储形状与落盘

```ts
interface AiCardStyleCore { name: string; description: string; tags: string[]; props: Record<string, string> }
interface AiCardStyleItem extends BaseEntity, AiCardStyleCore {}   // index.json 索引项（props 即全量）
interface AiCardStyle  extends AiCardStyleItem { isSystem: boolean }  // card-style-{id}.json
```

`~/.mistrelle/card-style/index.json` + `card-style-{id}.json`（镜像 design 模式，索引项即完整数据，编辑无需读单条文件）。
内置预设 6 套代码常量不落盘，`CardStyleStore.all` = 预设在前 + 用户自建；`put`/`remove` 硬门控 `extendedCardStyles`。

## 3. 笔记卡片页＝参考站 1:1 移植（2026-09-05 二次修订）

参考站是 React+Tailwind SPA：**DOM 实时预览 + Canvas 导出共用同一套分页器**，这是我们分页精准的根本。

- **布局 / 交互**：固定头部（XHS Card Studio + 导出按钮，多页时显示张数）、左栏「图文卡片生成器」编辑面板
  （文章内容 + 粘贴图文/插入配图/加粗/高亮/导入 Markdown/导入 Word、作者信息头像昵称日期、配图网格、底部水印）、
  右栏实时预览（3:4 · 长图自动加长 · 页码）、快门闪光、自定义光标代理、ErrorBoundary。
- **语法**：`**加粗**`、`==高亮==`、`[img]`（按序取图）/ `[img2]`（指定第 2 张）；无标记时配图依序插入开头。
- **分页（oh 逐值移植）**：块高 = DOM 实测（隐藏量测容器逐块 offsetHeight，预览与导出同法）；首页扣作者卡头 54、
  每页扣水印 44；高图（>480）独占整页 fullBleed（页高按宽缩放封顶 1100）；剩余空间够则压高收图（≥120）。
- **卡片 HTML 单一事实源（`card-html.ts`）**：`buildCardHtml` / `buildMeasurerInnerHtml` 同时供
  PreviewCard 实时预览（v-html）与导出（屏幕外容器）使用，文本经 escapeHtml，所见即所得由结构保证。
- **导出（2026-09-05 三改：@zumer/snapdom，替代 Canvas 绘制移植）**：屏幕外容器（`position:fixed; left:-10000px`，
  禁用 display:none/visibility:hidden 否则截空白）渲染同一份卡片 HTML → 等图片 complete → 逐张
  `snapdom(el, { scale: 3 })` → `result.toPng().src` 得 1200 宽 PNG dataURL；单张直接下载，多张 jszip 打 zip（懒加载）。
  旧 Canvas 绘制专用函数（wrapLines/roundRectPath/fontOf/loadImage）已删。
- **不持久化**：内容 / 作者 / 配图 / 水印均为页面内存状态（state.ts 模块单例，路由切换不丢、重启即空），无任何落盘。

### 卡片风格注入（本页唯一增量）

`buildXhsRuntime(props)`：把注册表键值对映射为渲染/导出的外观参数（card.background→卡底、card.color→文字、
body.highlight→高亮底、body.size/lineHeight→字号行高（块间距=1.2×字号随之缩放）、card.padding→内边距（内容宽随之）、
card.radius/image.radius、card.font→字体栈前插、author.color→日期色、footer.color/size→水印）。
**不选风格 = 参考站原样**（全部取站点默认值）；选择器用 t-select（RL-04），置于编辑面板顶部。
注册表的 title.*/quote.* 在本页无对应元素，不参与映射（管理页预览面照常消费）。

### 参考站样式与脚本的隔离

- `xhs-studio.css`：参考站编译 CSS 整体搬入，构建脚本把每个选择器前缀化到 `.xhs-studio`（`html/:root/body` 映射到
  `.xhs-studio`），Tailwind preflight 不会外泄；`body.cursor-hidden` 特例映射为 `.xhs-studio.cursor-hidden`。
- **颜色已全部主题化（2026-09-05）**：声明体里的裸色值 / shadcn hsl 变量统一替换为 theme.less 的 tdesign token——
  文字层级 #1A1A1A→`--td-text-color-primary`、#555/#666→secondary、#888→placeholder、#AAA/#C0C0C0→disabled；
  背景与边框 #F5F5F5→`--td-bg-color-secondarycontainer`（hover→secondarycontainer-hover）、#F0F0F0→`--td-component-stroke`、
  #E5E5E5→`--td-border-level-2-color`；品牌红 #FF2442/#E02038→`--td-brand-color(-hover)`、#FFF5F6→`--td-error-color-light`、
  头部 `bg-white/90`→`--fluent-acrylic-bg`；带透明度的写法用 `color-mix(in srgb, token N%, transparent)`。
  **选择器里的转义 hex（如 `.bg-\[\#FF2442\]`）不可替换**——替换只作用于声明体；生成脚本见 `/tmp/gen-xhs-css.js` 思路
  （作用域化 + 仅声明体替换，rgb 平衡括号匹配避免嵌套 var 残留 `)`）。
- 卡面（`.card-canvas`）与导出图仍由 runtime 决定（默认参考站白底作品色，不随主题翻转）；页面 UI 随主题明暗。
- `fixed` 头部在应用内容区改为 `.xhs-page .xhs-header { position: sticky }`（覆盖 `fixed` 类，行为一致）。
- 图标为 lucide 线框（icons.ts 节点数据 1:1 提取自参考站 bundle），`XhsIcon.vue` 渲染。

## 4. 设计 → 卡片风格管理页（保留自首版）

- 页面 `/design/card`（DesginCardPage.vue）：hero（新建按钮 + 会员 badge）+ 搜索 + 网格；无详情路由，查看/编辑全抽屉。
- `CardStyleFace.vue` 用固定示例内容 + NoteCardRenderer（iframe 渲染器）整卡所见即所得，含示例作者/水印
  （iframe 渲染器 `src/renderer/src/components/card/` 的 NoteCardRenderer + note-markdown 仅服务管理页预览）。
- 编辑表单按注册表分组自动出控件（color→ColorPicker、length/number→InputNumber、enum→Select、font→真实字体下拉）。

## 5. 「卡片样式生成」Agent

- `ChatType` 新增 `'card'`；`CHAT_TYPE_OPTIONS`（StickyNoteIcon）；`SUB_AGENT_ALLOW.card = ['research']`。
- `CHAT_TYPE_CONFIG.card`：prompt = `buildCardStylePrompt()`（属性白名单清单自动从注册表生成）；tools = `cardStyleTools` 直注。
- `cardStyleTools.ts`：`list_card_styles` / `get_card_style` / `create_card_style` / `update_card_style`，
  全部 `internal: true`（镜像 designStyleTools，同时注册进 toolGroups `card-style` 与 toolMap）；
  props 经注册表校验清洗，update 支持部分键合并；系统预设只读。
- 注册表扩展新属性后，工具 schema 与提示词自动同步，无需改动。

## 6. 会员门控（`extendedCardStyles`）

- `AuthFeatureKey` / `AuthTierInfo` / `AuthStore.FREE_FEATURES` / preload `authChannels.ts`（type + FREE + normalize）+
  `MemberTierContent.vue` 权益表，五处同步；**服务端在 features 数组返回该键后自动生效**（服务端暂未启用）。
- 语义（同 design 的 `extendedDesignStyles`）：内置预设人人可用；新建/编辑/删除会员限定——UI 锁定（badge+disabled+warning）、
  Store 硬拒绝（防 AI 工具旁路）、AI 工具层再拦一次；非会员 AI 面仅见内置预设。笔记卡片生成页本身不设门控。

## 7. 注意事项

- 页面文件名 `DesginCardPage.vue` 为既有命名；菜单：设计→设计风格/卡片风格/字体，闲庭漫步→笔记卡片（/attachment/card）。
- 参考站移植代码全部收敛在 `pages/extend/card/xhs/` 内；`xhs-studio.css` 是整文件作用域化的第三方产物，勿手工精简。
- 协议常量（400 逻辑宽、3:4、54/44/32/28/18/1.8 等）与参考站逐值一致，改动前先对照 protocol.ts 注释。
- 新依赖：`@zumer/snapdom`（管理页 iframe 预览导出）、`marked`（管理页 markdown 渲染）、`jszip`（多卡打包）、
  `mammoth`（Word 导入，懒加载）。snapdom/mammoth 已按需 dynamic import。
- 首版曾自研「iframe 渲染器 + 笔记落盘（~/.mistrelle/notes）」，二次修订按用户拍板整体替换为参考站 1:1 移植并删除落盘；
  iframe 渲染器仅剩管理页预览用途。AppSide/路由/Agent 门控链路不受影响。
- 首行标题回落、`==高亮==`、`[img]` 序号取图等行为与参考站逐一对齐；`title.*/quote.*` 注册表组仅管理页预览消费。
