# 03 画布节点引用（双击画布节点 → 输入框 → CanvasContent）

> 用户在画布侧边栏双击某个图层节点，即可把「画布版本 + 节点 id」引用注入聊天输入框；
> 发送后转为结构化 `CanvasContent`，AI 收到提示词后可用 `canvas_open(version)` 打开画布、按 `nodeId` 定位并修改该节点。

## 实现思路

改造链路（从 UI 操作到模型上下文）：

```
CanvasRenderer 双击节点
  → inject(CANVAS_NODE_PICK_KEY) 调用 LChatEngine provide 的桥接回调
    → senderRef.value.addCanvasNode({ version, nodeId, label })
      → LChatSender 在编辑器插入 canvasMention 节点（渲染成 t-tag 标签）
        → 发送时 serializeEditorContent 将 canvasMention 转成 CanvasContent
          → agentContext.buildPinnedContext 把 CanvasContent 渲染成给模型的指令文本
          → MChatUser / RChatList 将 CanvasContent 渲染成聊天列表标签
```

## 关键文件

| 文件                                                  | 职责                                                                                 |
|-------------------------------------------------------|--------------------------------------------------------------------------------------|
| `src/domain/ChatMessage.ts`                           | 新增 `CanvasItem` / `CanvasContent`，并入 `UserMessageContent`                       |
| `src/components/chat/design/canvasNodeBridge.ts`      | `CanvasNodeRef` 类型 + `CANVAS_NODE_PICK_KEY`（InjectionKey）                        |
| `src/components/chat/LChatEngine.vue`                 | `provide(CANVAS_NODE_PICK_KEY, ...)`，转发到 `senderRef.addCanvasNode`               |
| `src/components/chat/sender/LChatSender.vue`          | `CanvasMention` tiptap 节点、`addCanvasNode` 方法（`defineExpose`）、canvas 维度提取 |
| `src/components/chat/sender/chatSenderContent.ts`     | `canvasMention` → `CanvasContent` 序列化                                             |
| `src/components/chat/aside/design/CanvasRenderer.vue` | 双击事件 → 注入回调（无桥接时降级复制节点 id）                                       |
| `src/modules/chat/agent/agentContext.ts`              | `buildPinnedContext` 处理 `CanvasContent`                                            |
| `src/components/chat/chat-user/MChatUser.vue`         | 聊天列表渲染 canvas 标签                                                             |
| `src/components/chat/RChatList.vue`                   | 定位器 tooltip 的 canvas 兜底文案                                                    |

## 数据结构 / API 契约

### CanvasContent（用户消息内容类型）

```ts
export type CanvasItem = {
  /** 画布版本号，对应 outputs/canvas-{version}.canvas，供 AI canvas_open(version) */
  version: number
  /** 节点 id（图层树中的唯一标识） */
  nodeId: string
  /** 节点图层名，仅用于展示；无 name 时回退为 nodeId */
  label?: string
}
export type CanvasContent = ChatBaseContent<'canvas', CanvasItem>
```

### canvasMention 节点 attrs

```ts
{
  version: number;
  nodeId: string;
  label: string
}
```

### DI 桥接

- `CanvasNodeRef = CanvasItem`
- `CANVAS_NODE_PICK_KEY: InjectionKey<(ref: CanvasNodeRef) => void>`
- LChatEngine 在 setup 中 `provide(CANVAS_NODE_PICK_KEY, (ref) => senderRef.value?.addCanvasNode(ref))`
- CanvasRenderer 通过 `inject(CANVAS_NODE_PICK_KEY, null)` 消费；`null`（无聊天输入框环境）时降级为复制节点 id 到剪贴板

### AI 指令文本（buildPinnedContext）

```
用户在本条消息中指定了以下画布节点，请先打开画布定位节点，再按需修改：
- 画布节点：画布 canvas-{version} 中的节点 {nodeId}（图层名 {label}）：请先 canvas_open({version}) 打开画布，再用 canvas_get_nodes / canvas_batch_edit 等工具定位并处理该节点
```

## 注意事项

- **CanvasContent 只出现在用户消息**（`UserMessageContent` 联合新增），不走 AI 消息的 `AIContentType` 映射；
- 取非 text 分支时必须分类型判断（`item.type === 'canvas'` 单独分支），因为 `CanvasItem` 字段与 skill / tool 不同，TS 需要收窄；
- `CanvasMention` 用 `TiptapNode.create`（`@tiptap/core` 的 `Node`）， **不能与 DOM 全局 `Node` 重名**，导入时需
  `as TiptapNode` 别名，否则与 `handleContainerDrop` 里的 DOM `Node` 断言冲突；
- `isSuggestionActive` 只检查 `skillMentionPluginKey / fileMentionPluginKey / toolMentionPluginKey`，canvasMention
  无触发字符、不挂 suggestion 插件，无需加入该判断；
- 双击命中 group 背景 rect 时沿 `parent` 链向上取最近带 id 元素（label 取该节点 `name`），空白区域无 id 直接忽略；
- `clear()` 重置时 `mentionState` 的 `canvas` 维度必须同步清空，否则发送后残留引用导致误判可发送。
