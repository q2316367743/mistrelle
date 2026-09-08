# 18 - Agent 主动读图（image_read 工具）

> 2026-09-08 落地。agent loop 中模型主动"看"图的能力：新增 `image_read` 工具，读取成功后图像块在下一轮请求构建时以「紧随 tool 消息的 user 消息」注入模型上下文。是 [13-vision-image-passing](./13-vision-image-passing.md)（用户发图被动传递）的工具侧补充。

## 背景与约束

- 工具结果消息 `role:'tool'` 在三个协议适配器（chat / responses / anthropic）中 content 均为纯字符串；OpenAI chat / responses 协议本身不支持工具消息携带图像，因此**图片无法直接放进工具结果**。
- 图片进模型上下文的既有通道只有 user 消息的图像块（`visionBlocks.ts` 重建）。本方案复用该通道：工具读图后把路径记到工具调用块上，请求构建时重建为图像块、追加为一条 user 消息 —— **适配器层零改动**。

## 数据流

```
模型调用 image_read(path)
  → handler 校验（黑名单 / 扩展名 MIME / 20MiB 上限）+ readBinaryFile + readImageInfo
  → 返回 { content, path, format?, width?, height?, visionImages: [path] }
  → agentTools.extractVisionImagePaths：剥离 visionImages 键，路径经 ext 落
    toolcall 块 content.ext.visionImagePaths（随消息持久化，模型可见文本不含该键）
  → 下一轮 buildRequestMessages：
    agentPrompts（识图模型 support 含 'image'）→ collectToolCallVisionBlocks
    扫描 ext.visionImagePaths 读盘重建 Map<toolCallId, AiImageBlock[]>
  → agentContext.appendAssistantStep：本步 tool 消息输出完后，
    合并追加一条 { role:'user', content: [文本标注路径, ...图像块] }
```

## 关键文件

| 文件 | 职责 |
|---|---|
| `tool/components/native/file.ts` | `image_read` 工具定义（`IMAGE_READ_TOOL_NAME` 导出）；追加进 `fileTools` 自动进 `getDefaultTools()`；`risk: 'safe'` 免审批 |
| `chat/agent/agentTools.ts` | `extractVisionImagePaths`：`visionImages` 约定键剥离 + 路径落 ext（与 `chatImages` 约定并列） |
| `chat/agent/visionBlocks.ts` | `imageMimeFromPath`（路径→MIME）、`MAX_IMAGE_BYTES` 改导出、`collectToolCallVisionBlocks`（扫描 toolcall ext → 读盘 → `Map<toolCallId, AiImageBlock[]>`，`excludePaths` 去重用户附件同路径、`skipToolCallIds` 跳过紧凑化失效调用） |
| `chat/agent/agentPrompts.ts` | 识图分支：`buildToolCallCompactPlan` 预过滤 expired/dropped 后调 `collectToolCallVisionBlocks`，结果传入 `toAgentRequestMessages` 第 6 参 |
| `chat/agent/agentContext.ts` | `appendStepVisionImages`：每步 tool 消息后追加图片 user 消息（expired 调用跳过；多图合并一条；文本块标注对应路径） |
| `tool/contextRules.ts` | `image_read: { resource: fileKey(path) }`：同路径重复读仅留最新一张图、`file_write` 同路径使旧图过期 |
| `chat/agent/agentFunctions.ts` | `isVisionModelRequest`：非识图模型在 `buildBaseFunctions` 裁剪 `image_read` schema（optionMap 查询同 `resolveModel` 键） |

## 契约与注意事项

- **约定键 `visionImages`**：handler 返回对象含该键（`string[]` 路径）即触发注入链路；执行器剥离后模型只看到业务字段。与 `chatImages`（纯 UI 展示不进模型）方向相反，两者可共存。
- **UI 最小实现**：工具卡片按 `data.result` 文本渲染（`data.ext.visionImagePaths` 已落库，后续加缩略图有数据基础）。
- **token 可控**：落库为路径引用，每轮请求构建时从磁盘重建（与用户附件「全部历史保留」策略一致）；`contextRules` 读类过期使同路径旧图自动不再注入；用户附件已注入的同路径图片按 `attachedUrls` 去重。
- **门控**：仅识图模型（`AiModel.support` 含 `'image'`）下发 schema；请求构建层同样由 `support?.includes('image')` 门控兜底。模型经执行期第③层兜底（`resolveForExecution`）直呼时工具可执行，但非识图模型图片不注入（仅返回元数据文本）。
- **子 Agent**：走同一函数表构建与请求构建链路，天然支持。
- 注入的 user 消息带文本块标注图片对应路径（多图按调用顺序），模型可区分多图归属。
