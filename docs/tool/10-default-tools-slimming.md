# 默认工具精简：28 → 20 个常驻

## 背景

`getDefaultTools()`（`modules/tool/index.ts`）是对话常驻工具的唯一组装点，全部默认工具
随每次请求发给模型。精简前共约 28 个，存在两类问题：

1. **模型不用**：shell 组里 `js_run` / `python_run` / `node_run` / `git_exec` 实际几乎不被
   调用（模型一律走 `cli_run`），纯属 token 开销。
2. **职责重叠**：`file_exists` 被 `file_stat` 完全覆盖（stat 成功即存在）；`read_skill_file`
   被 `file_read` 覆盖（load_skill 返回绝对路径，file_read 还多分页）；浏览器默认注入了
   `browser_fetch` + `ego_browser_run` + `ego_browser_exist` 三个。

精简后默认常驻 20 个：`ask` / `spawn_agent` / `record_memory` / `create_todo`（组装处追加）/
`cli_run` / `load_skill` / `file_list` / `file_read` / `file_write` / `file_delete` / `file_mkdir` /
`file_stat` / `file_glob` / `file_grep` / `file_read_docx` / `file_read_xlsx` / `file_read_pdf` /
`http_request` / `http_download` / `any_search`（+ 条件注入 `zhihu_search`）/ `browser_fetch`。

## 处置明细

### 彻底删除（含孤儿链路）

| 工具 | 删除理由 / 连带清理 |
|------|--------------------|
| `js_run` | 模型不用。全链路清理：`channels.ts` 通道、main `shellExecIpc.ts` handler、main `shellExec.ts` 实现（worker_threads + vm 双沙箱）、preload `shellExec.ts` 方法、`vite-env.d.ts` 声明、`plugin/shell.ts` 包装与 `JsRunResult` 类型 |
| `python_run` / `node_run` | 模型不用（一律 cli_run）。安全中心 `runtime.python/node` 路径配置、`SettingSecuredRuntime` 字段、设置页表单项一并删除（死配置）；`toolPolicy` 的 `SHELL_EXEC_TOOL_NAMES` 缩为 `['cli_run']`、`isSkillScriptCall` 删 `args.file` 分支（skill 脚本免审批走 cli_run 的 command 前缀判定，能力不回退） |
| `git_exec` | 模型不用；同 `python_run` 连带删 `runtime.git` 配置 |
| `file_exists` | 被 `file_stat` 完全覆盖，零能力损失 |
| `read_skill_file` | 被 `file_read` 覆盖（其 skill 目录路径约束不构成安全边界——file_read 默认在场可读任意路径）。`load_skill` description 已补「配套文件可用 file_read 读取」引导 |

### 移入可选分组（`toolGroups`，`toolMap` 登记）

| 工具 | 去向 |
|------|------|
| `ego_browser_run` / `ego_browser_exist` | 「浏览器」分组（与 `browser_open` / `browser_actions` 同组），发送框勾选或专家 `tools` 配置后可用 |
| `file_write_xlsx` | 新增「文档处理」分组（`fileParse.ts` 拆出独立导出 `fileWriteXlsxTool`；读类三个保留默认） |

### 迁移

| 工具 | 去向 |
|------|------|
| `image_info` | `tool/components/design/imageInfo.ts`，经 `createDesignTools` 随 design 聊天类型场景注入（`imageCrop` 工具描述引导 AI 用它确认尺寸，场景注入保证引导不落空）；普通聊天不再常驻 |

## 历史兼容（按名识别集合保留）

以下集合含已删工具名，**有意保留**，用于历史消息的渲染 / 统计 / 上下文判定：

- `utils/tokenEstimate.ts` 与 `modules/chat/agent/agentContext.ts` 的 `SKILL_TOOL_NAMES`（含 `read_skill_file`）
- `components/chat/chat-assistant/RChatTool.vue` 的 `skillToolNames`（含 `read_skill_file`）
- `components/chat/chat-assistant/tool/FileChatTool.vue` 的 `file_exists` 动词映射
- `FileProductList.vue` / `OfficeAside.vue` / `contextRules.ts` 对 `file_write_xlsx` 的判定（工具仍存在，勾选后照常生效）

旧工具的聊天卡片渲染降级：`RChatTool` 的 `shellToolNames` 缩为 `['cli_run']`，
`ShellChatTool.vue` 删 4 个 case，历史调用回落通用工具渲染。

## 关键文件

- `src/renderer/src/modules/tool/index.ts` — `getDefaultTools()` / `toolGroups` / `toolMap` 组装
- `src/renderer/src/modules/tool/components/native/shell.ts` — 仅存 `cli_run`
- `src/renderer/src/modules/tool/components/native/file.ts` / `fileParse.ts` / `skill/index.ts`
- `src/renderer/src/modules/tool/components/design/imageInfo.ts` — image_info 新家
- `src/renderer/src/modules/tool/toolPolicy.ts` — `SHELL_EXEC_TOOL_NAMES` / `isSkillScriptCall`
- `src/renderer/src/entity/setting/SettingSecured.ts` / `store/setting/SettingSecureStore.ts` /
  `pages/setting/secure/SettingSecurePage.vue` — 运行时配置只剩 egoBrowser
- `src/main/src/service/shellExec.ts` / `ipc/shellExecIpc.ts`、`src/preload/src/channels.ts` /
  `shellExec.ts` — jsRun 链路删除

## 注意事项

- 存量用户 `state.json` 里残留 `runtime.python/node/git` 字段无害（无读取方，赋值后被忽略）。
- 专家（agent）`tools` 若配置了被删工具名，`toolMap` 解析不到即静默跳过，不影响其他工具。
- `list_tools` 的 `builtinDefaults` 自动跟随 `getDefaultTools()`，专家创建助手无需改动。
- 新增执行类（shell）工具须同步 `SHELL_EXEC_TOOL_NAMES`，否则绕过计划模式审批（见 docs/tool/07）。
- skill 脚本免审批仅认 `cli_run` 的 `command`：skill 目录内的脚本请引导模型用
  `cli_run(绝对路径, args)` 执行（`isSkillScriptCall` 两种形态判定：路径前缀 / 整条语句 token 拆分）。
