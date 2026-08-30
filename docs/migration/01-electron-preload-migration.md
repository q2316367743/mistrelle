# Electron 迁移：preload / main 进程重构

> 将原 uTools 插件（`src-utools/`，CommonJS）迁移为 Electron 应用的原生能力层。
> `window.preload.*` 形状保持不变，renderer 调用方仅做必要的异步化适配。

## 一、背景与目标

- 原 `src-utools/preload.js` 向 `window.preload` 挂 9 个模块 + axios 实例，其中 `inject.js` 是 uTools API 的薄封装
- Electron 迁移后：**特权操作进 main 进程（IPC）**，纯函数留在 preload，`window.preload` 形状不变
- **例外：`net.downloadFileFromUrl` 保留在 preload**——下载需透传 `onDownloadProgress` 回调，而 IPC（结构化克隆）无法序列化函数，故由 preload 用 axios + node:fs 直接落盘（`sandbox: false` 下 Node 能力可用）
- 已确认裁剪：db 无 `_rev` 冲突检测、无附件；删除 uTools 平台专有能力
- **浏览器工具已实现**（见 `docs/browserTool/01-browser-tool.md`）：`runBrowser(payload)` 统一入口，经 `browserTool:run` IPC 由 main 的 `BrowserToolRunner` 进程内执行（fetch / actions 判别联合）

## 二、进程职责划分

```
main 进程（特权操作）                        preload 进程（薄桥 + 纯函数）
─────────────────────────────               ─────────────────────────────────
shell / dialog / clipboard                  path（纯字符串函数，node:path）
os（getPath 走 sendSync）                    iconv / crypto / zip（纯函数封装）
display / notification                      axios.create({adapter:'http'}）
fs（11 方法，异步 invoke）                   fs / shellExec / font（IPC 薄桥）
net.downloadFileFromUrl（axios 下载 + 落盘）  inject.ts（IPC 桥接）
shellExec（cliRun/jsRun，spawn + worker）
font（系统字体枚举 + 资源库，431 行拆分 parser + index）
db（lmdb，utools 兼容层）
ffmpeg（首次下载 + 运行 + 进度）
sharp（metadata/crop/removeBackground）
```

**关键约定**：
- `sandbox: false`（模板默认）：preload 保留 Node 能力，`path`/`iconv`/`crypto`/`zip` 纯函数无需 IPC
- **`os.getPath` 是唯一 sendSync**：`renderer/src/global/Constant.ts` 在模块级同步初始化中调用（`export const dataFolder = join(os.getPath('home'), ...)`）
- **`preload.axios` 保留 `adapter: 'http'`**：绕开渲染进程 XHR 的 CORS 限制（原 uTools 环境同样依赖）
- 其余 inject 方法（dialog/clipboard/os 等）**全部异步**（`ipcRenderer.invoke`），renderer 消费方已 await 化

## 三、IPC 通道表

通道常量集中在 `src/preload/src/channels.ts`（main 与 preload 共用，含载荷类型）。按模块分组：

| 模块 | 通道 | 形态 |
|---|---|---|
| shell | `shell:openExternal/openPath/trashItem/showItemInFolder/beep` | invoke |
| dialog | `dialog:open/save` | invoke（open→`string[] \| undefined`，save→`string \| undefined`） |
| clipboard | `clipboard:copyText/copyFile/copyImage/getCopyedFiles` | invoke |
| os | `os:isDarkColors/.../getAppName` | invoke |
| os | `os:getPath` | **sendSync**（模块级初始化依赖） |
| os | `os:getFileIcon/getCursorScreenPoint` | invoke |
| display | `display:getPrimaryDisplay/.../desktopCaptureSources` | invoke |
| notification | `notification:show` | send（fire-and-forget） |
| fs | `fs:readDir/.../stat` | invoke（11 方法） |
| shellExec | `shellExec:cliRun/jsRun` | invoke |
| font | `font:listFonts/.../readFont` | invoke（getAssetsDir/getFontCachePath 留在 preload） |
| db | `db:get/put/remove/bulkDocs/allDocs` | invoke |
| ffmpeg | `ffmpeg:run`（invoke→`{id}`）+ `ffmpeg:progress`/`ffmpeg:done`（事件推送）+ `ffmpeg:kill/quit`（send） | 混合 |
| sharp | `sharp:metadata/crop/removeBackground` | invoke |
| ppt | `ppt:renderPptxToSvgs`（XML→每页 SVG）/ `ppt:exportPptx`（XML→构建 PPTX 并落盘）/ `ppt:exportPptxToPngs`（XML→指定页 PNG 并落盘） | invoke（POM 渲染与导出落盘都在 main，`src/main/src/ppt/pptRenderer.ts`；渲染进程只传 xml + 目标路径，不经手字节） |
| browserTool | `browserTool:run`（`{kind:'fetch'}` 抓取网页内容 / `{kind:'actions'}` 自动化步骤 → main `BrowserToolRunner` 直接创建隐藏窗口执行，无 runner 子进程） | invoke（载荷 `BrowserToolPayload`，返回 `BrowserToolResult`，详见 `docs/browserTool/01-browser-tool.md`） |

## 四、数据层

### db —— main + lmdb（`src/main/src/db/utoolsDb.ts`）

- 依赖 `lmdb`（`dependencies`，原生 N-API 需 externalize；`npmRebuild: false` 下预编译可用）
- 存储位置：`~/.mistrelle/db`，`{encoding:'json'}`
- 文档形态 `{_id, value}`；**无 `_rev`、无冲突检测**（put 直接覆盖，传入的 `_rev` 被忽略）
- 契约（renderer `utils/native/DbStorageUtil.ts` 依赖）：
  - `get(id)` → `{_id, value} \| null`
  - `put({_id, value})` → `{ok, id}`（put 时除 `_id`/`_rev` 外的字段原样保留）
  - `allDocs(key)`：string 前缀匹配 / string[] 精确批量
  - `remove(id)` / `bulkDocs(docs)`
- **已删除**：`postAttachment` / `getAttachment` / `getAttachmentType`（renderer 的 `UtoolsImage.vue` 同步删除）

### dbStorage —— renderer 侧 localStorage（`utils/native/KeyValueUtil.ts`）

- utools `dbStorage` 的 Electron 替代：localStorage 天然同步 + 自动持久化（默认 session 落盘 `userData/Local Storage/`），**无需 IPC / partition 配置**
- localStorage 仅存字符串 → `JSON.stringify/parse` 包装；同步形态不变（`UtoolsKvStorage`/`UtoolsDbStorage` 的 customRef 钩子零改动）

## 五、ffmpeg（`src/main/src/service/ffmpegBinary.ts` + `ipc/ffmpegIpc.ts`）

- **二进制随安装包分发**（2026-08-30 起，方案与打包细节见 [build/03-ffmpeg-bundling.md](../build/03-ffmpeg-bundling.md)）：`scripts/fetch-ffmpeg.mjs` 从 npmmirror 镜像（ffmpeg-static 6.1.1）拉取到 `resources/ffmpeg/{os}-{arch}/`，electron-builder `extraResources` 按平台注入；早期「首次使用远程下载到 `~/.mistrelle/extends`」方案已整体移除
- 运行前 `ensureFfmpegBinary()` 同步解析内置路径 + `-version` 校验，缺失时抛错提示跑 fetch 脚本
- 运行：spawn + 自动追加 `-progress pipe:2`，解析 `frame=/fps=/bitrate=/total_size=/out_time_us=/speed=/q=` 行推送进度
- 取消：`kill()`=SIGKILL；`quit()`=向 stdin 写 `q`；exit 0 resolve / 非 0 reject（stderr 尾部）
- preload 侧 `ffmpeg.run(args, onProgress)` 返回带 `kill()/quit()` 的 Promise（兼容 `InjectFfmpegPromise`，`canvasVideoExport.ts` 的取消逻辑不受影响）；run 未返回 id 时 kill/quit 先挂起、id 到达后补发（取消竞态安全）

## 六、sharp（`src/main/src/sharp/image.ts` + `ipc/sharpIpc.ts`）

- 依赖 `sharp`（`dependencies`，与原 uTools 内置同为 libvips，API 1:1）
- `metadata(input)` / `crop(input, region, output)` 直接映射；`removeBackground` 的 flood-fill 算法（`parseTargetColor` / `clampTolerance` / BFS + Uint8Array visited + Int32Array queue）从 `src-utools/src/inject.js` 完整 TS 移植
- renderer 的 `imageCrop.ts` / `imageRemoveBackground.ts` / `imageInfo.ts` 已有 `if (!sharp)` 判空，行为不变

## 七、renderer 适配清单（已完成）

1. **全异步化**：dialog（12 处）、clipboard（4 处布尔消费）、os（NativeUtil / inject/os.ts 工具 / SettingAccountPage / SettingAccountStore / GroupChatMessageList）→ await 化
2. **`fs.existsSync` 95 处 await 化**（约 27 个文件）：普通 `if` 直接加 await；特殊重构：
   - `AssetToolbar.vue` / `PlanFilesPanel.vue` 的 `uniquePath` → async（调用方 await）
   - `AssetPage.vue` 的 `reload` → `.then(async () => ...)`
   - `SubscribeService.ts` 删除同步函数 `subscribeMediaExists`（孤儿），`SubscribeDetail.vue` 的 `hasVideo/hasAudio` computed → ref（loadContent 中异步刷新）
3. **平台判断同步化**：`SettingSecured.ts` 的 `getDefaultEgoBrowserPath` 用 `navigator.platform`（computed 同步消费，os.isMacOS/isWindows 已异步）
4. **降级处理**：`inject/screen.ts` 两工具返回友好错误；`browserFetch.ts` / `browserAutomation.ts` 已启用（移除 `getPlatform() === 'utools'` 守卫），改用 `window.preload.inject.runBrowser(payload)` 统一入口（步骤解释在 main 的 `BrowserToolRunner`）
5. **类型契约**：`types/inject.d.ts` 重写（删 window/browser/input/simulate/feature/purchase/redirect/screen/ai/team + 事件钩子；全异步；`getPlatform(): 'electron' | 'ZTools' | 'utools' | 'browser'` 保留联合类型兼容历史平台分支）；`types/fs.d.ts` 的 `existsSync` → `Promise<boolean>`

## 八、工程配置

- `package.json`：`lmdb` + `sharp` 入 **dependencies**（原生模块必须外部化 + 随 app 分发；axios/adm-zip/iconv-lite 等纯 JS 库留在 devDependencies 继续走 bundle）
- `electron.vite.config.ts`：main 与 preload 增加 `externalizeDepsPlugin()`（仅外部化 dependencies）；main 增加 `~` 别名（共享 channels.ts）
- `tsconfig.node.json`：补 `baseUrl: "."`（paths 需要）
- 包管理器为 **yarn**（`yarn.lock`）；npm 会因项目原有 vite peer 冲突失败，勿用 npm install

## 九、注意事项

- **`os.getPath('cache')`**：Electron 39 已移除 `app.getPath('cache')`，`resolveOsPath` 手动推导（darwin `~/Library/Caches/<app>`，其余 `userData/Cache`）
- **`getPlatform()` 恒返回 `'electron'`**；`os.getUser()` / `os.getNativeId()` 恒返回 `null`（renderer 已有兜底）
- **改动边界**：`src-utools/` 目录保留未动（何时删除由你决定）
- 原始 `typecheck:web` 基线有 1025 个历史错误（TSX 组件类型等，与迁移无关），本次迁移未新增任何错误

## 十、文件拖拽 / 粘贴路径解析（`File.path` 移除迁移）

Electron 32+ 已移除 `File.path`。聊天输入框 `resolveFilePath` 原先首选 `File.path` 恒失败，导致「拖文件进窗口 / 粘贴复制的文件」都无响应。官方替代为 `webUtils.getPathForFile`（仅渲染 / preload 进程可调用，入参是拖入或粘贴得到的 File 对象，返回真实磁盘路径；非磁盘 File 如剪贴板截图返回空串）。

### 链路

| 环节 | 文件 | 说明 |
|------|------|------|
| 桥 | `src/preload/src/webUtils.ts` + `src/preload/index.ts` | 暴露 `window.preload.webUtils.getPathForFile(file)`（非 IPC，webUtils 只能在渲染/preload 进程调用） |
| 类型 | `src/renderer/src/types/webUtils.d.ts` + `vite-env.d.ts` | `Window.preload.webUtils: WebUtilsApi` |
| 消费 | `LChatSender.vue` `resolveFilePath` | 优先 `getPathForFile`；未命中再走 sandbox `tmp/` 字节拷贝兜底（`existsSync + mkdir` 保证目录存在） |
| 粘贴兜底 | `LChatSender.vue` `handlePaste` | 复制文件后粘贴，部分平台 `clipboardData` 不带文件条目，末尾纯文本分支改为异步先读 `inject.clipboard.getCopyedFiles()`，命中则逐个插入文件引用，否则回退纯文本 |
| 导航防护 | `src/main/index.ts` `createWindow` | `webContents.on('will-navigate')` 只放行应用自身地址（dev 同源保 HMR、prod 允许 index.html），其余 `preventDefault`，防止文件拖到非输入区导航到 `file://` 劫持窗口 |

### 注意

- `webUtils` 参数类型在 preload 用 `Parameters<typeof webUtils.getPathForFile>[0]`：preload tsconfig 无 DOM lib，直接写全局 `File` 会报未定义，也不为此引入 DOM lib 扩大全局作用域
- 拖入 / 粘贴磁盘文件的场景在 `ProjectFooterPanel` / `PageNew` 这两个不传 `sandboxDir` 的调用点同样恢复正常（getPathForFile 直接给出路径）；剪贴板截图（无磁盘路径、无 sandbox）在这些调用点仍返回 null，属既有行为
- `NoteEditor` / `ArticleEditor` 走 `file.arrayBuffer()` 落盘，不依赖 `File.path`，无需迁移
