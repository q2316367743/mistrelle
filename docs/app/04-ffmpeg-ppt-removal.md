# ffmpeg 与 PPT 功能移除记录

> 2026-09-04 整体移除 ffmpeg 与 PPT 专家两块功能。本文记录删除范围与「勿再引用」清单，后续 AI / 开发者
> 不必再寻找这些符号，也不要在新代码中引用。

## 一、ffmpeg（已整体移除）

**功能构成**：main 进程二进制管理 + IPC（`ffmpeg:run/kill/quit`）、preload 桥（`window.preload.inject.ffmpeg`）、
AI 工具 `ffmpeg_run`（「媒体工具」组，组内唯一成员）、内置专家 `builtin:ffmpeg`「FFmpeg 多媒体专家」、
画布视频 / GIF 导出（依赖 ffmpeg 编码）。

**已删除**：

- `src/main/src/modules/ffmpeg/`（ffmpegBinary.ts / ffmpegIpc.ts）、`registerIpc.ts` 注册
- `src/preload/src/modules/ffmpeg/`（ffmpegChannels.ts / ffmpeg.ts）、`inject.ts` 聚合、`types/inject.d.ts` 三接口
- `src/renderer/src/modules/tool/components/inject/ffmpeg.ts`、`tool/index.ts` 的 `media` 工具组与 toolMap 条目
- `BuiltInAgent.ts` 的 `builtin:ffmpeg`
- 视频导出链：`canvasVideoExport.ts`、`videoExportState.ts`、`VideoExportOverlay.vue`、
  `VideoExportDialog.tsx`、`VideoExportContent.vue`、App.vue 挂载、DesignAside「导出为视频」入口
- `resources/ffmpeg/`、`scripts/fetch-ffmpeg.mjs`、electron-builder `extraResources` 与 files 排除、`.gitignore` 条目

**保留**：画布动画能力（`CanvasAnimation` 类型、元素 `animation` / `animationOut` 字段、`@leafer-in/animate`）——
被 canvasRender / canvasSchemas / canvasPrompt 消费，与视频导出无关；文档见 `docs/canvas/03-canvas-animation.md`。

**勿再引用**：`ffmpeg_run`、`media` 工具组 id、`InjectFfmpeg*` 类型、`ensureFfmpegBinary`、`getFfmpegPath`、
`startVideoExport`、`exportCanvasVideo`、`getVideoExportController`、`maxAnimationTime`（随导出删除）。

## 二、PPT 专家（已整体移除）

**功能构成**：`ChatType` 的 `'ppt'`（「PPT 专家」聊天类型）、15 个 `ppt_*` AI 工具（场景级注入，不入全局 toolMap）、
渲染层 `modules/ppt/`（Vue 渲染 + POM 数据层）、聊天侧边栏 `aside/ppt/`、输入框 `pptMention` 节点引用、
main 进程 PptxGenJS 导出。

**已删除**：

- 渲染层：`modules/ppt/` 整目录、`windows/main/components/chat/aside/ppt/`、`windows/main/components/chat/ppt/`（pptNodeBridge）、
  `modules/tool/components/ppt/`（工具定义 + `registerToolPolicy` 策略）、`types/ppt.d.ts`
- main / preload：`src/main/src/modules/ppt/`（pptIpc / pptxExport / pngWriter）、`src/preload/src/modules/ppt/`、
  `window.preload.ppt` 挂载与 `vite-env.d.ts` 声明
- 类型与逻辑：`ChatType` 去 `'ppt'`、`CHAT_TYPE_CONFIG` / `CHAT_TYPE_OPTIONS` 条目、`PptItem` / `PptContent`、
  `SUB_AGENT_ALLOW.ppt`、`contextRules` 的 ppt 资源粒度规则、`agentContext` PPT 节点定位段、
  `buildDesignStylePrompt` 的 `withVisualPrompt` 选项（唯一 false 调用方是 ppt）、
  `PersonalizeService` design scope 的 ppt 并入
- UI：`LChatAside` ppt 分支、`LChatSender` pptMention 节点与 `addPptNode`、`chatSenderContent` pushPpt、
  `MChatUser` / `RChatList` / `ChatList` 展示分支、`LChatEngine` 默认展开、`PageNew` 风格选择器条件
- 依赖：`pptxgenjs`（唯一消费者 pptxExport.ts）
- 文档：`docs/ppt/` 整目录

**保留**：`AttachmentType` 的 `'ppt'` 成员与 `userContent.ts` 扩展名映射——`.ppt/.pptx` 文件作为**通用附件**
拖入聊天的识别能力，与 PPT 专家模块无代码耦合。存量 `type='ppt'` 会话记录不做特殊处理（列表图标走默认，
点击打开无对应配置，属已知可接受行为）。

**勿再引用**：`ppt_create` / `ppt_batch_edit` 等 ppt_* 工具名、`ChatType` 的 `'ppt'`、`PptItem` / `PptContent`、
`PPT_NODE_PICK_KEY`、`PptNodeRef`、`pptMention`、`window.preload.ppt`、`pptxgenjs`。

## 三、关联文档变更

- 删除：`docs/build/03-ffmpeg-bundling.md`、`docs/ppt/`（4 篇）
- 重写：`docs/canvas/03-canvas-animation-export.md` → `docs/canvas/03-canvas-animation.md`（移除视频导出章节）
- 历史记录（`docs/migration/01-electron-preload-migration.md`）中 ffmpeg 章节作为历史事实保留，不再对应现网代码
