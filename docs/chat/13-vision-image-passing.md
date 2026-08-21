# 13 - 模型识图（Vision）：引用图片随请求传递

> 2026-08-21。模型勾选「识图」能力后，agent 聊天把用户消息（含全部历史轮）引用的图片附件按 API 格式转为多模态内容块传递。

## 实现思路

图片从输入框到请求体的路径**不改存储结构**：粘贴/拖拽仍以 `attachment` 内容块（磁盘绝对路径、`fileType:'image'`）落库；在**构造请求时**由渲染进程读盘转 base64 data URL，重建为图像内容块。这样 SQLite 存量与水合零改动，且历史轮图片可随时恢复（全部历史保留策略，贴近 ChatGPT/Claude 主流行为——API 无状态，历史里的图每轮随消息重发）。

能力开关是模型级字段：设置页模型编辑弹窗勾选「识图」→ `AiModel.support` 持久化 → `resolveModel` 带出 → 请求构造时判断是否转块。未勾选的模型行为完全不变（图片仍是路径文本引用）。

## 关键文件

| 文件 | 职责 |
|---|---|
| `entity/setting/SettingAi.ts` | `AiModelSupport = 'image' \| 'think'` 独立命名 type（后续扩展只改此处）、`AiModelSupportOptions`、`AiModel.support?` |
| `pages/setting/ai/modals/OpenModelDialog.tsx` | 「能力」CheckboxGroup；identifier 失焦时随预设自动勾选 |
| `global/aiModelPresets.ts` | `AiModelParams.support?`；各厂商 vision 型号在精确表 + 家族正则行内标注 |
| `modules/ai/types.ts` | `AiTextBlock` / `AiImageBlock` / `AiContentBlock`；`AiMessageParam.content` 放宽为 `string \| AiContentBlock[] \| null` |
| `modules/chat/agent/visionBlocks.ts` | 图像块收集：扩展名白名单（png/jpg/jpeg/gif/webp）、读盘、分块 btoa、单图 >20MB 跳过 |
| `modules/chat/agent/AgentChat.ts` | `resolveModel` 带出 `support`；`buildRequestMessages` 收集图像块并传入转换层；`buildReferenceContext` 给已附图的 File 条目加「已作为图片附于本消息」标注 |
| `modules/chat/agent/agentContext.ts` | `toAgentRequestMessages` 第 4 参 `imagesByMessageId: Map<消息id, AiImageBlock[]>`，有图的用户消息 content 构造为 `[text?, ...images]` 数组 |
| `modules/ai/formats/{util,responses,anthropic}.ts` | 三格式协议映射（见下）；chat 格式透传无需改 |
| `utils/tokenEstimate.ts` | `messageText` 复用 `contentText`，数组 content 取 text 块求和 |

## 数据流

```
attachment(url=磁盘路径) ──collectVisionBlocks──▶ Map<messageId, AiImageBlock[]>
                                                      │
toAgentRequestMessages ◀──────────────────────────────┘  user.content = [text, ...image_url 块]
        │
createChatStream(format 适配器) ──▶ chat: 原样透传
                                    responses: input_text / {type:'input_image', image_url}
                                    anthropic: text / {type:'image', source:{base64|url}}
```

- **chat**（DeepSeek/OpenAI 兼容）：`{type:'image_url', image_url:{url}}`，url 为 `data:image/png;base64,...`
- **responses**：`{type:'input_image', image_url: '<url 字符串>'}`（注意该协议 url 是字符串非对象）
- **anthropic**：data URL 正则拆出 media_type/base64 → `{type:'base64'}` source；http(s) → `{type:'url'}` source

## 注意事项与边界

1. **图片只能进 user 消息**（DeepSeek 视觉 API 约束，system/assistant 带图返回 400），实现只在 user 分支构造数组。
2. **单图 >20MB 或读盘失败**：跳过该图（不阻断对话），当前轮 File 引用条目无标注，回退纯路径引用。
3. **每步 agent loop 都会重建 base64**（本地 IO，几 MB 级，可接受）；未做缓存，未来如需可按 `path+mtime` 缓存。
4. **token 成本**：历史图每轮重发；DeepSeek 单张计费上限约 384 token，Anthropic 约 1600，成本可控但多图长对话需留意。现有 agentContextCompact 只压工具对，不压图像块，必要时可在此挂接。
5. **o1 系列 / gpt-4 纯文本、deepseek-chat/reasoner 不支持视觉**已在预设中明确不标 support；DeepSeek 官方仅 `deepseek-v4-flash-vision-exp` 收图，其余收图返回 400。
6. 预设 `support` 数据来源为厂商官方文档（核对日期 2026-08-21），拿不准的型号宁缺毋滥。
