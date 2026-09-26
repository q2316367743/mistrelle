# 10 - 小红书场景（xhs）

> 状态：已落地（2026-09-26）。写作家族第四个子场景：小红书创作（定位 → 选题 → 正文 → 标题 → 图文 → 数据复盘），图文产物走**画布画板**。

## 实现思路

在写作家族（`ChatType = 'writing'`）下新增子场景 `WritingScene = 'xhs'`，方法论文本改编自外部 skill 包 **xhs-Skills**（10 个 skill，位于 `~/Documents/temp/creator-buddy/xhs-Skills/`），按本项目工具面改写后注入。三项关键取向：

- **文归文章库**：发布文案 / 选题复用文章工作台（`articleStore` 同库，type 用「小红书」——该平台名已在 `ARTICLE_TYPES` 与平台模板里），零新增数据层。
- **图归画布画板**：图文卡片与封面用 `canvas_*` 引擎（leafer），**一页 = 一个画布文档**（引擎没有多页/画板概念，核实过），1080×1440 + 底部 18% 遮挡区；刻意**不用** HTML 引擎（html_create/html_write 面向单页设计稿，且用户要的是画板上可继续编辑的产物）。
- **侧栏主次 = 图为主**（2026-09-27 用户纠偏后定稿）：右侧用 **tab 切换两个同位一级视图**——第一个 tab「图片」是常驻画板（直接渲染 `DesignAside`：切页 / 上传 / 遮盖 / 元素树 / 属性面板 / 导出 PNG·PSD），第二个 tab「正文」用 **Monaco 编辑源码纯文本**、不做 Markdown 渲染（小红书不支持 Markdown，渲染层只会掩盖要复制发布的内容）；正文数据仍走 `article_*`，与 AI 写入共享同一 store。两面板均 `destroyOnHide: false` 常驻（画布不重建、正文保留撤销栈），正文 tab 额外 `lazy`——Monaco 必须在可见容器里创建，不能建在隐藏容器上。
- **数据归红狐**：把源包的 `fetch_xhs_hot_articles.py` 能力下沉为主进程 `xhs_hot_notes` 工具，凭证复用既有「第三方账号」链（与知乎同一条），未配置时降级公开检索并强制标注「未经数据验证」。

不拼接 `buildArticleScenePrompt()`：它的配图工作流写死「封面 16:9 + 插图 1:1 + design_draw / 生图子 Agent」，与小红书 3:4 画布路线直接冲突；笔记模型段落改在 `scenes/xhs/prompt.ts` 按本项目工具面浓缩重写（同 gzh 的做法）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `modules/chat/writingScene.ts` | `WritingScene` 加 `'xhs'`（水合回退保持 `'article'`，存量聊天不受影响） |
| `modules/chat/scenes/xhs/index.ts` | xhsScene 定义（prompt / skills / tools / aside 四件套） |
| `modules/chat/scenes/xhs/prompt.ts` | `buildXhsScenePrompt({ hasImageGenerate, hasRedfox })`：七段（创作模式 / 笔记模型 / 图文流水线 / 素材铁律 / 热点取数 / skill 路由 / 纪律），动态段落与工具注入同源门控 |
| `modules/chat/scenes/xhs/skills.ts` + `skills/*.md` ×10 | 10 个内置 skill（`?raw` 打包，gzh 同款模式） |
| `modules/chat/scenes/index.ts` | `SCENES.writing` 注册 + `SCENE_FAMILY_META.writing.variants` 加「小红书」（`StickyNoteIcon`） |
| `components/aside/writing/xhs/XhsAside.vue` | 小红书侧栏（图为主）：`t-tabs` 两个同位视图——「图片」（常驻画板）/「正文」（Monaco 源码编辑），均 `destroyOnHide: false` |
| `components/aside/writing/xhs/components/XhsTextPanel.vue` | 正文 tab：`useArticleDoc` 数据层 + **Monaco 源码编辑**（不做 Markdown 渲染）+ 多篇/多版本下拉 + 字数 / 自动保存状态 / 复制正文 |
| `components/aside/writing/components/PanelOverlay.vue` | 写作家族**共享**能力浮层外壳（原 `gzh/components/GzhPanelOverlay.vue` 上移，gzh 侧栏同步改用） |
| `modules/tool/components/xhs/xhsHotTools.ts` | `xhs_hot_notes` 工具（薄封装）+ `hasRedfoxAccess()` 门控 |
| `src/main/src/modules/xhs/xhsHotNotes.ts` + `xhsIpc.ts` | 红狐取数实现（`appAxios.post` 统一出口）+ `xhs:hot-notes` 通道 |
| `src/preload/src/modules/xhs/` + `src/common/types/xhs.ts` | IPC 桥（Channels + api）与三方共享契约 |
| `src/renderer/src/types/xhs.d.ts` + `vite-env.d.ts` | `window.preload.xhs` 类型（XhsApi） |
| `entity/setting/SettingAccount.ts` + `pages/setting/account/components/ThirdPartyAccountCard.vue` | 第三方账号新增 `redfox` 字段与「小红书数据（红狐）」配置行（safeStorage 整文件加密，deep watch 自动落盘） |

## 数据结构 / API 契约

- **场景定义**：`xhsScene.tools = createArticleTools(ctx) + createCanvasTools(ctx) + createDesignTools(ctx) + (hasRedfoxAccess() ? xhsHotTools : [])`；`subAgentAllow: ['research','image']`；`personalizeScope: 'writing'`；`sandboxDirs` 与 article 相同（同库）；`asideProps` 传 `sandbox/workspace/fullscreen/status`（status 供画板面板在作答中禁用切页）。**未注入 `design_draw`**：视觉路线单一（画布 + 生图），避免与 `canvas_*` 争抢工具选择。
- **10 个内置 skill**（name 去源包 `space-` 前缀、统一 `xhs-`）：
  | skill | 作用 |
  |---|---|
  | `xhs-router` | 总控：环节路由表 + 三条工作流（起号 / 日常 / 诊断）+ 三条纪律 |
  | `xhs-positioning` | 起号定位：7 步引导 + 赛道地图 + 5 维评分卡 + 定位句公式 + 人设三件套 + 前 20 篇 |
  | `xhs-hotspot` | 热点选题：取数口径 + 泛化词闸门 + **24 赛道词库** + 六个切口趋势判断 + 爆款共性提取（标签表 / 40%·20% 阈值 / 三张清单 / 选题公式） |
  | `xhs-title` | 标题：15 种方法 + 10 增强器 + 百分制评分 + 合规红线 + A/B 建议 |
  | `xhs-writer` | 正文：6 条文体硬约束 + 7 种笔记骨架 + 三层标签策略 + 高危词替换表 + 14 项发布前体检 |
  | `xhs-cover` | 封面：画板排版 / 生图直出双路线 + 12 种原创风格库 + 8 种构图 + 无字底图回退 |
  | `xhs-cards` | 多页图文卡片（画布版）：6-9 档页序 + 页面组件库 + 字号安全区 + 质量闸门（源 `xhs-html` 的 HTML/CSS 约束整体翻译成画布节点约束） |
  | `xhs-image` | 生图型信息图：固定「轻盈 AI 产品信息图」视觉系统 + Style Lock 英文段逐字复用 + 文字密度控制 + 逐图 10 项复核 |
  | `xhs-account-audit` | 账号体检：八维评分 + 判据扣分表 + 竞品对标 + 不可迁移项 + 固定输出格式 |
  | `xhs-note-analytics` | 数据复盘：14 项指标口径 + 六层漏斗定位 + 样本量红线 + 多条横向纪律 |
- **`xhs_hot_notes` 工具**：`{ keywords: string[]（1-3）, days?（≤30）, maxItems?（≤20） }` → `{ results?: [{ keyword, total, relatedSearches, items[] }], errors[] }`；条目字段 `title / desc / time / link / author / fans / likes / collects / comments / shares / interactive / score / recency / cover`（压缩后）。部分关键词失败只进 `errors`，不整体报错。
- **红狐接口**：`POST https://redfox.hk/story/api/xhs/search/search`，头 `X-API-KEY`，体 `{ keyword, pageNum: 1, pageSize ≤50, startDate, endDate, source }`；返回 `{ code: 2000, data: { articles[], total, relatedSearches[] } }`，**评分由接口返回不自行计算**，客户端按 `totalScore` 降序取前 N。
- **凭证链**：`SettingAccount.redfox` → `SettingAccountStore`（deep watch → `accountSave`）→ `~/.mistrelle/setting/account.json`（safeStorage 整文件加密，解密失败按明文兼容）；工具侧读取后**随请求参数经 IPC 下发**，主进程不留存、不落盘。
- **侧栏联动（白拿）**：图片 tab 直接渲染 `DesignAside`，与工具层共享 `getCanvasStore(sandbox)` 单例——AI 经 `canvas_*` 改动画布时侧栏 deep watch 实时重渲染；用户拖拽 / 改属性写回节点并落盘；双击节点经 `CANVAS_NODE_PICK_KEY`（`useChatSession` 在聊天页 provide）注入聊天输入框。正文 tab 与 AI 的 `article_write` 共享 `articleStore`（`contentRevs` 即时重读 + mtime 轮询兜底），多篇 / 多版本下拉仅在数量 > 1 时出现。

## 注意事项

1. **一页一画布**：小红书图文 = N 个 canvas 文档（`outputs/canvas-{version}.canvas`），侧栏画板下拉按版本号/标题切换；页名约定「封面 / P2 · 主题」。要「单文档多页」得扩 `CanvasDoc` 与渲染 / 导出 / 工具三层，本场景不做。
2. **尺寸统一 1080×1440**：源 skill 的字号体系（封面标题 88-128px、内页 60-76px、正文 36-44px）是按 1080 宽调的，故场景与 `xhs-cards` 统一按 1080×1440 建档（`canvas_create` 描述里另有 1242×1660 的写法，不冲突，但本场景以 1080 为准）。`canvas_export` 无倍率参数，导出即 1080×1440。
3. **门控同源**：`hasRedfoxAccess()` 同时决定工具注入与提示词段（配了 Key 才出现 `xhs_hot_notes` 用法，否则是公开检索兜底 + 「未经数据验证」纪律），避免提示词提到未注入的工具。`hasImageGenerateAccess()` 同理控制素材段落。
4. **出网前置闸**：`xhs_hot_notes` 调 IPC 前先过 `getDomainBlockReason('redfox.hk')`（沙盒域名黑白名单，复用 `native/search.ts` 的导出）。⚠️ 既有 `gzh_trends`（主进程路线）未接该闸，属存量口径差异。
5. **红狐连通性未实测**（RL-07）：源 Python 脚本用 `urllib` 直连，TS 实现走 `appAxios`（代理 / UA / TLS 随网络设置）；失败时工具返回 `errors` 聚合，不影响场景其余功能。
6. **源包落地差异**：① 三个付费数据源只搬红狐（`socialdatax` / `怪壳` 是外部 CLI，项目内无等价物），降级位置由 `any_search` / `browser_fetch` 承接；② Python / Node 校验脚本一律不搬——规格校验用 `image_info` + `canvas_inspect`，表格数据用 `file_read_xlsx`，渲染校验用 `canvas_export` 目测；③ `getdesign` 62 风格注册表 → 项目自带 `canvas_guidelines("styles")` 与设计风格体系；④ 源包 3 处失效的 `xhs-ops-copilot` 残留引用已改为对应 skill 名。
7. **工具面偏大**：article + canvas(12) + design(13) + xhs 取数 ≈ 40 个工具，function 定义 token 与 design 场景同量级；如需收敛可走「按需装载组」方向。
8. **正文被有意降级**（2026-09-27 纠偏：先做成二级页，再按用户意见改成第二个 tab）：小红书以图为主，故正文去掉文章工作台的重组件——**不引 tiptap 富文本**（小红书不支持 Markdown，渲染无意义）、**无去 AI 味 / 版本对比 / AI 检测 / 封面登记按钮**、标题只读（AI 设定）。保留的是：Monaco 纯源码编辑（800ms 防抖自动落盘，`useArticleDoc.saveDoc`）、字数、复制正文、多篇 / 多版本切换。要做富交互请先确认这是有意收窄而非遗漏。

## 后续（可做未做）

| 项 | 说明 |
|------|------|
| 图文页登记进文章类型 | 把导出的卡片 PNG 登记到 `article_update` 的 `images` 字段，让文章侧栏也能看到配图（当前靠画板面板切换预览） |
| socialdatax / 怪壳路线 | 外部 CLI 依赖，未接；如后续要做，可扩 `xhs_hot_notes` 的 `source` 参数 |
| 小红书数据源账号体检量化路径 | `xhs-account-audit` 目前只走截图 / 表格定性路径（公开检索兜底），未接外部 CLI 的量化路线 |
| 正文 tab 增强 | 目前只有源码编辑 + 复制；如需可在 tab 内补「去 AI 味」（`useArticleAssist`）与「版本对比」（`openVersionDiffDialog`）入口 |
