# AI 设置 —— 模型配置文件（~/.mistrelle/model.json）

## 功能概述

「AI 设置」页维护的模型提供方（`AiProvide`）列表已从 IndexedDB（`/setting/ai`，经 `DbStorageUtil` 读写）
迁移到根数据目录下的单一 JSON 文件 **`~/.mistrelle/model.json`**，供后续 AI 参考。

> 不迁移旧 IndexedDB 数据：`model.json` 不存在时按空列表初始化，旧 db 数据被忽略。

## 文件结构

| 文件                                                          | 角色                                            |
|---------------------------------------------------------------|-------------------------------------------------|
| `src/modules/setting/service/ModelService.ts`                 | 读写 `model.json` 的 Service（唯一 IO 入口）    |
| `src/store/setting/SettingAiStore.ts`                         | 设置 Store：内存态 + 计算属性 + 增删改 / 拖拽排序（调用 Service） |
| `src/pages/setting/ai/components/SettingAiSidebar.vue`        | 提供方侧边栏：启用开关 + sortablejs 拖拽排序 |
| `src/global/Constant.ts`（`getModelPath`）                    | 文件路径工厂                                    |
| `src/entity/setting/SettingAi.ts`（`AiProvide`）              | 数据结构契约                                    |

## 文件路径

```ts
// src/global/Constant.ts
export const getModelPath = () => window.preload.path.join(dataFolder, 'model.json')
```

`dataFolder` 即 `~/.mistrelle`（`Constant.ts` 中由 `os.getPath('home') + '.mistrelle'` 拼接）。

## 数据结构

`model.json` 存 **`Array<AiProvide>`**（直接 JSON 数组，无 rev / 无包裹对象）：

```json
[
  {
    "id": "xxx",
    "createdAt": 1720000000000,
    "updatedAt": 1720000000000,
    "name": "DeepSeek",
    "baseUrl": "https://api.deepseek.com/v1",
    "key": "sk-...",
    "enable": true,
    "models": [
      {
        "identifier": "deepseek-chat",
        "model": "deepseek-chat",
        "enable": true,
        "type": "chat",
        "context": 64000,
        "output": 8192
      }
    ]
  }
]
```

字段契约见 `src/entity/setting/SettingAi.ts`：`AiProvide extends BaseEntity, AiProvideCore`。
`AiProvide.enable` / `AiModel.enable` 均为可选旧字段，初始化时归一化为 `enable ?? true`。
提供方关闭后：`options` / `vectorOptions` / `imageOptions` 与 `optionMap` 均不包含其模型。

## Service API

`src/modules/setting/service/ModelService.ts`

| 函数            | 签名                                            | 说明                                                        |
|-----------------|-------------------------------------------------|-------------------------------------------------------------|
| `modelList`     | `() => Promise<Array<AiProvide>>`               | 读取全部提供方；文件不存在返回 `[]`（不预写空文件）         |
| `modelSave`     | `(list: Array<AiProvide>) => Promise<void>`     | 全量覆写 `JSON.stringify(list)`；无冲突控制（单进程唯一写者）|

读写基于 `window.preload.fs`（`existsSync` / `readTextFile` / `writeTextFile`），与
`ChatService` / `ProjectService` 的文件 JSON 模式一致。

## Store 契约

`SettingAiStore`（`useSettingAiStore`）对外暴露，以下调用方不受影响：

- `items`：全部提供方（响应式）
- `options` / `vectorOptions` / `imageOptions`：仅含 **已启用提供方** 下 **已启用且类型匹配** 的模型分组
- `optionMap`：同上过滤后的 `${provideId}:${identifier}` → `AiProvideOption`
- `ready` / `initPromise`：初始化完成状态
- `put(form: AiProvideForm)` / `remove(id: string)` / `reorder(from, to)`：新增 / 更新 / 删除 / 拖拽排序，操作后全量 `modelSave`
- 提供方顺序即 `model.json` 数组顺序；侧边栏拖拽后 `options` 分组顺序同步变化

移除项：`rev` 冲突控制、`DbStorageUtil` / `LocalNameEnum.SETTING_AI` 依赖。

## 注意事项

- 文件读写是全量覆写（无差分合并），单实例运行下安全。
- 若未来引入多进程写同一文件，需自行加互斥或原子写。
- 删除 `LocalNameEnum.SETTING_AI` 后，`/setting/ai` 的 IndexedDB 残留数据不再被读取（不清理）。
