# 设计风格创建助手（内置 Agent + 专属工具）

## 功能概述

内置 Agent「设计风格创建助手」（`builtin:design-style`）允许用户通过对话创建 / 修改设计风格：澄清需求 →
产出配色、字体、提示词、布局约束等配置草案 → 使用者确认后直接落库。与「专家创建助手」（`builtin:agent-create`）同一模式：agent
声明专属工具名，运行时经 `toolMap` 解析注入。

## 文件结构

| 文件                                                     | 角色                                                           |
|----------------------------------------------------------|----------------------------------------------------------------|
| `src/modules/tool/components/design/designStyleTools.ts` | 4 个 internal 工具定义（list / get / create / update）         |
| `src/modules/tool/components/design/index.ts`            | design 工具目录出口（追加导出 `designStyleTools`）             |
| `src/modules/tool/index.ts`                              | 注册：`toolMap` 展开 + `toolGroups` 声明「设计风格」分组       |
| `src/global/BuiltInAgent.ts`                             | 内置 agent 定义（`builtin:design-style`）                      |
| `src/store/design/DesignStyleStore.ts`                   | `put` 返回类型升级为 `Promise<string \| undefined>`（返回 id） |

## 工具契约

4 个工具全部 `internal: true`：仅在 `toolMap` 注册、供声明它的 agent 调用；被 `toolGroups` 过滤，不对外展示、不可分配给其他
agent（与「专家管理」工具集一致）。

| 工具名                | 功能                                                                                            | 必填参数 | risk      |
|-----------------------|-------------------------------------------------------------------------------------------------|----------|-----------|
| `list_design_styles`  | 全部风格概要（含系统预设）：id / name / description / category / tags / isSystem / colorPalette | 无       | safe      |
| `get_design_style`    | 按 id 完整信息（含 visualPrompt / negativePrompt / typography / layoutRules）                   | id       | safe      |
| `create_design_style` | 新建风格并落库，返回新 id                                                                       | name     | sensitive |
| `update_design_style` | 按 id 修改，仅覆盖显式传入字段                                                                  | id       | sensitive |

### 入参 Schema（create / update 共用 `FORM_PROPERTIES`）

扁平字段：`name` / `description` / `category`（enum: `poster` / `移动端` / `网页端`）/ `tags` / `visualPrompt` /
`negativePrompt` / `layoutRules`；嵌套对象：`colorPalette`（primary / secondary / background / surface / text_primary /
text_secondary 六个色值）、`typography`（heading / body / caption × font / weight / size / lineHeight）。未传字段由 `create`
侧 `buildAiDesignStyleForm()` 补默认值、`update` 侧保持原值。

### 返回契约

- 查询类：`{ styles: [...] }` / `{ style: {...} }`；找不到返回 `{ error: '未找到 id 为 "..." 的设计风格' }`
- 写入类：成功返回 `{ id, name, message }`；失败返回 `{ error }`（name 为空、category 非法、预设只读、id 不存在）

### 校验与保护

- `create`：name 非空、category 枚举校验（`DESIGN_STYLE_CATEGORY_OPTIONS`）
- `update`：`store.isSystem(id)` 预设只读显式报错（store 层 `put` 对预设静默 return， **工具层必须先行校验**）；先
  `getDetail` 取现状 → `toAiDesignStyleForm` → 仅合并 `undefined` 过滤后的 patch

## Store 契约变更

`DesignStyleStore.put` 返回类型 `Promise<void>` → `Promise<string | undefined>`（仿 `AiAgentStore.put` 返回 id）：

- 新增分支返回雪花 id；更新分支返回 id；预设拒绝 / id 不存在返回 `undefined`
- 现有调用方 `DesignStylePutContent.vue` 忽略返回值，兼容

## 内置 Agent 定义

`BUILTIN_AGENTS` 追加 `builtin:design-style`：
`tools: ['list_design_styles', 'get_design_style', 'create_design_style', 'update_design_style']`；identity 描述字段结构与
4 个工具的工作流（查重 → get 现状 → 确认 → 落库）；`builtin: true`、时间戳 0。`AiAgentStore.all` 自动合并、
`AgentChat.getFunctions` 按 `tools` 名自动解析，无需其他接线。

## 注意事项

- 工具与 agent 的绑定方向是「agent 声明工具名 → `toolMap` 解析」，新增工具必须同步进 `toolMap` 否则 agent 调用会静默缺失
- `getDetail` 是异步的（用户风格读盘、预设返回常量），`update` 前必须 `await` 而不是用同步 `getById`（列表项无提示词等字段）
- 系统预设（isSystem）只读：工具层与 store 层双重保护
- category 枚举含中文字符串，模型侧由 identity 明确说明可选值
