# 20 - chat 组件树迁出全局组件目录（2026-09-15）

## 背景

`src/renderer/src/components/chat/`（84 个文件）最初放在全局组件目录，依赖 unplugin-vue-components 自动导入（扫描根默认 `src/components`，d.ts 落在 `src/renderer/components.d.ts`）。但该树实际只有聊天链路使用，不符合全局组件定义，整体迁出。

> 注：「只有一个地方用到」仅对 `LChatEngine` 成立；整棵树的使用方包括 `PageChat`（引擎）、`PageNew`（`LChatSender`）、`pages/app`（`useWorkspaceList`）、`modules/chat/scenes` 注册表（各场景 Aside），因此落点为窗口级组件目录。

## 变更

- **目录迁移**：`src/renderer/src/components/chat/` → `src/renderer/src/windows/main/components/chat/`（新建 `windows/main/components/` 窗口级组件目录），内容零改动。
- **退出自动导入**：新位置不在 unplugin-vue-components 扫描根内，所有引用必须显式 import。
- **路径改写**：全部 `@/components/chat/` 前缀改为 `@/windows/main/components/chat/`（树内自引用 + 树外 5 文件 7 处：`modules/chat/scenes/{office,writing,design}.ts`、`pages/app/chat-func.tsx`、`pages/app/components/useChatGroups.ts`）。
- **补显式 import（原靠自动导入的 9 处）**：
  - `pages/chat/PageChat.vue`：`LChatEngine`
  - `pages/new/PageNew.vue`：`LChatSender`
  - `sender/LChatSender.vue`：`AiModelSelect`、`AiWorkspace`、`LChatAttachment`、`TokenUsagePanel`
  - `RChatList.vue`：`MChatUser`、`MChatAssistant`
  - `chat-assistant/MChatAssistant.vue`：`RChatThink`
  - `chat-user/MChatUser.vue`：`RChatActionbar`
- **components.d.ts 清理**：手工删除全部 60 条 `./src/components/chat/...` 条目（含 `WritingAside` 这条指向已删除文件的陈旧残留）。下次 dev 启动插件重新生成时因目录已移出扫描根不会再出现。

## 注意事项

- **新增 chat 组件引用一律显式 import**，不要依赖自动导入（对 tdesign 组件无效——`TDesignResolver` 与目录无关，仍自动导入）。
- `windows/main/components/` 是窗口级共享组件目录的起点；页面私有组件仍放各页面 `components/`，真正通用的才进 `src/components/`。
- `auto-imports.d.ts`（API 层自动导入）不受本次迁移影响。
