# 字体工具（font_list / font_pick）与字体渲染

> 画布文字指定字体的完整链路：本机可用字体查询 → 指定 fontFamily → 渲染前确保字体就绪。
> 设计类对话（design chat）注入 font_list（查询）、font_pick（让用户挑选）两个工具；
> 另注册 `font_list` 单例进 `toolMap`（`src/modules/tool/index.ts`），内置 Agent（如「设计风格创建助手」）
> 声明后可在任意聊天类型下查询字体（`fontTools.ts` 导出 `fontListTool`）。
>
> 关键文件：
> - 工具工厂 `src/modules/tool/components/design/index.ts`
> - 字体工具 `src/modules/tool/components/design/fontTools.ts`
> - 字体元数据推断 `src/utils/fontMeta.ts`（启发式分类 + 统一过滤，工具与页面共用）
> - 字体预览加载 `src/utils/fontPreview.ts` + 通用预览组件 `src/components/FontPreviewText.vue`
> - 选字面板 UI `src/components/chat/chat-assistant/tool/FontPickChatTool.vue`（经 RChatTool 挂载）
> - 交互桥 `src/modules/chat/agent/interactive.ts`（InteractiveBridge，font_pick 决策）
> - 渲染层字体注册器 `../../src/modules/canvas/fontRegistry.ts`
> - preload 字体模块 `src-utools/src/font.js`（Node 环境，系统字体扫描 / 资源库管理 / 元数据持久化）
> - preload 挂载 `src-utools/preload.js`（`window.preload.font`）
> - 类型声明 `src/types/font.d.ts` + `src/vite-env.d.ts`
> - 资源管理页 `src/pages/setting/assets/SettingAssetPage.vue`（路由 `/setting/assets`）
> - 资源管理弹窗 `src/pages/setting/assets/modals/FontMetaDialog.tsx` + `FontMetaContent.vue`
> - 渲染接入点 `canvasRender.ts`（exportCanvasPng）/ `CanvasRenderer.vue`（预览）

---

## 1. 背景与设计

画布文字渲染跑在 **uTools 的 Chromium 渲染进程**（Leafer 走 canvas 2D），`canvas_batch_edit` 的
`fontFamily` 字段早已支持。真正的缺口是：**模型不知道本机有哪些字体**，只能臆想（如 "Outfit"）
导致回退默认字体。本功能补齐「查询 → 指定 → 就绪」闭环。

**统一契约**：任何字体都以 `{ name, path, source, meta? }` 输出，`source` 枚举：

| source | 含义 | 渲染方式 |
|---|---|---|
| `system` | 系统已安装字体 | Chromium 原生（最精确、零加载） |
| `library` | 资源库字体（用户入库） | 渲染层 `new FontFace(name, buffer)` |
| `online` | 在线字体（**预留**，此版不实现） | 同 library |

对外体验完全一致：模型拿到 `name` 填 `fontFamily` 即可，`ensureFontsForDoc` 内部自适应分流。

## 2. 资源库与索引（~/.mistrelle/assets）

```
~/.mistrelle/assets/
├── index.json        # 索引：{ version, updatedAt, fonts: [{ name, path, source, addedAt, meta? }] }
└── fonts/            # 字体文件（ttf/otf/woff/woff2/ttc/otc），path 相对 assets/
```

- **启动零解析**：读 `index.json` → `readDir(fonts/)` 拿全部文件名 → 存在性校验剔除失效条目，
  不再逐个解析字体文件，极大简化效率。
- **入库**（资源管理页「添加字体」调用 `addFont(path, meta?)`）：解析 name 表拿族名（仅此一次）→
  拷贝到 `fonts/` → 写回 `index.json`（含可选 `meta`）→ 之后 `font_list` 永久包含。
- **同名覆盖**：入库时按 `name` 覆盖旧条目与旧文件。
- 字体库目录跨聊天共享（与聊天索引同级），未来在线字体下载也落 `fonts/` 并标记 `source: 'online'`。

## 3. 系统字体缓存（~/.mistrelle/font-cache.json）

- 结构：`{ version, updatedAt, fonts: [{ name, path, meta? }] }`，由 preload 自动生成。
- **每次启动后台刷新**（fire-and-forget，模块加载即触发）：全量扫描系统字体目录 → 解析 name 表 →
  写回缓存。刷新期间可并发等待同一 promise，不阻塞。
- **meta 合并保留**：重扫结果按族名合并旧缓存中的用户 meta，**已删除字体连同其 meta 一并剔除**，
  实现「本地字体删了缓存就同步清理」。缓存写走 `withCacheLock`，与 `updateFontMeta` 串行防覆盖。
- **读取**：有缓存立即返回（二次启动零等待）；无缓存（首次）等待一次全量扫描。
- 系统字体目录：macOS `/System/Library/Fonts`、`/Library/Fonts`、`~/Library/Fonts`；
  Windows `%WINDIR%\Fonts`；Linux `/usr/share/fonts` 等。扩展名白名单
  `ttf/otf/ttc/otc/woff/woff2`。

## 4. name 表解析（TTF/OTF/TTC）

- 用 `node:fs` `open`+`read` **按需精准读取**（读头判断 `ttcf`/sfnt/`wOFF` → 定位 name 表 offset/length），
  不全量读大 ttc 文件。
- **TTC 注意**：table directory 里的 offset 是**相对文件开头的绝对偏移**（不叠加子字体 sfntOffset）。
- 族名取 `nameID=1`（家族）优先 `nameID=16`（排版家族）；编码优先
  `platformID=3 + encodingID=1`（Windows Unicode UTF-16BE），回落 Unicode / Macintosh（iconv-lite 解码）。
- WOFF/WOFF2 内部结构不同，直接返回 null（入库时回退文件名作为 name）。

## 5. 字体元数据（五维分类）

每个字体项携带 `meta: { type, style, weight, license, language }`，用于分类过滤与选字参考。

**数据优先级**：持久化值（资源库 `index.json` / 系统字体 `font-cache.json`，用户入库或编辑时手动指定）>
按名称启发式推断（`inferFontMeta`，渲染层 `fontMeta.ts` 即时计算，`resolveFontMeta` 统一取数）。

各维度取值与启发式规则（关键词按优先级匹配，中英混合；ASCII 单词按 token 精确匹配防误伤，如
`light` 不会命中 `Moonlight`）：

| 维度 | 取值 | 启发式默认 | 关键词要点 |
|---|---|---|---|
| 类型 | 黑体/宋体/圆体/创意/仿宋/书法/手写/楷体/隶书/行书/草书/像素/其它 | 其它 | 仿宋→fangsong；黑体→黑/雅黑/hei/sans；宋体→宋/明/song/serif/ming；圆体→round/yuanti；楷→kai；隶→lishu；行→xing；草→cursive；书法→brush/calligraphy；手写→hand/script/pen；像素→pixel/点阵；创意→creative/display/艺术 |
| 风格 | 简约/现代/古典/中国风/手写风/稳重/有趣/卡通/尖锐/力量/豪放/复古/科技感/可爱/涂鸦/像素/活字风/花式/AI生成/其它 | 其它 | 主观标签，仅名称含明确关键词时命中，多数归其它 |
| 字重 | 纤细/细/正常/粗/超粗/多字重/可变 | 正常 | thin/hairline=纤细；light=细；regular/book/medium/roman=正常；bold/semibold=粗；black/heavy/extrabold=超粗；variable=可变；多字重仅名称含「多字重/multiweight」时命中 |
| 授权 | 作者声明/OFL/IPA/MIT/GPL/CC-BY/CC0/1.0/自由共享/开放授权/APR/APL/YDOFL/ISAS | 作者声明 | ofl/ipa/mit/gpl/cc0/cc-by 等关键词命中覆盖，其余默认作者声明 |
| 语言 | 简体中文/繁体中文/日文/韩文 | 简体中文 | tc/繁体=繁体；jp/japanese/mincho=日文；kr/korean/韩=韩文 |

**已知局限**（启发式尽力而为，用户可在资源管理页手动修正并持久化）：
- 风格/授权为强主观维度，多数字体归「其它/作者声明」。
- 「多字重」因系统扫描按族名去重，仅名称含明确标记时命中。
- 纯拉丁字体无语言标记，默认归「简体中文」。

## 6. 工具契约

### `font_list`（查询可用字体，只读）

| 项 | 值 |
|---|---|
| 参数 | `query?`（字体名子串过滤）、`source?`（system/library）、`type?/style?/weight?/license?/language?`（五维分类过滤，缺省=全部）、`limit?`（默认 100，max 500）、`offset?`（分页） |
| 返回 | `{ total, returned, offset, fonts: [{ name, path, source, meta }], note? }` |
| 风险 | safe，注册自动放行 |

- 合并系统字体（缓存）+ 资源库（索引），**资源库同名覆盖系统**，按 `localeCompare(name, 'zh')` 排序。
- 先按五维过滤（`filterFontsByMeta`，缺省/「全部」= 不限），再走 query/source 过滤与 limit/offset 分页。
- 默认裁剪 + 支持过滤，避免超 `MAX_TOOL_RESULT_BYTES(32KB)`。

### 字体入库 / 元数据修改（不对 AI 暴露）

- 刻意**不提供 `font_register` 工具**：字体入库 / 元数据编辑由用户在「资源管理」页完成
  （`window.preload.font.addFont(path, meta?)` / `updateFontMeta(name, meta?)`），AI 只读 `font_list`。
  原因：注册属于用户主观操作，AI 无法判断授权 / 风格等语义，也不应自行往磁盘写文件。
- `updateFontMeta(name, meta)`：资源库字体写 `index.json`，系统字体写 `font-cache.json`；
  `meta` 传 `undefined` / 空即清除持久化值，渲染层回退启发式。

### `font_pick`（让用户选择字体，交互式）

| 项 | 值 |
|---|---|
| 参数 | `purpose?`（选字用途，展示给用户）、`recommends?`（推荐字体 name 数组 2-5 个，须本机已安装） |
| 返回 | 用户选中字体的 name（string）；取消返回「用户未选择」提示 |
| 风险 | safe；交互决策经 `InteractiveBridge` 排队等待用户作答 |

- **交互链路**：模型调用 `font_pick` → `agentTools.runSingleTool` 拦截（`markToolInteractive` 标
  `font_pick`）→ `interactive.awaitDecision('font_pick')` 挂起 → `FontPickChatTool.vue` 渲染选字面板 →
  用户挑选确认后 `bridge.resolve(toolCallId, name)` → 结果经 `formatFontPickResult` 返回模型。
- **面板 UI**：顶部展示 `purpose` 与推荐字体（带真实预览，未安装的推荐标记「未安装」）；「选择更多」
  展开全部字体（系统 + 资源库，均带预览，可按名称搜索）。选中字体默认取第一个已安装推荐。
- 预览复用 `src/utils/fontPreview.ts`（system 走 CSS；library 用 FontFace URL 源 + `pathToHref` 异步加载，不占渲染进程堆）。
- 调用前应先 `font_list` 核实候选字体存在。

## 7. 渲染层注册（fontRegistry.ts）

- `collectFontFamilies(doc)`：递归收集画布全部 text 节点的 `fontFamily`（去重）。
- `ensureFontsForDoc(doc)`：`font.listFonts()` 建立 name → {source, path} 映射 → 对非 system 来源
  经共享注册器 `createFontFaceRegistry`（`src/utils/fontFaceRegistry.ts`）加载：`new FontFace(name, url("pathToHref(path)"))`
  → `await load()` → `document.fonts.add()`。
- **懒加载**：只加载画布实际用到的字体族（设计一般 2~3 个），已注册集合去重避免重复。
- **内存控制（LRU）**：注册器按上限（画布 50 / 预览 60）LRU 淘汰并 `document.fonts.delete(face)`；
  字体源是 file:// 可随时按需重载，淘汰安全。
- 接入点：`exportCanvasPng` 导出前、`CanvasRenderer.render()` 预览前 `await ensureFontsForDoc(doc)`，
  保证预览 / `ctx.measureText`（canvasLayout.ts）与导出 PNG 用同一已加载字体源。
- `document.fonts` 不可用时静默降级为默认字体，不阻塞渲染导出。

## 8. 资源管理页（/setting/assets）

- `page-layout` + `t-tabs`：「字体」tab 用 `t-table` 展示全部字体（name / 预览 / 来源 tag / 类型 / 字重 / 语言 /
  操作），支持添加、编辑、删除、打开目录、刷新。
- **预览列**：`FontPreviewText.vue` + `fontPreview.ts` 懒加载——system 字体走 CSS `font-family` 原生渲染；
  library 字体经共享注册器（FontFace **URL 源** + `pathToHref`，浏览器按 file:// 异步加载并 `document.fonts.add`；
  按 source+name 内存缓存去重、上限 60 超限 LRU 淘汰，不经 IPC 读整包字节）；加载前半透明占位；
  `reload` 时清缓存保证重新入库后刷新。
- **五维筛选**：表格上方 5 个 `t-select`（类型/风格/字重/授权/语言），选项复用 `fontMeta.ts` 常量，
  数据经 `filterFontsByMeta` 派生，显示「命中 / 总数」。
- **添加字体**：`inject.dialog.open` 多选文件 → `openFontMetaDialog({ files })` 命令式弹窗
  （`FontMetaDialog.tsx` 外壳 + `FontMetaContent.vue` 内容，逐文件一行 + 5 个下拉，启发式按文件名预填）→
  逐文件 `addFont(path, meta)` 入库。
- **编辑**：每行「编辑」按钮（资源库与系统字体均支持）→ 复用元数据弹窗 → `updateFontMeta` 持久化，
  保存值对 `font_list` / 画布渲染立即生效。
- 「插图素材」tab 为占位（预留）。
- 侧边栏入口：`AppSide.vue` `settingOptions` 新增「资源管理」（`FolderFilledIcon`）。
- 路由：`src/plugin/router.ts` `/setting/assets`；枚举：`LocalNameEnum.SETTING_ASSETS`。

## 9. 注意事项

- 画布文件只存 `fontFamily` 字符串。系统字体重启后仍可用（Chromium 原生）；**资源库字体重启后需重新注册**
  （FontFace 是内存态）——需要时在「资源管理」页重新入库，文档已说明。
- **字体常驻内存与 LRU 淘汰**：`document.fonts.add` 注册的 FontFace 不会随画布销毁自动释放（直到页面刷新 /
  应用关闭）。渲染层（上限 50）与预览层（上限 60）共用 `createFontFaceRegistry(maxFaces)` 工厂
  （`src/utils/fontFaceRegistry.ts`），各自独立实例 + 独立上限，按最近使用 **LRU 淘汰**超限字体
  （`document.fonts.delete(face)`），把长会话内存钉在上限内；均用 FontFace URL 源 + `pathToHref`，字节由浏览器
  字体缓存管理、不经 IPC 读整包，被淘汰的字体可随时按需重载，不会丢功能。
  `readFont`（读 ArrayBuffer）preload API 保留，供有需要的场景使用。
- `ttc` 仅系统字体走原生；资源库 FontFace 加载 ttc 可能失败，建议入库 ttf/otf/woff/woff2。
- name 表解析对损坏文件返回 null，绝不抛出中断扫描。
- `font.js` 为 preload Node 环境（CommonJS），不套用前端 TS 行数红线，但保持清晰结构。
- `fontMeta.ts` 为启发式推断，规则改动只需更新关键词表，不涉及数据结构变更。
- 新增字体源只需扩展 `source` 枚举 + 在 `listFonts` 合并逻辑追加，`online` 已预留。
