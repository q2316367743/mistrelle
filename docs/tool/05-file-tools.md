# 文件系统工具：image_info、file_stat 与 file_glob / file_grep

## 背景

### image_info 与 file_stat 的职责分离

`image_info` 原先基于 sharp metadata 返回 `format / width / height / size`，但 sharp metadata 的 `size`
字段并不可靠（可能返回 `undefined`，旧实现会兜底为 `0`，误导 AI）。

因此将两者职责分离：

- `image_info` 只负责**图片内容解析**（格式 / 宽高），不再返回 `size`。
- 文件大小等**文件系统信息**由 `file_stat` 承担，基于 `fs.stat`，结果权威可靠。

### file_glob / file_grep 补全搜索能力

原文件工具只有单点读写（`file_list` / `file_read` / ...），缺少「按模式找文件」和「按内容搜代码」两个
高频能力。补全 `file_glob`（文件名 glob 匹配）与 `file_grep`（内容正则搜索），递归遍历与匹配全部在
主进程完成（单次 IPC 返回），不引入第三方 glob 库。

## 实现思路

- `readImageInfo`（`src/utils/imageInfo.ts`）收敛为返回 `{ format, width, height }`。
- `file_stat` 基于主进程 `fs.stat`，手动转换字段返回普通对象，风格与 `readDir` 的 `FileItem` 一致。
- `file_glob` / `file_grep` 走「主进程单方法 + 薄 preload 桥」：
  - `globToRegex`：手写 glob → 正则转换，支持 `**`（任意层级，含零层）、`*`（单层通配，不跨 `/`）、
    `?`、`{a,b}` 多选、`[...]` / `[!...]` 字符类（`!` 取反转 `^`），其余字符转义。
  - `walkFiles`：DFS + `readdir({ withFileTypes: true })` 递归遍历；符号链接目录不触发
    `Dirent.isDirectory()`，天然防环。
  - `file_grep` 的 `pattern` 先按 `new RegExp` 解析，**非法正则自动降级为字面量匹配**（转义特殊字符），
    避免整个搜索直接失败。
  - `include` 过滤：不含 `/` 时按 basename 匹配（天然任意深度），含 `/` 时按相对路径匹配。

### 结果上限（防上下文膨胀）

工具结果回传模型有 128KB 截断，grep / glob 必须自带上限，超限即**停止扫描**并标记 `truncated: true`
（description 已提示模型收窄 pattern / include 后重试）：

| 限制项               | 值        | 说明                              |
| -------------------- | --------- | --------------------------------- |
| glob 文件数上限      | 200       | 超出即停止遍历                    |
| grep 匹配数上限      | 100       | 超出即停止扫描                    |
| grep 单文件大小上限  | 2MB       | 超过跳过                          |
| grep 匹配行文本截断  | 200 字符  | trim 后截断                       |
| 递归深度上限         | 15        | 防止从磁盘根目录起扫描失控        |
| 遍历忽略目录         | 见下方    | 跳过整个子树                      |

内置忽略目录：`node_modules` `.git` `dist` `out` `build` `.next` `.cache` `coverage` `.venv` `__pycache__`。

### 二进制文件跳过

`file_grep` 以 UTF-8 读取后检查前 8KB 是否含 NUL（`\0`），命中视为二进制跳过；读取失败（权限 / 编码）
的文件静默跳过。

## 关键文件

- `src/preload/src/channels.ts` — `FsChannels.glob / grep` 通道 + `FsGlobOptions` 等共享接口
- `src/main/src/ipc/fsIpc.ts` — `globToRegex` / `walkFiles` / 两个 handler 的全部实现
- `src/preload/src/fs.ts` — preload 桥 `glob` / `grep` 透传方法
- `src/renderer/src/types/fs.d.ts` — 渲染侧 `FsApi` 声明同步（含 `FsGlobResult` / `FsGrepResult`）
- `src/renderer/src/modules/tool/components/native/file.ts` — `image_info` 调整 + `file_stat` /
  `file_glob` / `file_grep` 工具定义

## API 契约

### image_info

输入：`{ path: string }`　输出：`{ path, format, width, height }`

- 去掉 `size` 字段。文件大小请调用 `file_stat`。

### file_stat

输入：`{ path: string }`

```json
{
  "path": "/abs/path",
  "isDirectory": false,
  "isFile": true,
  "size": 1024,
  "mtime": 1754553600000,
  "ctime": 1754553600000,
  "atime": 1754553600000,
  "birthtime": 1754553600000
}
```

### file_glob

输入：`{ path: string, pattern: string }`（`pattern` 如 `**/*.vue`、`src/**/*.ts`、`*.{json,md}`）

```json
{ "files": ["/abs/a.vue", "/abs/b.vue"], "truncated": false }
```

- 返回匹配文件的**绝对路径**（可直接交给 `file_read`），不含目录。

### file_grep

输入：`{ path: string, pattern: string, include?: string, ignoreCase?: boolean }`

```json
{
  "matches": [{ "file": "/abs/a.ts", "line": 12, "text": "export function foo() {" }],
  "truncated": false
}
```

- `matches` 按遍历顺序返回，`line` 为 1 起始行号。

### 通用

- 四个工具均 `risk: 'safe'`，经过沙盒黑名单校验（`checkBlacklist`）与默认工具策略的
  `args.path` 可信区域 / 白名单裁决。
- `file_glob` / `file_grep` 在 handler 内先校验目录存在（`existsSync`）并 try/catch 兜底返回 `{ error }`。
- 工具定义在 `fileTools` 数组追加即自动进入 `getDefaultTools()`，无需在 `toolMap` / `toolGroups` 登记。

## 注意事项

- 需要文件大小时应优先 `file_stat`（`fs.stat`），不要依赖 sharp metadata。
- glob 匹配对象是**相对起始目录的路径**（`/` 分隔）：`*.md` 只匹配根层，`**/*.md` 匹配任意层级——
  description 已向模型说明该语义。
- shell 工具的 `cli_run` 也能跑 grep / rg，但属 sensitive 风险需审批且输出非结构化；`file_grep` 是
  safe 的结构化替代。
