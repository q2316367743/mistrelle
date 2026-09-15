# humanize_text 工具（设计创意文案去 AI 味）

> 2026-09-11。把 AI 腔明显的文案改写得自然、像人写，作为工具提供给**设计创意（design）**聊天类型。

## 定位

- **服务端能力**：`POST {server}/api/rewrite`（SSE 流式），主进程 `RelayService.rewriteStream`（未登录抛「未登录，无法使用去 AI 味」），preload 桥 `window.preload.relay.rewriteStream`。
- **渲染层客户端**：`windows/main/modules/ai/humanize.ts`（`requestHumanizeStream` + `HUMANIZE_ENABLED`）。
  - 原位于 `windows/main/components/chat/aside/writing/article/humanizeApi.ts`，为让工具层复用（`tool/` 模块不能反向依赖 `components/`）下沉到 AI 请求域。
  - 写作侧边栏「去 AI 味」与 design 的 `humanize_text` 工具共用同一客户端，改动需同时考虑两侧。
- **请求时序**：工具直接 `await` 完整结果（不流式写 UI），返回改写文本；写作侧边栏则用 `onDelta` 流式写入编辑器，并另建版本。

## 工具契约

工具工厂 `createHumanizeTool()`，定义在 `windows/main/modules/tool/components/design/humanize.ts`。

| 字段      | 说明                                                                 |
|-----------|----------------------------------------------------------------------|
| `name`    | `humanize_text`                                                       |
| `label`   | 去 AI 味                                                              |
| `risk`    | `safe`（无本地副作用，全局策略直接放行，无需 `registerToolPolicy`）   |
| `content` | 必填，待改写文案（可含多行）                                          |
| `depth`   | 可选，改写力度 1~10 整数，缺省 5；越界 / 非法值自动钳制               |

返回成功：`{ success, content, depth, length }`（`content` 为改写后文本，`length` 去空白字数）；失败统一 `{ error }`。

## 注入与门控

- **能力门控**：`hasHumanizeAccess()` = `useAuthStore().status === 'signed-in'`（服务端需登录鉴权）。
- **注入点**：`createDesignTools()` 在登录后 `push(createHumanizeTool())`。canvas / html 两个设计引擎共用 `createDesignTools`（`DESIGN_SCENE_CONFIG`），故 **design 类型两种引擎均可用**；未登录不注入。
- **提示词同源判定**：`buildDesignCanvasPrompt` / `buildDesignHtmlPrompt` 新增 `hasHumanize` 参数，为 true 时追加「文案去 AI 味」小节，保证「提示词提到 humanize_text」与「工具已注入」始终一致。组装入口在 `global/ChatTypeConfig.ts` 的 `DESIGN_SCENE_CONFIG`。

## 提示词规则

两份设计提示词各追加一节（内容一致）：标题 / 副标 / 正文文案写完后自查 AI 腔（空泛对仗、堆砌形容词、"不仅仅是…更是…"、滥用排比 / 破折号），明显时调用 `humanize_text(content)` 改写后再排版；只改文案不改结构。位置：`modules/canvas/canvasPrompt.ts`、`modules/designHtml/designHtmlPrompt.ts`。

## 注意事项

- 工具**不落盘、不建版本**，只返回文本——模型需自行把 `content` 填进文字节点 / 元素。
- 与写作侧边栏的差异：侧边栏是「用户显式点按钮 + 深度弹窗 + 产出新版本」；工具是「AI 自主决定 + 返回文本」。
- 未登录时工具不注入且提示词不提及；即使被幻觉调用，handler 也会返回未登录错误。
