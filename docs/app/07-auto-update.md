# 客户端自动更新

桌面端通过 electron-updater generic provider 拉取 `https://mistrelle.esion.xyz/auto-updates` 下的 `latest.yml` / `latest-mac.yml`。未打包（`!app.isPackaged`）不发检查请求。

## 行为

- `autoDownload = false`：发现新版本后由用户确认再下载，下完再确认 `quitAndInstall`
- 系统设置：当前版本、自动检查开关（`SettingGlobal.autoCheckUpdate`，默认 true）、手动检查
- 主窗口启动后若开启自动检查则静默 check，有更新再弹确认

## 关键文件

| 文件 | 角色 |
|------|------|
| `electron-builder.yml` / `dev-app-update.yml` | `publish.url` |
| `src/main/src/modules/updater/UpdaterService.ts` | autoUpdater 事件与状态 |
| `src/main/src/modules/updater/updaterIpc.ts` | IPC |
| `src/preload/src/modules/updater/` | 通道契约 + `window.preload.updater` |
| `src/renderer/src/windows/main/modules/updater/startAppUpdater.ts` | 启动检查与确认框 |
| `src/renderer/src/windows/main/pages/setting/global/SettingGlobalPage.vue` | 设置页 |

通道：`updater:getState` / `check` / `download` / `quitAndInstall` / `changed`。

## 注意事项

- electron-updater 必须留在 `dependencies`（externalize + 随包）。
- 服务端契约见 mistrelle-server `docs/12-electron-updater.md`。
