# 03 依赖归属：dependencies vs devDependencies

> 2026-09-07 落地。背景：优化 electron-builder 产物体积，把误入 `dependencies` 的渲染层专用 / 零引用包挪出。
> 更早的同类约定见 `docs/migration/01-electron-preload-migration.md:106`（原生模块入 dependencies、纯 JS 库走 bundle）。

## 判定机制（为什么会浪费体积）

- `electron.vite.config.ts`：main / preload 均挂 `externalizeDepsPlugin()`，该插件**只外部化 `dependencies` 里的包**（运行时不打包、直接 `require` app 内 node_modules）；`devDependencies` 里的包会被 rollup 打进 `out/main`、`out/preload` 产物。
- renderer 端**没有** externalize 插件，所有依赖一律由 vite 打包 / 拆 chunk 进 `out/renderer`。
- electron-builder 默认把 `dependencies` 的整个 node_modules 塞进 asar（`npmRebuild: false`，原生模块靠 postinstall `electron-builder install-app-deps` 按 Electron ABI 重编）。
- 因此：**仅渲染层使用（或完全未引用）的包若放 `dependencies`，代码会被打进 renderer 产物一份、又被复制进 asar node_modules 一份 = 双重浪费。**

## 归属判定规则

| 归属 | 适用场景 | 后果 |
|------|----------|------|
| `dependencies` | 原生模块（better-sqlite3 / serialport / sharp，必须 external + 随包分发，sharp 还有显式 asarUnpack）；确需运行时 external 的 main 运行库（express / drizzle-orm / electron-updater 等） | main/preload 以 `require()` 形式外部化 |
| `devDependencies` | 渲染层专用库（renderer 一定会打包它们）；纯 JS 且确认可被 rollup 内联的 main/preload 库（改走 bundle 需跑一次 build + 启动验证） | 不随包分发，构建期打进产物 |
| 删除 | 全仓库零引用（搜不到 import / require）的死依赖 | 彻底移除，勿挪 devDeps 留尸 |

判定前先用 grep 摸清引用方属于哪个端：`src/main/src`（main）、`src/preload`（preload）、`src/renderer/src`（renderer）、`src/common`（共享）。`import type` / 纯注释提及不算运行时引用。

## 本次迁移清单（2026-09-07，保守范围）

| 包 | 迁移前 | 迁移后 | 依据 |
|----|--------|--------|------|
| `marked` | dependencies | devDependencies | 仅 `src/renderer/src/components/card/note-markdown.ts` 静态 import |
| `@zumer/snapdom` | dependencies | devDependencies | 仅 renderer 动态 `import()`（NoteCardRenderer.vue / designHtmlRender.ts） |
| `jszip` | dependencies | devDependencies | 仅 renderer 动态 `import()`（extend/card/index.vue） |
| `lucide-vue-next` | dependencies | **删除** | src 全量零引用（工具面板实际用 Iconify 聚合图标集，非本 npm 包） |
| `electron-updater` | dependencies | **保留不动** | src 零引用，但 dev-app-update.yml + electron-builder `publish` 已预留自动更新，暂不擅动 |

main/preload 纯 JS 运行库（axios / adm-zip / iconv-lite / turndown / ejs 等）本次**未动**，仍走 external；若想进一步压缩可参照 `docs/migration/01:106` 改走 bundle，但需另行 build 验证。

## 注意事项

- yarn classic v1 的 lockfile **不记录** prod/dev 分类，仅改 package.json 后跑一次 `yarn install` 即可（顺带修剪被删包的残留解析）。
- 包管理器必须是 yarn（勿用 npm install，vite peer 冲突）。
- 渲染层动态 import（jszip / snapdom）不受归属影响：vite 构建期照常产出动态 chunk，运行时不依赖 node_modules 里的该包。
