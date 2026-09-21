# 09 - 公众号场景（gzh）

> 状态：已落地（2026-09-21）。写作家族第三个子场景：公众号创作流水线（选题 → 写作 → 标题 → 排版 → 质检）。

## 实现思路

在写作家族（`ChatType = 'writing'`）下新增子场景 `WritingScene = 'gzh'`，方法论文本改编自外部 skill 包 **gzh-Skills**（12 个子 skill + 共享 references 的 Python/Markdown 流水线，位于 `~/Documents/temp/creator-buddy/gzh-Skills/`），按本项目工具面改写后注入：

- **数据模型复用文章工作台**：公众号文章与「文章创作」同库（`articleStore`，按文章类型区分平台），工具面共享 `article_*`；零新增数据层。
- **skills 注入**：本项目第一个使用 `SceneDefinition.skills` 的场景。`skillCatalog` 贡献者把 `name + description` 列进 `<available_skills>` 目录（渐进披露），模型按需 `load_skill`，解析链兜底 `findBuiltInSkill`（遍历 `ALL_SCENES`）。
- **排版本地渲染**：AI 不生成 HTML（原 skill 让 LLM 全文输出内联样式）。Markdown 经 `gzhLayoutRender`（marked + 元素级 style 映射）本地注入内联样式，侧边栏预览 + 一键复制。零 token、毫秒级、风格可复用。
- **Python 脚本 → tool**：`fetch_gzh_trends.py`（四榜）+ `daily_sector_trends.py`（赛道日报）合并为主进程 `gzhTrends` 域 + 渲染层 `gzh_trends` 工具；HTML 报告不再生成，结构化数据交 AI 解读。`generate_chart.py` 不搬（项目已有 design_draw / 生图子 Agent）。同日补齐：`gzh-positioning`（定位三件套）、`gzh-short`（短文从 gzh-write 拆出独立）、`gzh-trends` 补默认赛道组与多赛道对比。**二期扩展位**见文末。

## 关键文件

| 文件 | 职责 |
|------|------|
| `modules/chat/writingScene.ts` | `WritingScene` 加 `'gzh'` |
| `modules/chat/scenes/gzh/index.ts` | gzhScene 定义（prompt / skills / tools / aside） |
| `modules/chat/scenes/gzh/skills/*.md` + `skills.ts` | 8 个内置 skill（?raw 打包，canvas guidelines 同款模式） |
| `modules/chat/scenes/index.ts` | `SCENES.writing` 注册 + `SCENE_FAMILY_META` 二级选项（LogoWechatStrokeIcon）；PageNew / resolveScene 全自动生效 |
| `modules/gzh/gzhTypes.ts` | `GzhStyle / GzhStyleItem / GzhStyleForm` + `GZH_STYLE_ELEMENT_KEYS` 白名单 |
| `modules/gzh/gzhStylePresets.ts` | 4 套内置预设（claude / openai / google / card），isSystem 只读 |
| `modules/gzh/gzhStyleService.ts` + `store/gzh/GzhStyleStore.ts` | 风格持久化（`~/.mistrelle/gzh-style/`）+ Pinia store（已入 `store/index.ts`） |
| `modules/gzh/gzhLayoutRender.ts` | Markdown + styles → `<section id="gzh-content">` 内联样式片段 |
| `modules/gzh/gzhLayoutPipeline.ts` | 下游管线：`resolveGzhLayoutImages`（图片→dataURL）/ `buildGzhPreviewDoc`（预览文档）/ `copyGzhLayoutToClipboard`（text/html + text/plain 双写） |
| `modules/gzh/gzhAi.ts` + `gzhPromptContent.ts` | aside 直呼 LLM 封装（`gzhComplete` / `extractGzhJson` / `resolveGzhModel`）+ 质检 prompt 契约 |
| `modules/tool/components/gzh/gzhStyleTools.ts` | 4 个 internal 风格管理工具（已入 `toolMap`；internal 被 toolGroups 过滤故不建组） |
| `modules/tool/components/gzh/gzhTrendTools.ts` | `gzh_trends` 工具（薄封装，走 preload 桥） |
| `src/main/src/modules/gzh/gzhTrends.ts` + `gzhIpc.ts` | 抓取实现（Node https + no-SNI 回退）与 `gzh:trends` 通道 |
| `src/preload/src/modules/gzh/` + `src/common/types/gzhTrends.ts` | IPC 桥（Channels + api）与三方共享契约 |
| `src/renderer/src/types/gzh.d.ts` + `vite-env.d.ts` | `window.preload.gzh` 类型（GzhApi） |
| `components/chat/aside/writing/gzh/GzhAside.vue` | 侧边栏：复用 article 四组件与 hooks，底部 t-tabs（排版预览 / 正文质检） |
| `components/chat/aside/writing/gzh/components/GzhLayoutPanel.vue` | 风格下拉 + iframe 实时预览（677px 内容宽）+ 一键复制 |
| `components/chat/aside/writing/gzh/components/QcSection.vue` | 正文质检卡片（自 pages/work/ 迁入并适配 aside props；原 pages/work 目录已删） |

## 数据结构 / API 契约

- **场景定义**：`gzhScene.tools = createArticleTools(ctx) + gzhStyleTools + gzhTrendTools + designDraw`；`subAgentAllow: ['research','image']`；`sandboxDirs` 与 article 相同（同库）；`asideProps` 比 article 多传 `messages`（质检解析当前对话模型）。
- **BuiltInSkill**：`{ name, description, content }`，八个 skill：`gzh-write`（长文六路写作路由 + 体裁五约束 + AI 腔黑名单）、`gzh-short`（短文 ≤1000 字：平台事实 + 双骨架 + AI 腔判定法 + 逐项检查清单）、`gzh-positioning`（定位三件套：微信硬约束 + 分层访谈 + 定位陈述闸门 + 简介/回复/菜单产出 + 字数校验）、`gzh-title`（16 法 + 评分分级）、`gzh-trends`（泛化词闸门 + 默认赛道组六组 + 多赛道横向对比 + gzh_trends 用法 + 解读协议）、`gzh-layout`（本地渲染分工 + 内容层要求 + 风格推荐）、`gzh-cover`（2.35:1 双裁切 + 安全区策略 + design_draw 配方）、`gzh-diagram`（SVG HTML / design_draw 双路线）。
- **`gzh_trends` 工具**：`{ mode: 'keyword'|'sector', keywords, sectors?, days?(≤30), maxItems?(≤30) }` → `{ keywordResults?（四榜 boards + merged 综合榜）, sectorResults?, errors[] }`；部分失败不整体报错（errors 聚合）。
- **风格管理**：存储 `~/.mistrelle/gzh-style/index.json`（索引）+ `gzh-style-{id}.json`（单条）；内置预设 id 固定（claude/openai/google/card）且 put 时拒绝撞 id。
- **IPC**：`gzh:trends`（GzhChannels）→ main `fetchGzhTrends`；契约三方共享于 `@common/types/gzhTrends.ts`。

## 注意事项

1. **源站 TLS**：onetotenvip.com 原 Python 用 no-SNI + CERT_NONE 非常规握手。TS 实现：主请求关证书校验，失败回退 `servername: ''`（不发 SNI），再叠指数退避重试；请求带 `Accept-Encoding: identity` 免 gzip。**连通性未经真实请求验证**（RL-07 禁测试，由用户实测）；不通时工具返回 errors，不影响场景其余功能。
2. **internal 工具不建组**：`toolGroups` 构建时过滤 internal（`.filter(!internal)`），gzhStyleTools 全 internal，照 card-style 先例只进 `toolMap` + 场景工厂注入，无需 toolGroups 条目。
3. **aside 直呼模型口径**：`resolveGzhModel` 取 `asideProps.messages` 最后一条 user 消息的 `provide:model`（当前聊天模型唯一真源），经 `SettingAiStore.optionMap` 解析；无消息时质检按钮给出提示。
4. **QcSection 迁移适配**：原 `props.wb / props.config.modelKey` 接口作废，新 props 为自包含 `{ title, content, model, disabled }`；`articlePanelProps.ts` 不再存在。
5. **旧数据兼容**：`writingScene` 水合回退值保持 `'article'`，存量聊天不受影响；`resolveScene` 无 default 分支，新值靠 SCENES.writing Record 穷尽约束兜底。
6. **复制管线**：剪贴板 `text/html + text/plain` 双写（Clipboard API → execCommand 兜底）；图片转 dataURL 后进剪贴板，本地相对路径基于正文 md 目录解析，解析失败保留原样（裂图可见，不静默吞）。

## 二期扩展位（未搬的源包能力）

| 源 skill | 能力 | 缺口 / 依赖 |
|------|------|------|
| `global-content-search` | 全域内容搜索：小红书 / B站 / 抖音关键词搜索、笔记详情、评论、博主作品监控 | 依赖外部 CLI（`agent-reach` / `bili-cli` / `opencli`）与 Guaikei API token 兜底；B站公开 API 可直连但小红书有 `xsec_token` 风控、抖音无公开后端。等主进程网络层统一改造后再评估做取数工具 |
| `xhs-hotnotes` | 小红书热门笔记搜索（相关性/热度/时效三维评分） | 脚本 `fetch_xhs_hot_articles.py`，需 `REDFOX_API_KEY`（红狐hub）；搬 md 无工具支撑即空话，与上条同批做 |
| 封面安全区校验脚本 | `check_cover.py` 导出安全区标注图与分享裁切预览 | 安全区规则已浓缩进 `gzh-cover` skill 文本；标注图生成留待有需再做 |

二期实施前提：主进程网络出口统一（axios + 代理收口，见 `docs/setting/09`）完成后，按「主进程单方法 + 薄 preload 桥」先例各做一个取数工具，方法论 md 随工具一并注入。
