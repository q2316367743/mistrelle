# shell 执行插件：cliRun / jsRun 双层超时保障

## 实现思路

外部命令（CLI / JS 沙箱）统一走 `src/plugin/shell.ts` 暴露给上层，再经 preload 桥接调用 `src-utools/src/shellExec.js`。为防止任一环节挂起导致调用方无限等待，执行超时采用**双层保障**：

1. **底层（src-utools）**：`spawn` 子进程 + 手动计时器，到期 `kill` 子进程并返回超时错误；另有输出 10MB 上限与 `exit` 后 close 宽限期兜底。**能真正终止进程**。
2. **前端（src/plugin/shell.ts）**：`Promise.race` + 守卫计时器，兜底 **IPC 桥接挂起**（preload / utools 层异常导致 Promise 永不 resolve）时返回超时错误。前端无 abort 通道，**无法终止底层子进程**，仅保证调用方不挂起。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/plugin/shell.ts` | 前端包装层：`cliRun` / `jsRun`，负责日志与前端超时兜底 |
| `src-utools/src/shellExec.js` | 底层执行层：`spawn` CLI、worker 线程跑 JS 沙箱，负责进程级超时 kill |
| `src/vite-env.d.ts` | preload 桥接类型声明 |

## 超时契约

- `CliRunOptions.timeout`（可选，毫秒）：调用方指定底层执行超时；缺省取 `DEFAULT_CLI_TIMEOUT_MS = 30000`（与底层默认一致）。
- 前端兜底守卫时长 = `(options.timeout ?? 30000) + FRONT_GUARD_GRACE_MS(5000)`。
- 正常路径：底层超时先触发（精确 kill），前端守卫不生效。
- 异常路径：底层 Promise 挂起不 resolve，前端守卫在 `timeout + 5s` 时返回 `{ error: '命令执行超过 Xms 未返回，已强制终止' }`。
- 兜底返回结构与底层超时错误格式一致（带 `error` 字段），调用方无需区分来源。

## 兼容性

- `transcribe.ts`：以 `result.exitCode !== 0` 判断失败，超时结果 `exitCode` 为 `undefined`，`undefined !== 0` 为 true，正常抛错。
- `native/shell.ts`：把 `{ error }` 结果直接返回给 AI 工具，展示超时原因。
- `jsRun` 未加前端兜底：底层已有 worker 内 vm timeout + 主线程 `terminate` 双保险，且 worker Promise 必会 resolve。

## 注意事项

- 前端超时命中后底层子进程仍可能继续运行，无取消通道；如需真正中断请依赖底层超时（默认 30s）。
- 守卫计时器在 `finally` 中清理，避免泄漏。
