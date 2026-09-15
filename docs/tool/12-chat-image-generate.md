# 通用生图：image_generate 对话直出（chat-image-generate）

> 2026-09-06：`image_generate` 升级为**唯一通用生图工具**。任何注入场景（日常办公 / 设计创意双引擎 / 各自子 Agent）
> 生成后一律把图片作为 `image` 内容块直接展示在对话中；设计场景原「path 填画布 image 节点 imageUrl / HTML `<img src>`」
> 的返回引导保留，两用途并存。门控从「本地配置了默认生图模型」改为「**已登录**」，积分扣减由服务端负责。
>
> 2026-09-14：新增 **`model` 档位参数**（AI 可按用途自选服务端档位）；新增**生图型子 Agent**（`spawn_agent(type="image")`）
> 作为文章配图的专用通道，工具面与提示词封闭，详见 [subagent/01](../subagent/01-subagent-module.md)。

## 实现思路

```
AI 调用 image_generate(prompt, path?, model?, size?)
  └─ handler：登录校验 → 档位解析（model || 默认生图模型 || 列表首项）→ window.preload.image.generate({ record:false, path })
       └─ main ImageService（工具直出模式：不建页面记录，落盘沙盒后返回终态）
  └─ 返回 { success, path, width?, height?, note, chatImages: [...] }
       └─ 执行器 runSingleTool 识别 chatImages 标记：
            ① 逐项 appendAssistantContent 写入 image 内容块（气泡内直接展示）
            ② 从回传给模型的工具结果中剥离 chatImages（模型只看到 path 等业务字段）
```

- 生图接口与文生图页面同源（`preload.image.generate` → main ImageService → 服务端 `/api/images/*`），
  `record: false` 直出模式不进页面历史，产物落 `{sandboxDir}/outputs/images/`。
- `image` 内容块是**纯 UI 块**：`agentContext` 的 `getText`/`getReasoning` 只挑 text/markdown/thinking，
  图片块对发给模型的载荷零影响；消息整条 JSON 落库（chat_content.data），无 DB 迁移。

## 关键文件

| 文件 | 职责 |
|---|---|
| `src/renderer/src/windows/main/modules/tool/components/design/imageGenerate.ts` | 工具本体：`hasImageGenerateAccess()` 登录门控导出、`model` 档位参数与解析、`chatImages` 标记、路径审批策略（沙盒/工作空间放行） |
| `src/renderer/src/windows/main/modules/tool/components/design/imageSubAgent.ts` | 生图型子 Agent 专用工具集（`createImageSubAgentTools`：image_generate + image_crop + image_info） |
| `src/renderer/src/windows/main/modules/tool/components/design/imageGenerateRules.ts` | 生图提示词知识单一源：设计双引擎共用的增强规则 + 生图子 Agent 自包含规则 |
| `src/renderer/src/windows/main/modules/chat/agent/agentTools.ts` | 执行器 `appendChatImages` 约定：识别 `chatImages` → 写 `image` 块（stepId 复用工具调用块的）→ 剥离标记 |
| `src/renderer/src/windows/main/components/chat/chat-assistant/RChatImage.vue` | 图片块渲染组件：t-image + `pathToHref` 转本地协议、已知宽高按原图比例占位、点击经 t-image-viewer trigger 插槽浮层放大预览 |
| `src/renderer/src/windows/main/components/chat/chat-assistant/MChatAssistant.vue` | `image` 渲染分支 + **折叠白名单**（`visibleContents` 过滤时保留 image 块，防止完成后生成图被「折叠执行过程」隐藏） |
| `src/renderer/src/global/ChatTypeConfig.ts` | office 注入（登录时 `[createImageGenerateTool(ctx)]` + 生图使用约定提示词）；`SUB_AGENT_TOOL_CONFIG.image` 注册生图子 Agent 工具集 |
| `src/renderer/src/windows/main/modules/tool/components/design/index.ts` | createDesignTools 注入门控同步换登录判断 |
| `src/renderer/src/domain/ChatMessage.ts` | `ImageContent`（`type:'image'`，`{ name?, url?, width?, height? }`）——类型早已定义但此前无写入无渲染，本次激活；`url` 存本地绝对路径 |

## 数据结构 / 契约

**工具参数新增 `model`（可选）**：服务端生图档位 code。description **动态**列出当前可选档位（`code（label，N 积分/张）`，
由 `useImageModelStore().items` 生成）。解析优先级：

```
显式 model（须命中当前档位列表，否则返回 error 让模型纠正，不静默回落）
  → 设置里的 defaultImageModel → 档位列表第一项
```

不传 `model` 时行为与旧版完全一致（仍走默认档位），因此对既有调用方零影响。

**工具返回值（模型可见，chatImages 已被执行器剥离）**：

```json
{ "success": true, "path": "/…/outputs/images/image-….png", "width": 1024, "height": 1024, "note": "…" }
```

**chatImages 标记（handler 返回值携带，执行器消费）**：

```ts
chatImages: [{ path: string, name?: string, width?: number, height?: number }]
```

**image 内容块（写入 AIMessage.content，随消息持久化）**：`ImageContent`，`data.url` 为本地绝对路径，
渲染层经 `window.preload.net.pathToHref` 转 file 协议展示。

**门控**：`hasImageGenerateAccess() = useAuthStore().status === 'signed-in'`（AuthStore 直连文件 import 防环，
照抄 ImageModelStore 先例）。未登录：office 不注入工具且提示词为空、design createDesignTools 不注入、
canvas/html 提示词不追加生图增强规则、writing 场景提示词改给登录引导、生图型子 Agent 被守卫直接拒绝；
工具被调用时兜底返回「未登录」错误。

## 注意事项

- **工具名唯一**：`image_generate` 全库仅此一个，office / design 场景与生图型子 Agent 注入的是同一个工具实例，行为一致
  （「AI 生图 = 设计创意生图 = 文章配图生图」）。
- **折叠白名单是易漏点**：MChatAssistant 完成后默认折叠过程，image 块若不加进 `visibleContents` 白名单，
  生成图会被折叠隐藏（本次已加）。
- **image 块不带 status 流转**：不属 ToolPhase 结构块，`setAssistantStatus` / `appendAssistantContent`
  收尾规则只连坐 text/markdown/reasoning/thinking，不会误改图片块；多图各自独立成块（无合并分支）。
- **stepId 分组**：image 块复用工具调用块的 stepId；历史回传 `appendAssistantStep` 中纯 UI 块不产生任何
  API 载荷（无 text 无 toolcall 的 step 直接 return），旧记录缺 stepId 的切分逻辑同样安全。
- **writing 场景的配图通道**：文章配图不再直接注入 `image_generate` 到主 Agent，而是经
  `spawn_agent(type="image")` 委托生图型子 Agent（工具面封闭、自行撰写提示词）；主 Agent 侧只负责「给用途与保存路径 → 登记」。
- 旧门控「配置了默认生图模型」的措辞已同步清理：canvasPrompt / designHtmlPrompt / canvas guidelines
  image-generation.md、ChatTypeConfig；`defaultImageModel` 设置本身保留，语义变为「首选档位」（表单与工具解析仍用）。

## 相关文档

- [attachment/03-image-generate-page.md](../attachment/03-image-generate-page.md) —— 主进程 ImageService 与 `record:false` 直出模式
- [tool/04-image-tools.md](./04-image-tools.md) —— image_crop / image_remove_background / image_color_map 等配套图片工具
- [tool/14-design-draw.md](./14-design-draw.md) —— `design_draw`：同样「生成图直出对话」，但内核是**画布绘图**
  （逐层构建、文案版式精确可控、无 AI 感），与本文的扩散生图互补——精确排版的图表类设计图走 design_draw，
  写实插画 / 照片质感素材走 `image_generate`。
