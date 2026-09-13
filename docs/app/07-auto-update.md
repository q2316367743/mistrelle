# 客户端自动更新

桌面端检查更新分两种模式，由服务端 `GET /api/updates/latest`（公开、轻量）决定：

- **内置更新（builtin）**：electron-updater generic provider 拉取 `https://mistrelle.esion.xyz/auto-updates` 下的 `latest.yml` / `latest-mac.yml`，应用内下载安装。
- **网盘模式（external）**：服务端下发 `downloadUrl` 网盘链接（一个链接含所有平台）。客户端展示版本变化 + 更新日志，「下载」按钮经 `openUrlByBrowser`（`shell.openExternal`）打开链接，不经应用内下载。网盘模式版本没有平台文件，不会出现在 electron-updater feed 里，主进程在调 autoUpdater 之前先拦下处理。

未打包（`!app.isPackaged`）不发检查请求。检查接口拉取失败 / 404 / 报文异常时回退 electron-updater feed（旧行为）。

## 行为

- `autoDownload = false`：发现新版本后由用户确认再下载，下完再确认 `quitAndInstall`
- 检查流程：主进程先 fetch `/api/updates/latest`（`AuthService.getServerBaseUrl()`，自实现 x.y.z 比较），external 且有新版直接广播 available；builtin 交给 autoUpdater
- 更新弹窗：统一 Fluent 风格弹窗（`UpdateDialog.vue`，复用主题里的 `--fluent-*` 令牌），显示「当前版本 → 新版本」与更新日志（纯文本按换行渲染），按钮 builtin =「立即更新」、external =「下载」；Esc / 点遮罩关闭
- 系统设置：当前版本、自动检查开关（`SettingGlobal.autoCheckUpdate`，默认 true）、手动检查；网盘模式的 available 状态文案带「（网盘分发）」后缀
- 主窗口启动后若开启自动检查则静默 check，有更新再弹弹窗

## 关键文件

| 文件 | 角色 |
|------|------|
| `electron-builder.yml` / `dev-app-update.yml` | `publish.url`（仅内置更新用） |
| `src/main/src/modules/updater/UpdaterService.ts` | 检查更新（先 JSON 后 feed）、autoUpdater 事件与状态 |
| `src/main/src/modules/updater/updaterIpc.ts` | IPC |
| `src/preload/src/modules/updater/` | 通道契约（`UpdaterState` 含 `mode` / `downloadUrl`）+ `window.preload.updater` |
| `src/renderer/src/windows/main/modules/updater/startAppUpdater.ts` | 启动检查与弹窗编排 |
| `src/renderer/src/windows/main/modules/updater/UpdateDialog.vue` + `updateDialog.ts` | Fluent 更新弹窗（createApp 独立挂载，Promise 返回 confirm/cancel） |
| `src/renderer/src/windows/main/pages/setting/global/SettingGlobalPage.vue` | 设置页 |

通道：`updater:getState` / `check` / `download` / `quitAndInstall` / `changed`。

## 注意事项

- electron-updater 必须留在 `dependencies`（externalize + 随包）。
- `/api/updates/latest` 无需鉴权，报文用 `in` 收窄校验，不信任字段类型。
- 服务端契约见 mistrelle-server `docs/12-electron-updater.md`。
