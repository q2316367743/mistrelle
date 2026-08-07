# docs/ 文档索引

> 本目录存放项目技术文档，供后续 AI 参考。 **请先读本文件**，按功能定位目标文档，无需逐个查看文件名。

## 索引

### canvas/ —— 画布

| 文档                                                                    | 描述                                                                                               |
|-------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| [02-canvas-node-model.md](./canvas/02-canvas-node-model.md)             | 画布节点模型与批量编辑（v2）：图层树 + 区域分组、`canvas_batch_edit`、调色板 token、内置设计 skill |
| [03-canvas-animation-export.md](./canvas/03-canvas-animation-export.md) | 画布动画与视频导出（v3）：声明式动画、逐帧渲染 + ffmpeg 导出、剪映式全屏进度遮罩                   |
| [04-canvas-element-tree.md](./canvas/04-canvas-element-tree.md)         | 画布元素树：设计侧边栏全屏双栏布局，`selectedId` 驱动元素树 ↔ 画布双向选中联动                      |

### chat/ —— 对话

| 文档                                                                | 描述                                                                              |
|---------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| [01-thinking-mode.md](./chat/01-thinking-mode.md)                   | DeepSeek 思考模式：`thinking` / `reasoning_effort` 参数、扁平字段设计、思维链渲染 |
| [02-chat-locator.md](./chat/02-chat-locator.md)                     | 对话侧边定位器（RChatList Locator）：仅用户消息展示、tooltip 预览前 10 字         |
| [03-canvas-node-reference.md](./chat/03-canvas-node-reference.md)   | 画布节点引用：双击节点 → 输入框 canvasMention → `CanvasContent` 结构化注入        |
| [04-chat-session-lifecycle.md](./chat/04-chat-session-lifecycle.md) | 会话生命周期与空闲自动回收：挂载/运行豁免、5 分钟 TTL 过期销毁、回收后磁盘水合    |
| [05-todo-progress.md](./chat/05-todo-progress.md)                   | 待办进度按钮：头部圆环 +「第 X / N 步」、t-popup 弹层复用 TodoList、空待办隐藏    |

### setting/ —— 设置

| 文档                                                   | 描述                                                                                          |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| [01-ai-model-fetch.md](./setting/01-ai-model-fetch.md) | AI 设置「从接口获取模型」抽屉：`FetchModelsDrawer` 命令式外壳 + `FetchModelsContent` 内容组件 |

### subagent/ —— 子 Agent

| 文档                                                      | 描述                                                                               |
|-----------------------------------------------------------|------------------------------------------------------------------------------------|
| [01-subagent-module.md](./subagent/01-subagent-module.md) | 子 Agent 模块：能力类型 × 聊天类型矩阵、research / design 两类、模块结构与运行流程 |

### tool/ —— 工具

| 文档                                                    | 描述                                                                                                              |
|---------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| [01-browser-selector.md](./tool/01-browser-selector.md) | 浏览器工具 CSS 选择器提取：`browser_fetch` / `browser_actions` 可选 selector 参数、空结果防护                     |
| [02-asset-tools.md](./tool/02-asset-tools.md)           | 设计素材工具：`website_logo` / `icon_svg` 获取真实素材，来源打分降序尝试                                          |
| [03-font-tools.md](./tool/03-font-tools.md)             | 字体工具与渲染：`font_list` / `font_register`、system / library / online 三态统一契约                             |
| [04-image-tools.md](./tool/04-image-tools.md)           | 生图 / 裁剪 / 去背景：`image_generate`（接口自适应）+ `image_crop` 本地切分 + `image_remove_background` flood fill 去白底（生图不支持真透明） |
| [05-file-tools.md](./tool/05-file-tools.md)             | 文件系统工具：`image_info` 收敛为格式 / 宽高（去 size）、新增 `file_stat` 基于 fs.stat 返回权威文件信息           |

### writing/ —— 写作

| 文档                                                           | 描述                                                                                   |
|----------------------------------------------------------------|----------------------------------------------------------------------------------------|
| [01-writing-scene.md](./writing/01-writing-scene.md)           | 写作子场景（WritingScene）：大类型管框架、子场景管能力，当前唯一场景 article           |
| [02-article-data-layer.md](./writing/02-article-data-layer.md) | 文章数据层与工具：project.json 索引 + drafts 正文 + assets 配图、`article_*` 工具驱动  |
| [03-article-aside.md](./writing/03-article-aside.md)           | 文章侧边栏：writing 侧边栏按 chatType → writingScene 两层拆分、`ArticleAside` 项目容器 |
| [04-image-export.md](./writing/04-image-export.md)             | md 图片引用与 zip 导出：相对路径约定、`imageRef.ts` 解析与压缩导出                     |

---

## 维护约定

- **新增文档**：新建 `docs/<模块>/<NN>-<名称>.md`，并同步在本文档对应分组下登记一行索引。
- **更新文档**：标题或职责变更时，同步修正本文档中的描述，避免索引与实际内容脱节。
- **删除文档**：同步移除本文档对应行。
