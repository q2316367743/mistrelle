# preload 目录结构（域优先）

> 2026-09-03 拆分落地，与 [main 域优先重构](./02-main-directory.md) 同构。此前 `src/preload/src/ipc/` 18 个文件混装两类东西：**契约**（`*Channels.ts`，被 main 侧 32 处跨包引用的通道常量/类型）与**桥**（IPC 薄封装）；其中 `channels.ts` 486 行是 9 个域的大杂烩（贴 500 行红线），`inject.ts` 261 行混装 platform 六桥 + sharp/ffmpeg/browserTool 三桥。

## 目录总览

```
src/preload/
├── index.ts                 # 组装 window.preload（18 模块 + axios Node http 适配器实例）
└── src/
    ├── inject.ts            # injectApi 组装点（纯组装 ~20 行，对称 main 的 registerIpc.ts）
    ├── modules/             # 域 = 契约（<域>Channels.ts）+ 桥（<域>.ts）同域同居
    │   ├── auth/            # authChannels.ts + auth.ts
    │   ├── relay/           # relayChannels.ts + relay.ts
    │   ├── db/              # dbChannels.ts + db.ts
    │   ├── image/           # imageChannels.ts + image.ts（跨域类型引 ../db/dbChannels）
    │   ├── template/        # templateChannels.ts + template.ts
    │   ├── ai-stream/       # aiStream.ts（axios 直连 AI 流式，无 IPC 无契约，SSE 分帧归一在渲染层 modules/ai）
    │   ├── font/            # fontChannels.ts + font.ts（getAssetsDir/getFontCachePath 纯路径常量留 preload）
    │   ├── sharp/           # sharpChannels.ts + sharp.ts
    │   ├── browser/         # browserChannels.ts + browser.ts（runBrowser）
    │   ├── shell/           # shellExecChannels.ts + shellExec.ts
    │   └── platform/        # Electron/OS 能力域（与 main platform 域对称）：
    │                        #   platformChannels.ts（shell/dialog/clipboard/os/display/notification 六组）
    │                        #   + platform.ts（六桥）+ fsChannels.ts + fs.ts
    │                        #   + safeStorageChannels.ts + safeStorage.ts
    └── lib/                 # 纯 Node 能力桥（非 IPC 域）：path/net/iconv/crypto/zip/webUtils
```

原 `channels.ts` 按域拆解后删除；原 `inject.ts` 拆为 platform/sharp/ffmpeg/browser 四桥后仅剩组装。

## 约定

- **契约与桥同域同居**：`<域>Channels.ts`（通道常量 + 载荷/结果类型）与 `<域>.ts`（`ipcRenderer.invoke` 薄封装）放同一目录；域划分与 `src/main/src/modules/` 一一对应。
- **window.preload 形状不变**：`inject.shell / inject.sharp / relay.chatStream` 等嵌套结构保持原样，renderer 侧 `types/*.d.ts` 手工镜像契约未动、无需改动。
- **新增域**：建 `modules/<域>/` 放契约 + 桥；契约被 main handler 经 `~` 别名引用（如 `~/modules/db/dbChannels`）；若域暴露在 `window.preload` 顶层，在 index.ts 挂载，若挂在 `inject.*` 下则在 `src/inject.ts` 组装。
- **lib/** 只收纯 Node 能力桥（crypto/zip/net 等），不新增 IPC 域。

## 与 main 的契约引用关系

main 侧 handler/服务经 `~` 别名引 preload 域契约（`~/modules/<域>/<域>Channels`，共 30+ 处），方向为 main → preload 单向；renderer 不 import preload 源码，类型在 `src/renderer/src/types/*.d.ts` 手工镜像（第三份契约，改通道时三处同步：契约文件 / preload 桥 / renderer d.ts，见记忆「fs 桥四处同步」）。

## 注意事项

- 全部移动经 `git mv` / 拆分保留内容原样；typecheck:node 通过。
- `imageChannels.ts` 引用 `../db/dbChannels` 的表形状类型（`ImageRecordInput` 等），image 桥同理——image 域对 db 域存在类型级依赖，属预期。
- 历史文档中 `src/preload/src/channels.ts` / `src/preload/src/ipc/*` 旧路径已批量修正；`docs/migration/` 等历史记录以原文为准。
