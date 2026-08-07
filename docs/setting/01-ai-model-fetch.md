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
