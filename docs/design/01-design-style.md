# 设计风格模块

## 功能概述

「设计风格」模块（侧边栏 → 设计风格）管理统一的视觉语言定义：用户可新建 / 编辑 / 删除设计风格（配色、字体、提示词、布局约束），内置 6 个系统预设（Apple / xAI / Notion / Meta / Material Design / Fluent Design，只读不可删）。风格数据保存在本地文件，供后续 AI 生图 / 设计生成消费。

## 文件结构

| 文件                                                               | 角色                                                          |
|--------------------------------------------------------------------|---------------------------------------------------------------|
| `src/entity/ai/AiDesignStyle.ts`                                   | 实体类型 + 分类选项 + 表单工厂（`buildAiDesignStyleForm` / `toAiDesignStyleForm`） |
| `src/global/DesignStylePresets.ts`                                 | 内置预设常量 `DESIGN_STYLE_PRESETS`（isSystem 只读，不落盘）   |
| `src/modules/design/service/DesignStyleService.ts`                 | 文件持久化：`~/.mistrelle/design/` 下 index.json + 单条文件    |
| `src/modules/design/service/DesignStylePrompt.ts`                  | 风格 → 提示词段落 `buildDesignStylePrompt`（design 聊天注入，见 `02-design-style-chat.md`） |
| `src/store/design/DesignStyleStore.ts`                             | Pinia store：合并预设与用户数据、CRUD（列表缓存、详情不缓存）  |
| `src/pages/design/list/index.vue`                                  | 列表页（hero + 搜索 + 分类筛选 + 卡片网格）                     |
| `src/pages/design/list/components/DesignStyleCard.vue`             | 列表卡片（色板圆点 / 内置徽标 / 更多菜单）                      |
| `src/pages/design/list/modals/DesignStylePutDialog.tsx`            | 新建 / 编辑抽屉外壳（命令式 `DrawerPlugin`）                    |
| `src/pages/design/list/modals/DesignStylePutContent.vue`           | 抽屉内容（5 个 Tab 表单 + 保存按钮，`emit('close'/'success')`） |
| `src/pages/design/list/modals/ColorPaletteFields.vue`              | 配色方案表单区段（6 个 `t-color-picker`）                       |
| `src/pages/design/list/modals/TypographyFields.vue`                | 字体规范表单区段（3 级 × 字体/字重/字号/行高）                  |
| `src/pages/design/detail/index.vue`                                | 明细页（基础信息 / 配色 / 字体 / 视觉提示 / 布局规则分块展示）   |
| `src/pages/design/detail/components/StylePaletteBlock.vue`         | 明细页配色区块（色带 + 色块网格）                                |
| `src/pages/design/detail/components/StyleTypographyBlock.vue`      | 明细页字体区块（层级表格）                                       |

## 数据结构与持久化契约

实体结构见 `src/entity/ai/AiDesignStyle.ts`：

- `AiDesignStyleCore`：name / description / category（`'poster' | '移动端' | '网页端'`）/ tags
- `AiDesignStyleItem`：Core + `colorPalette`（**索引项含配色**，供卡片直接预览色板）
- `AiDesignStyleForm`：Core + visualPrompt / negativePrompt / colorPalette（6 色）/ typography（heading/body/caption × font/weight/size/lineHeight）/ layoutRules
- `AiDesignStyle`：Form + `isSystem: boolean`（true 则不可编辑 / 删除）

落盘位置 `~/.mistrelle/design/`（`getAppData2Design()`）：

```text
~/.mistrelle/design/
|- index.json              # AiDesignStyleItem[]（轻量列表索引）
|- design-{id}.json        # 单条完整 AiDesignStyle（id 为雪花 ID 或预设固定 ID）
```

- **系统预设不落盘**：`DESIGN_STYLE_PRESETS` 为代码常量（`isSystem: true`、固定 id 如 `preset-apple`），store 的 `all` computed 合并为 `[...预设, ...用户项]` 供列表 / 详情统一消费
- **写入双写**：`put` 同时写 index.json（索引项）与 `design-{id}.json`（完整内容），`Promise.all` 并行
- **删除双删**：`remove` 更新 index.json 并 `rm` 单条文件
- 目录 / index.json 不存在时服务层懒初始化（mkdir + 写 `[]`）

## Store 契约（`useDesignStyleStore`）

| 成员        | 说明                                                                 |
|-------------|----------------------------------------------------------------------|
| `all`       | `computed<Array<AiDesignStyleItem \| AiDesignStyle>>` 预设 + 用户项    |
| `getById`   | 同步取列表项（含预设），列表页 / 聊天室风格 tag 使用                   |
| `getDetail` | 异步取完整内容：预设直接返回常量；用户项每次读单条文件（**列表缓存、详情不缓存**） |
| `put`       | `(form, id?)`；预设 id 直接拒绝（isSystem 只读）；新建用 `useSnowflake().nextId()` |
| `remove`    | 预设 id 直接拒绝                                                     |

## 页面说明

- **列表页**：搜索匹配 name / description / tags，分类筛选（海报 / 移动端 / 网页端）；内置项卡片带「内置」徽标，更多菜单仅显示「查看」；新建 / 编辑均走 `openDesignStylePut`（编辑时先 `getDetail` 读取完整内容再开抽屉）
- **抽屉表单**：按 AGENTS.md 弹窗规范拆分 —— `.tsx` 外壳（`DrawerPlugin` + `footer: false` + `destroyOnClose: true`）+ `.vue` 内容组件（表单与保存按钮，`body: () => h(XxxContent, ...)`）；内容组件对传入 form 做 `structuredClone` 深拷贝后编辑，保存调 `store.put` 成功后 `emit('success')` 让外壳销毁
- **明细页**：`store.getDetail(id)` 加载；编辑保存后重新 `load()`（store 缓存已更新）；不存在时 t-empty + 返回列表

## 注意事项

- 路由 `/design/list`、`/design/detail/:id` 已注册于 `src/plugin/router.ts`，侧边栏入口在 `src/pages/app/AppSide.vue`
- 分类键 `poster` 为英文（展示为「海报」），选项映射统一走 `DESIGN_STYLE_CATEGORY_OPTIONS`
- 列表卡片预览色板依赖索引项 `colorPalette` 字段 —— 新增展示字段时需同步保证 `put` 双写两处一致
- 编辑系统预设的 UI 入口已隐藏，store 层也有 isSystem 拒绝兜底，改保护逻辑时两层需同步
- 目录结构与 `src/entity/index.ts` 头部注释保持一致；`LocalNameEnum` 无设计风格键（本模块走 fs 文件模式，非 DB 文档模式）
