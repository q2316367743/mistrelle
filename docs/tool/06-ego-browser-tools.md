# ego-browser 工具：ego_browser_run 与 ego_browser_exist

## 背景

AI 操作 ego-browser（ego-lite）时，若走通用的 `cli_run`（`risk: 'sensitive'`）执行 `ego-browser`
命令会被安全策略拦截，需要用户逐个审批，体验很差。

因此新增两个**免审批**（`risk: 'safe'`）的专用工具，直接封装 `ego-browser` CLI，
让 agent 可以无缝执行浏览器自动化。

## 实现思路

- `ego_browser_run`：通用包装。第一个参数 `subcommand` 为 CLI 子命令，`args` 原样透传，
  组装成 `cliRun(egoBrowserPath, [--ego-server-name=<name>, subcommand, ...args])`。
- `ego_browser_exist`：只读探测，执行 `ego-browser --version` 判断是否安装可用。
- 底层复用 `@/plugin/shell` 的 `cliRun`（spawn 直传参数、双层超时兜底），不走 shell，
  多行 JS 脚本可作为一个 argv 元素安全透传。

## 可执行文件路径解析

ego-browser 命令**默认不在 PATH 中**（macOS 上 onboarding 注册到 `~/.local/bin`），
因此不硬编码 `'ego-browser'`，而是读取安全中心「内置运行时」的 `runtime.egoBrowser` 配置，
解析链（优先级从高到低）：

1. 用户配置：`setting.runtime.egoBrowser`（设置页输入框 / 文件选择器，可手动覆盖）
2. 系统默认路径（`getDefaultEgoBrowserPath()`，按平台推断）：
   - macOS：`~/.local/bin/ego-browser`（官方约定）
   - Windows：`%LOCALAPPDATA%\ego-lite\Application\ego-browser.exe`（按 Chromium 系
     Chrome/Edge 惯例猜测，无官方依据，可能失效；`%LOCALAPPDATA%` 由
     `os.getPath('temp')` 的上级目录推导）
   - Linux / 其他：空串
3. PATH 查找：`'ego-browser'`（仅当 1、2 均为空时）

> 注：`useUtoolsDbAsync` 加载已存在的设置文档时不做字段合并，存量用户的存储中没有
> `runtime.egoBrowser` 字段；store 的 `egoBrowserPath` getter 同样按上述链路兜底，
> 老用户无需进设置页即可生效。

## 关键文件

- `src/modules/tool/components/native/egoBrowser.ts` — 两个工具定义，handler 读取
  `useSettingSecureStore().egoBrowserPath` 执行
- `src/entity/setting/SettingSecured.ts` — `SettingSecuredRuntime.egoBrowser` 字段 +
  `getDefaultEgoBrowserPath()` 平台默认值推断（`buildSettingSecure()` 调用）
- `src/store/setting/SettingSecureStore.ts` — `egoBrowserPath` getter 兜底链
- `src/pages/setting/secure/SettingSecurePage.vue` — 「内置运行时」卡片新增 ego-browser 行
- `src/modules/tool/index.ts` — 注册进 `defaultTools`（全局默认可用）

## API 契约

### ego_browser_run（新增）

输入：

```json
{
  "subcommand": "nodejs",
  "args": ["-e", "await openOrReuseTab(\"https://example.com\"); cliLog(await snapshotText())"],
  "serverName": "app-a",
  "cwd": "/path",
  "timeout": 60000
}
```

- `subcommand`（必填）：`nodejs` / `import` / `upgrade` / `onboarding` / `help` 等。
- `args`：子命令后的参数列表，原样透传。
- `serverName`：映射 `--ego-server-name=<name>` 全局参数。
- `cwd` / `timeout`（ms）：透传给 `cliRun`。

输出：`{ stdout, stderr, exitCode, error? }`（`CliRunResult`）。

### ego_browser_exist（新增）

输入：`{}`（无参数）

输出：

```json
{
  "installed": true,
  "version": "1.2.3",
  "exitCode": 0
}
```

失败时：`{ installed: false, error, stderr }`。

## 注意事项

- **安全边界**：`ego_browser_run` 的 `nodejs` 子命令可执行任意 JS（同 `node_run` 级别），
  但按需求定为 `risk: 'safe'` → 永不弹窗、计划模式也放行。兜底仅剩安全中心**文件黑名单
  子串扫描**（对全部字符串参数生效）；因参数名为 `subcommand` 而非 `command`，
  **`commandAskList`（shell 命令询问名单）不会命中 `ego-browser`**。
- **无 stdin**：底层 `cliRun` 不支持 stdin，SKILL.md 中的 heredoc 写法
  （`ego-browser nodejs <<'EOF'`）不可用，必须用 `-e "<script>"` 形式，脚本含换行可直接传。
- 按 ego-browser 约定，通常每个用户目标复用一个 task space（`useOrCreateTaskSpace`），
  跨轮次用返回的 `task.id` 续用；任务完成调用 `completeTaskSpace(id, { keep: false })`。
