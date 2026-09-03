# 主进程目录结构（域优先）

> 2026-09-03 重构落地。此前 `src/main/src` 顶层混用「按域」（auth/image/ppt…）与「按层」（ipc/service/db/utils）两种维度：`auth/` 混装 AI 中转与设计风格远端、`service/` 混装 3 个互不相关的服务、多个目录只有 1 个文件、`ipc/` 下 17 个 handler 平铺。现为**域优先**组织，与渲染层 `src/renderer/src/modules/` 命名对称。

## 目录总览

```
src/main/
├── index.ts                    # 入口（electron-vite 约定位置）：scheme 注册 → ready 后 registerIpc/initAuth/协议/托盘/窗口
└── src/
    ├── registerIpc.ts          # IPC 注册聚合点：顺序调用各域 registerXxxIpc()（新增域在此登记一行）
    ├── app/                    # 应用外壳
    │   ├── aiWindow.ts         # AI 主窗口（启动即建、关闭只隐藏、托盘/Dock 唤起）
    │   ├── tray.ts             # 托盘常驻（显示 AI 窗口 / 退出）
    │   └── protocol.ts         # mistrelle:// 自定义协议（特权 scheme 注册 + protocol.handle 读盘）
    ├── modules/                # 业务域：service 与对应 ipc handler 同域同居
    │   ├── auth/               # AuthService.ts（账号单例）+ authIpc.ts
    │   ├── relay/              # RelayService.ts（服务端 /v1/* 中转客户端）+ relayIpc.ts
    │   ├── design-style/       # DesignStyleRemote.ts（在线设计风格，经 authedApiGet）
    │   ├── image/              # ImageService.ts（文生图编排单例）+ imageIpc.ts
    │   ├── browser/            # runner.ts + pageScripts.ts + keyCodes.ts + browserToolIpc.ts（browser_fetch/browser_actions）
    │   ├── font/               # index.ts（字体枚举/资源库）+ parser.ts（字体名表解析）+ fontIpc.ts
    │   ├── sharp/              # image.ts（metadata/crop/去底/主色）+ sharpIpc.ts
    │   ├── ppt/                # pptxExport.ts（DOM 快照 → PPTX）+ pngWriter.ts + pptIpc.ts
    │   ├── shell/              # shellExec.ts（cliRun 子进程）+ shellExecIpc.ts
    │   ├── ffmpeg/             # ffmpegBinary.ts（随包路径解析）+ ffmpegIpc.ts
    │   ├── template/           # templateRender.ts（EJS 渲染服务）+ templateIpc.ts
    │   └── platform/           # Electron/OS 基础能力：electronIpc.ts（shell/dialog/clipboard/os/display/notification）+ fsIpc.ts + safeStorageIpc.ts
    └── db/                     # 数据基础设施（结构未动）
        ├── client.ts           # better-sqlite3 + drizzle 单例 + migrate
        ├── dbIpc.ts            # DB 域 IPC（原 ipc/dbIpc.ts 移入）
        ├── schema/             # 各领域表定义（aihot/chat/compare/health/image）
        └── repo/               # 各领域查询层 DAO
```

## 约定

- **域优先**：一个业务域 = `modules/<域>/` 一个目录，域内聚「服务实现 + `xxxIpc.ts` handler」。找到某域的全部主进程逻辑只需进一个目录。
- **import 规则**：同域内相对路径（`./AuthService`）；跨域用 `$` 别名或 `modules/` 内浅层相对（`../relay/RelayService`）；db 基础设施保持 `$` 别名（`$/db/repo/imageRepo`）。
- **新增域**：建 `modules/<域>/` 放服务 + `<域>Ipc.ts`，在 `src/registerIpc.ts` 登记一行；IPC 通道常量在 preload 侧同域目录 `src/preload/src/modules/<域>/<域>Channels.ts`（main 经 `~` 别名引用，见 docs/app/03）。
- **platform** 收纳无业务语义的 Electron/OS 能力（electronIpc 六组、fs、safeStorage），不再单设目录。

## 外部同步点（已核实无需改动）

| 引用 | 说明 |
|------|------|
| `tsconfig.node.json` / `electron.vite.config.ts` | `$` 别名根 `src/main/src` 不变 |
| `drizzle.config.ts` | schema 路径 `src/main/src/db/schema/index.ts` 不变（db/ 未动） |
| `~/modules/<域>/*Channels` | preload 契约经 `~` 别名引用（2026-09-03 起 preload 侧同步拆为 modules/ 域目录，见 docs/app/03） |
| 运行时 `__dirname` | aiWindow（out 布局 preload/renderer 路径）、db/client 与 templateRender（`../../resources`）均依赖 out/ 产物布局，与源码树无关 |
| `electron-builder.yml` | 只耦合 `resources/` 与 `out/`，不耦合 src/main 内部 |

## 注意事项

- 已删除死代码 `utils/appBundlePath.ts`（全仓无引用；aiWindow 实际用 `join(__dirname, '../preload/index.js')`）。
- 全部移动经 `git mv` 保留历史；typecheck:node 通过。
- 历史文档中的旧路径已批量修正；`docs/migration/`、`docs/tool/10` 等属于历史记录，其中描述的文件若早已删除（如 `db/utoolsDb.ts`、`ppt/pptRenderer.ts`）以迁移文档原文为准。
