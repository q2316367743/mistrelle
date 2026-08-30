# ffmpeg 二进制随包分发

## 实现思路

ffmpeg 不再做首次使用时远程下载（GitHub 连通性差、下载易失败、终端用户不可控）。改为**构建期拉取、按平台打包**：

1. `scripts/fetch-ffmpeg.mjs` 从 npmmirror 国内镜像（ffmpeg-static b6.1.1，裸二进制无压缩）下载各平台产物到 `resources/ffmpeg/{os}-{arch}/`（gitignore 不入库），缓存于 `~/.mistrelle/cache/ffmpeg/b6.1.1/`，幂等可重跑。
2. electron-builder `extraResources` 用 `${os}-${arch}` 宏让**每个平台的安装包只带自己的 ffmpeg**，落在 asar 之外的 `process.resourcesPath/ffmpeg/`，可直接 spawn（无需 asarUnpack）。
3. 运行时 `ensureFfmpegBinary()` 同步解析内置路径并 `-version` 校验，**无任何下载逻辑**；缺失即抛错指引跑 fetch 脚本。

## 关键文件与契约

| 文件 | 角色 |
|------|------|
| `scripts/fetch-ffmpeg.mjs` | 构建期拉取脚本：`node scripts/fetch-ffmpeg.mjs [--force]`；当前平台产物自动 `-version` 校验，异平台信任镜像完整性；`FFMPEG_MIRROR` 环境变量可覆盖下载源（默认 `https://registry.npmmirror.com/-/binary/ffmpeg-static`，官方同构路径可切回 GitHub） |
| `resources/ffmpeg/{os}-{arch}/ffmpeg(.exe)` | 各平台二进制（gitignore），共 5 组：darwin-x64 / darwin-arm64 / win32-x64 / linux-x64 / linux-arm64；镜像资产名不带 `.exe` 后缀，win 落盘时重命名 |
| `electron-builder.yml` | `extraResources: from 'resources/ffmpeg/${os}-${arch}' → to ffmpeg`；`files` 另有 `'!resources/ffmpeg/**'` 排除，防止二进制再进 asar 造成双份体积 |
| `src/main/src/service/ffmpegBinary.ts` | 运行时路径解析：packaged → `process.resourcesPath/ffmpeg/`；dev → `__dirname/../../resources/ffmpeg/{os}-{arch}/`（与 `db/client.ts` 的 `../../resources` 模式一致，dev/prod 同一份相对布局） |

## 注意事项

- **打包前必须先跑 `node scripts/fetch-ffmpeg.mjs`**，否则 extraResources 源目录缺失，electron-builder 直接构建报错（天然护栏，不会产出缺二进制的坏包）。
- dev 新 clone 未跑脚本时，ffmpeg 调用（`ffmpeg_run` 工具 / 画布视频导出 / 订阅转音频）会收到「请先运行 node scripts/fetch-ffmpeg.mjs」的错误文案，走各入口既有错误路径。
- **mac universal 构建不支持**：`${arch}` 在 x64/arm64 两轮子构建中分别展开、二进制无法 lipo 合并，后一轮会覆盖前一轮；当前 mac target 未配置 universal，如需支持须改为 fat binary 或改用 arm64/x64 双包。
- dmg 安装后 `Contents/Resources` 可能只读：`ensureFfmpegBinary` 的 chmod 是尽力而为（try/catch 忽略失败），依赖 extraResources 拷贝保留的可执行位（fetch 脚本已 chmod 755）。
- 运行时下载旧方案（ffbinaries GitHub + `~/.mistrelle/extends` + meta 记录）已于 2026-08-30 整体移除；历史描述见 [migration/01](../migration/01-electron-preload-migration.md) 第五节。
