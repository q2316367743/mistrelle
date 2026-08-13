# AI 设置 —— 模型拉取抽屉

## 功能概述

「AI 设置」页的「从接口获取模型」打开模型导入抽屉，用户可从接口返回的模型列表中勾选要启用的模型。本文档记录该抽屉（
`FetchModelsDrawer`）的实现细节，供后续 AI 参考。

## 文件结构

| 文件                                                 | 角色                                         |
|------------------------------------------------------|----------------------------------------------|
| `src/pages/setting/ai/modals/FetchModelsDrawer.tsx`  | 抽屉外壳（命令式 `DrawerPlugin`）            |
| `src/pages/setting/ai/modals/FetchModelsContent.vue` | 内容组件（搜索 / 分组 / 标签 / 选择 / 提交） |
| `src/utils/aiModel.ts`                               | 类型猜测与标签映射的共享工具                 |
| `../../src/global/aiModelPresets.ts`                        | 内置常见模型上下文表（`guessModelParams` 数据源，按厂商分组） |

## 外壳说明

- 使用 `DrawerPlugin` 命令式 API：`footer: false`、`destroyOnClose: true`
- 内容组件经 `body: () => h(FetchModelsContent, { fetchedModels, existingModels, onClose, onSuccess })` 渲染
- 操作按钮由内容组件内部提供；提交后经 `onSuccess` 通知外壳：`await onConfirm(ids)` 成功后 `dp?.destroy()`
- 若 `onConfirm` 抛错（如保存失败），抽屉保持打开，便于用户重试

## 内容组件 Props / Emits

- **Props**
  - `fetchedModels: Array<{ id: string; name: string }>` 接口返回的模型列表
  - `existingModels: AiModel[]` 当前已保存的模型，用于初始化已选中项（取 `enable === true` 的 `identifier`）
- **Emits**
  - `close`：关闭抽屉
  - `success(ids: string[])`：确认导入，携带选中的模型 ID 列表

## 模型类型猜测（`guessModelType`）

共享工具 `src/utils/aiModel.ts` 导出 `guessModelType`、`MODEL_TYPE_LABEL`、`MODEL_TYPE_THEME`，抽屉与页面共同复用。

根据模型 ID 的小写形式做正则匹配，返回 `AiModelType`：

| 关键词（正则）                                                                | 类型     |
|-------------------------------------------------------------------------------|----------|
| `tts / speech / voice / audio`                                                | `voice`  |
| `image / img / dall-?e / dalle / flux / sdxl / stable-diffusion / midjourney` | `image`  |
| `video / veo / sora / kling / gen-[234] / runway / pika`                      | `video`  |
| `embedding / embed / vector / rerank / bge`                                   | `vector` |
| 其余                                                                          | `chat`   |

> 匹配顺序：voice → image → video → vector → chat，匹配到即返回。
> 增加新类型规则时直接扩充 `TYPE_RULES` 即可。

## 模型上下文猜测（`guessModelParams`）

仿照 `guessModelType`，内置常见模型上下文大小表，根据模型 ID 自动猜测
`AiModel.context`（总上下文）与 `AiModel.output`（最大输出 token），未知模型返回空对象。

数据源独立放在 `../../src/global/aiModelPresets.ts`（新增模型规则优先改该文件），
内部按厂商分组（`AI_MODEL_PROVIDER_PRESETS`），每个厂商组包含：

- `models`：**精确表**，裸 ID（小写）→ `{ context, output }`
- `rules`：**家族正则兜底表** `[RegExp, params]`，按优先级从上到下匹配，处理带日期 /
  版本 / `instruct` 等后缀的变体 ID；组内越具体的规则放越前面（如 `qwen3-coder` 在 `qwen3` 之前）

对外导出 `MODEL_PARAMS_TABLE` / `FAMILY_PARAMS_RULES` 由分组**聚合**生成（`Object.assign` + `flatMap`），
组间模型前缀互不冲突，聚合不改变匹配语义。

匹配顺序：精确表 → 家族正则 → 空。示例：

| 模型 ID                      | 猜测结果                          |
|------------------------------|-----------------------------------|
| `gpt-4o`                     | `context: 128000, output: 16384` |
| `claude-3-7-sonnet-20250219` | `context: 200000, output: 64000`（家族正则） |
| `claude-sonnet-4-5`          | `context: 1000000, output: 64000` |
| `deepseek-v4-flash`          | `context: 1000000, output: 384000` |
| `custom-model`               | `{}`                              |

`formatContextWindow(n)` 将 token 数格式化为 `128K` / `1M` 供列表展示；无值返回空串。

### 数据来源与核对

`aiModelPresets.ts` 的数值以 **@earendil-works/pi-ai**（pi.dev 同源权威数据包，其
`dist/providers/data/*.json` 为各厂商官方模型目录）为基准，每个厂商分组标注 `source`（包名 + 数据文件）
与 `checkedAt`（核对日期）。核对口径：

- 优先取**官方厂商条目**（如 `deepseek.json` 的 `deepseek-v4-flash` = 1M/384K），
  聚合商（amazon-bedrock / groq 等）数值仅作参考
- pi-ai 仅收录支持 tool calling 的模型：embedding 类、已下线模型（`gpt-3.5-turbo`、`llama-2-*` 等）
  不在其目录中，保留原值
- 重新同步：临时 `npm i -D @earendil-works/pi-ai`，按「官方厂商 JSON → 提取 contextWindow / maxTokens →
  回填分组表」流程核对后卸载（数据固化在静态表，运行时不依赖该包）
- 无官方条目的旧模型按官方文档公开数值保留；核对不到的**不臆造数值**

### 维护时机（context / output 落盘入口）

- **接口导入**（`SettingAi.vue` `handleFetchModels`）：push 时展开 `...guessModelParams(m.id)`
- **手动添加 / 编辑**（`OpenModelDialog.tsx`）：新增「上下文窗口」「最大输出」两个 `<InputNumber>`
  （`suffix="token"`），编辑时回填已有值；非编辑态在模型标识 `onBlur` 时自动填充猜测值
  （仅当两项均未手动设置时才覆盖）；`AddModelResult` 扩展 `context` / `output` 回传
- 消费方：`useChatSession.ts` 的 token 占用展示取 `optionMap.get(modelKey)?.context`，缺省兜底
  `DEFAULT_CONTEXT_WINDOW`（见 `src/global/Constant.ts`）

## 类型标签渲染

仅对非 `chat` 类型在模型名 **之前**渲染 `<t-tag size="small" variant="light">`，文案复用 `AiModelTypeOptions` 的
label，主题映射：

| 类型   | 标签主题  |
|--------|-----------|
| image  | `warning` |
| video  | `danger`  |
| voice  | `success` |
| vector | `primary` |

标签在以下两处一致展示：

- **导入抽屉**：基于 `guessModelType(m.id)` 临时猜测
- **页面模型列表**（`SettingAi.vue`）：基于已保存的 `model.type`；从接口导入时 `type` 直接写入 `guessModelType(m.id)`
  的结果（不再固定为 `chat`）

## 搜索过滤

- 顶部搜索框为 **粘性布局**（`position: sticky; top: 0; z-index: 1`），滚动时固定不消失
- 按 `keyword` 同时匹配模型 `id` 与 `name`（不区分大小写），过滤后重新分组
- 「全选」与「组全选」均基于 **过滤后的可见列表**计算：
  - 勾选：追加可见列表中未选中的项
  - 取消：仅从可见列表中移除，不影响已被过滤隐藏的选择
- 过滤后无匹配时展示 `t-empty`「未找到匹配的模型」

### 页面模型列表搜索（`SettingAi.vue`）

- 模型列表头部同样提供搜索框，`modelKeyword` 同时匹配 `identifier` 与 `model`（不区分大小写）
- 过滤后再分组（复用 `getModelFamily`），无匹配时展示「未找到匹配的模型」

## 注意事项

- 颜色类使用 tdesign CSS Token（`--td-bg-color-container` 等），禁止裸色值
- 分组逻辑（`getModelFamily` / `groupModels`）与页面 `SettingAi.vue` 内的分组实现保持一致：按 ID 中首个非数字/连字符片段归族
- `guessModelType`（类型）与 `guessModelParams`（上下文）同属 `@/utils/aiModel` 共享工具，新增规则时分别维护
  `TYPE_RULES`（aiModel.ts）与 `AI_MODEL_PROVIDER_PRESETS` 对应厂商分组（aiModelPresets.ts 的 `models` / `rules`）
