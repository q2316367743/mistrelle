# 07 · AI 设置页（Fluent 布局 + 单向数据流）

## 功能概述

「AI 设置」页（`/setting/ai`）按 Windows 设置页结构重组：左侧 NavigationView 选供应商，右侧编辑连接与模型。自定义供应商的表单草稿在 `ProviderEditor` 内部维护，父页只做编排与落盘，符合 Vue 单向数据流。

不改 store / relay 契约：内置中转、登录守卫、`thirdPartyRelay` 门控仍见 [05-ai-provider-builtin-relay.md](./05-ai-provider-builtin-relay.md)。

## 页面结构

```text
AI 设置
┌ 侧栏 SettingAiSidebar ─────────┬ 主区 ────────────────────────────┐
│ 内置                           │ 空态 / BuiltinProviderPanel /     │
│   [Accent] 内置供应商          │ ProviderEditor                    │
│ 自定义（付费档）               │   页头 Title + Caption            │
│   可拖拽项 + 启用 + 删除       │   连接表面（名称/URL/Key/格式）   │
│ [添加供应商]                   │   命令栏（保存 / 拉取模型）       │
│                                │   模型表面 ProviderModelList      │
└────────────────────────────────┴───────────────────────────────────┘
```

## 数据流（单向）

```text
SettingAiStore.items
        │ 只读快照 editingSource
        ▼
SettingAi.vue ── :source + :key + :persist ──► ProviderEditor（内部 draft）
        ▲                                              │
        └──────── await persist(payload) ◄─────────────┘
                  store.put
```

- 父组件只持有 `selectedId` / `isCreating` / `saving`，**不再持有可写 form**。
- `editingSource`：新建为 `null`；编辑为 store 项浅拷贝（`models` 逐项拷贝）。
- `:key="selectedId || 'new'"`：切换提供方时重建草稿，避免 watch 双向同步。
- 名称命中预设时只改 `draft.baseUrl`，不 mutate props。
- 落盘通过 prop `persist(payload) => Promise`（可 await），不用 `@save` emit，保证模型增删改等操作真正等 store 写完再提示。
- `useProviderModels` 入参为 `Ref` / `WritableComputedRef<AiModel[]>`，始终改**当前**草稿数组（修复此前 `form` 整表替换后模型操作打到孤儿数组、表现为「加不进模型」的问题）。

## 关键文件

| 文件 | 角色 |
|------|------|
| `pages/setting/ai/SettingAi.vue` | 编排：登录守卫、选中/新增/删除/启用、内置刷新、`persist` 落盘 |
| `pages/setting/ai/components/SettingAiSidebar.vue` | NavigationView：分组 + Accent 选中条 + 拖拽排序 |
| `pages/setting/ai/components/ProviderEditor.vue` | 自定义供应商：本地 draft + 连接表面 + 命令栏 |
| `pages/setting/ai/components/ProviderModelList.vue` | 模型搜索/分组列表；`readonly` 供内置面板复用 |
| `pages/setting/ai/components/BuiltinProviderPanel.vue` | 内置只读面板 + 刷新 |
| `pages/setting/ai/useProviderModels.ts` | 模型增删改 / 拉取导入，操作后 `onSaved` 落盘 |
| `pages/setting/ai/providerPresets.ts` | 名称预设（含 Kimi → moonshot API） |

## 设计约定

- 表面用 Fluent token：`--fluent-card-bg` / `--fluent-card-border` / `--fluent-radius-card` / `--fluent-elevation-1`，不用带标题的 `t-card`
- 侧栏选中：左侧 3px `--fluent-item-selected-border` + `--fluent-item-selected` 底；hover `--fluent-item-hover`；`focus-visible` 用 `--fluent-focus-ring`
- 布局铺满 `page-container`（`height: 100%`），不用 `calc(100vh - Npx)`
- 颜色只用 tdesign / fluent CSS Token；输入框用 `clearable`
- 点击已选中的自定义项**不再**进入新建；新建只走「添加供应商」

## 注意事项

- 模型操作（添加 / 编辑 / 删除 / 开关 / 接口导入）会立即 `await persist` 落盘，与原先「改完即存」一致
- 免费档侧栏只显示内置；父页 `relayEnabled` watch 强制回选内置
- 内置模型开关恒开（`ProviderModelList` `readonly`），不可增删改
