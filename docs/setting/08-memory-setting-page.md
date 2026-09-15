# 08 · 记忆设置页（Fluent 布局）

## 功能概述

「记忆设置」页（`/setting/soul`，侧栏「记忆」）按 Windows 设置页的结构重组：顶部告警（未配置模型时）+ 状态主视觉 + 分组卡。原先「默认总结模型」配置项已从「智能体设置」页迁到本页，改名为「**记忆模型**」。

记忆模型是记忆系统的**唯一**前置依赖：未配置时提取与整理都不执行，页面顶部有告警、动作按钮置灰。

配色与卡面全部沿用 `docs/setting/06-account-page.md` 的 Fluent 约定，不新增 `--fluent-*` 变量、不写裸色值。

## 页面结构

```text
记忆
⚠ [t-alert warning] 记忆系统已启用，但还没有选择记忆模型   ← 仅「已启用且未配置」时
让伙伴记住你们的过去：对话中自动提取短期记忆…

┌ 概览 MemoryOverviewCard ────────────────────┐
│ [渐变图标] 记忆系统   [已启用/已停用] [Switch]│
│            对话空闲后自动提取短期记忆…         │
├────────────┬────────────┬──────────────────┤
│ 长期记忆    │ 短期记忆    │ 上次整理          │
│ 1,240/4000  │ 6 天        │ 2026-09-14       │
└────────────┴────────────┴──────────────────┘

记忆设置 MemorySettingCard（自持 flex 行，图标与文字垂直居中）
  🧠 记忆模型                        [t-select 360px]
  📥 立即提取短期记忆                     [立即提取]
  🗂 立即整理                              [立即整理]

长期记忆 LongTermMemoryCard
  MEMORY.md · 上限 4000 字（分节明细）  1,240/4000
  [textarea 编辑区]                      [保存]

每日短期记忆 DayMemoryCard
  [日期选择 200px] [删除当日]
  [readonly textarea]
```

## 记忆模型（原「默认总结模型」）

| 项 | 结论 |
|----|------|
| 存储字段 | `SettingDefault.defaultSummaryModel`（**字段名不变**，零数据迁移） |
| 页面读写 | `pages/setting/soul/SoulSettingPage.vue` 的 `modelKey` computed → `SettingDefaultStore.state`（deep watch 自动落盘） |
| 消费方 | `modules/memory/MemoryService.ts` 的 `memoryChatCompletion()` |
| 兜底链 | **无**——只认记忆模型（2026-09-15 去掉 `\|\| defaultQuickModel`） |
| 选项来源 | `useSettingAiStore().options`（chat 类型全量，与「智能体设置」页同源） |

**为什么去掉快速模型兜底**：兜底会让用户没预期参与记忆的「默认快速模型」被静默调用，也会让设置页无法如实判断「是否已配置」。去掉后「配了才生效」是字面为真的。

**为什么改名**：`defaultSummaryModel` 全库唯一消费方就是记忆系统；`docs/subscribe/01` 描述的「订阅总结」在 `src/` 下没有任何代码，该文档是历史规划稿。原注释「订阅内容总结等任务使用的模型」与实际不符。

**为什么保留字段名**：改字段名需要迁移存量 `setting/default.json`，收益不足以抵成本，故在 `entity/setting/SettingDefault.ts` 注释里说明「字段名为历史命名，实际语义已收敛为记忆系统专用」。

## 未配置模型的告警与门控

`modelReady = Boolean(defaultSummaryModel)`，与 `memoryChatCompletion` 的判定完全同源（两边都不做兜底）。

- **顶部 `t-alert`**（`theme="warning"`，不可关闭）：条件为 `enabled && !modelReady`——已启用但没选模型时才出现，此时记忆系统不会有任何产出。
- **真实门控**：`立即提取` / `立即整理` 两个按钮的 `disabled` 追加 `!modelReady`。这不是纯文案提示，未配置时点不动。
- 模型选择器在 `enabled` 为 false 时禁用。

`t-select` 清空后回调值可能不是字符串（`SelectValue` 联合类型），`modelKey` 的 setter 与 `MemorySettingCard.onModelChange` 都做了 `typeof value === 'string'` 归一，避免 `undefined` 落盘破坏契约。

## 关键文件

| 文件 | 角色 |
|------|------|
| `pages/setting/soul/SoulSettingPage.vue` | 页壳编排：持有全部状态与动作（刷新 / 开关 / 提取 / 整理 / 保存 / 删当日），组装 4 张卡 |
| `pages/setting/soul/components/MemoryOverviewCard.vue` | 状态主视觉：渐变图标 + 状态 Tag + 开关 + 三栏统计（长期字数 / 短期天数 / 上次整理） |
| `pages/setting/soul/components/MemorySettingCard.vue` | 记忆模型选择 + 立即提取 + 立即整理 |
| `pages/setting/soul/components/LongTermMemoryCard.vue` | 长期记忆编辑（草稿 + 字数 + 保存，`dirty` 由页面传入） |
| `pages/setting/soul/components/DayMemoryCard.vue` | 每日短期记忆（日期选择 + 删除当日 + 只读查看） |

组件契约：全部单向传值 + `emit`，**不传响应式对象**；草稿 / 选中日期 / 模型值用 `v-model:*` 显式命名（`draft` / `date` / 默认 `modelValue`）。

## 设计约定

- 卡面：`--fluent-card-bg` + `--fluent-card-border` + `--fluent-radius-card` + `--fluent-elevation-1`，**不用带标题的 `t-card`**
- 概览统计三栏：`grid-template-columns: repeat(3, 1fr)` + `border-top` / `border-left` 分隔，640px 断点转单列（同账号页）
- 主视觉图标：`--fluent-gradient-primary` 圆角块（48px）+ `t-icon name="bookmark"`
- 分组标题：`font: var(--td-font-title-small)` + `color: var(--td-text-color-secondary)`
- 行结构自持 `flex`（`align-items: center`），图标 / 文字 / 操作三段布局，**不用 `t-list` + `#image` 插槽**——该插槽的图标容器不易与左侧文字垂直居中
- 圆角用 `--fluent-radius-smooth` / `--td-radius-round`，**不用 `--fluent-radius-round`**（该变量并未在 `theme.less` 定义）

## 注意事项

- 概览卡的开关走 `@update:enabled` → `onToggle`（落盘 + 提示统一收在页面），不用 `v-model`，避免双向绑定绕过 `setMemoryEnabled`
- 长期记忆的保存按钮可用性由页面传入的 `dirty`（`longTermDraft !== longTerm`）决定，组件不自持基线
- 记忆状态不在 pinia，而在 `MemoryService` 的进程内 `stateCache`（`~/.mistrelle/soul/state.json`），页面通过 `readSoulState()` 读取
- `MemorySettingCard` 的 `modelReady` 与按钮门控为纯展示契约，真正的失败兜底仍在 `memoryChatCompletion` 的 throw
- **兜底链已移除**：`memoryChatCompletion` 与页面 `modelReady` 都只认 `defaultSummaryModel`。仅配过「默认快速模型」的用户需在记忆页补选记忆模型，否则提取/整理会报「未配置记忆模型」
