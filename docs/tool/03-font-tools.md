# 字体工具（font_list / font_register）与字体渲染

> 画布文字指定字体的完整链路：本机可用字体查询 → 指定 fontFamily → 渲染前确保字体就绪。
> 设计类对话（design chat）注入 font_list / font_register 两个工具。
>
> 关键文件：
> - 工具工厂 `src/modules/tool/components/design/index.ts`
> - 字体工具 `src/modules/tool/components/design/fontTools.ts`
> - 渲染层字体注册器 `src/modules/tool/components/canvas/fontRegistry.ts`
> - preload 字体模块 `src-utools/src/font.js`（Node 环境，系统字体扫描 / 资源库管理）
> - preload 挂载 `src-utools/preload.js`（`window.preload.font`）
> - 类型声明 `src/types/font.d.ts` + `src/vite-env.d.ts`
> - 资源管理页 `src/pages/setting/assets/SettingAssetPage.vue`（路由 `/setting/assets`）
> - 渲染接入点 `canvasRender.ts`（exportCanvasPng）/ `CanvasRenderer.vue`（预览）

---

## 1. 背景与设计

画布文字渲染跑在 **uTools 的 Chromium 渲染进程**（Leafer 走 canvas 2D），`canvas_batch_edit` 的
`fontFamily` 字段早已支持。真正的缺口是：**模型不知道本机有哪些字体**，只能臆想（如 "Outfit"）
导致回退默认字体。本功能补齐「查询 → 指定 → 就绪」闭环。

**统一契约**：任何字体都以 `{ name, path, source }` 输出，`source` 枚举：

| source | 含义 | 渲染方式 |
|---|---|---|
| `system` | 系统已安装字体 | Chromium 原生（最精确、零加载） |
| `library` | 资源库字体（用户入库） | 渲染层 `new FontFace(name, buffer)` |
| `online` | 在线字体（**预留**，此版不实现） | 同 library |

对外体验完全一致：模型拿到 `name` 填 `fontFamily` 即可，`ensureFontsForDoc` 内部自适应分流。

## 2. 资源库与索引（~/.mistrelle/assets）

```
~/.mistrelle/assets/
├── index.json        # 索引：{ version, updatedAt, fonts: [{ name, path, source, addedAt }] }
└── fonts/            # 字体文件（ttf/otf/woff/woff2/ttc/otc），path 相对 assets/
```

- **启动零解析**：读 `index.json` → `readDir(fonts/)` 拿全部文件名 → 存在性校验剔除失效条目，
  不再逐个解析字体文件，极大简化效率。
- **入库**（font_register / 资源管理页「添加字体」共用 `addFont`）：解析 name 表拿族名（仅此一次）→
  拷贝到 `fonts/` → 写回 `index.json` → 之后 `font_list` 永久包含。
- **同名覆盖**：入库时按 `name` 覆盖旧条目与旧文件。
- 字体库目录跨聊天共享（与聊天索引同级），未来在线字体下载也落 `fonts/` 并标记 `source: 'online'`。

## 3. 系统字体缓存（~/.mistrelle/font-cache.json）

- 结构：`{ version, updatedAt, fonts: [{ name, path }] }`，由 preload 自动生成。
- **每次启动后台刷新**（fire-and-forget，模块加载即触发）：全量扫描系统字体目录 → 解析 name 表 →
  写回缓存。刷新期间可并发等待同一 promise，不阻塞。
- **读取**：有缓存立即返回（二次启动零等待）；无缓存（首次）等待一次全量扫描。
- 系统字体目录：macOS `/System/Library/Fonts`、`/Library/Fonts`、`~/Library/Fonts`；
  Windows `%WINDIR%\Fonts`；Linux `/usr/share/fonts` 等。扩展名白名单
  `ttf/otf/ttc/otc/woff/woff2`。

## 4. name 表解析（TTF/OTF/TTC）

- 用 `node:fs` `open`+`read` **按需精准读取**（读头判断 `ttcf`/sfnt/`wOFF` → 定位 name 表 offset/length），
  不全量读大 ttc 文件。
- **TTC 注意**：table directory 里的 offset 是**相对文件开头的绝对偏移**（不叠加子字体 sfntOffset）。
- 族名取 `nameID=1`（家族）优先 `nameID=16`（排版家族）；编码优先
  `platformID=3 + encodingID=1`（Windows Unicode UTF-16BE），回落 Unicode / Macintosh（iconv-lite 解码）。
- WOFF/WOFF2 内部结构不同，直接返回 null（入库时回退文件名作为 name）。

## 5. 工具契约

### `font_list`（查询可用字体，只读）

| 项 | 值 |
|---|---|
| 参数 | `query?`（字体名子串过滤）、`source?`（system/library）、`limit?`（默认 100，max 500）、`offset?`（分页） |
| 返回 | `{ total, returned, offset, fonts: [{ name, path, source }], note? }` |
| 风险 | safe，注册自动放行 |

- 合并系统字体（缓存）+ 资源库（索引），**资源库同名覆盖系统**，按 `localeCompare(name, 'zh')` 排序。
- 默认裁剪 + 支持过滤，避免超 `MAX_TOOL_RESULT_BYTES(32KB)`。

### `font_register`（注册字体文件入库）

| 项 | 值 |
|---|---|
| 参数 | `path`：字体文件绝对路径（ttf/otf/woff/woff2/ttc/otc） |
| 返回 | `{ success, name, path, source: "library", note }` |
| 风险 | sensitive；策略：源路径在沙盒 / 工作区 / 用户目录 → allow，其余 ask |

- 底层 `addFont`：校验扩展名 → 解析族名（失败回退文件名）→ 拷贝 → 写索引。
- 之后 `font_list` 自动包含该字体。

## 6. 渲染层注册（fontRegistry.ts）

- `collectFontFamilies(doc)`：递归收集画布全部 text 节点的 `fontFamily`（去重）。
- `ensureFontsForDoc(doc)`：`font.listFonts()` 建立 name → {source, path} 映射 → 对非 system 来源
  `readFont(path)` → `new FontFace(name, buffer)` → `await load()` → `document.fonts.add()`。
- **懒加载**：只加载画布实际用到的字体族（设计一般 2~3 个），已注册集合去重避免重复。
- 接入点：`exportCanvasPng` 导出前、`CanvasRenderer.render()` 预览前 `await ensureFontsForDoc(doc)`，
  保证预览 / `ctx.measureText`（canvasLayout.ts）与导出 PNG 用同一已加载字体源。
- `document.fonts` 不可用时静默降级为默认字体，不阻塞渲染导出。

## 7. 资源管理页（/setting/assets）

- `page-layout` + `t-tabs`：「字体」tab 用 `t-table` 展示全部字体（name / 来源 tag / path / 删除），
  支持添加（`inject.dialog.open` 多选字体文件）、删除、打开目录、刷新；「插图素材」tab 为占位（预留）。
- 侧边栏入口：`AppSide.vue` `settingOptions` 新增「资源管理」（`FolderFilledIcon`）。
- 路由：`src/plugin/router.ts` `/setting/assets`；枚举：`LocalNameEnum.SETTING_ASSETS`。

## 8. 注意事项

- 画布文件只存 `fontFamily` 字符串。系统字体重启后仍可用（Chromium 原生）；**资源库字体重启后需重新注册**
  （FontFace 是内存态）——模型 / 用户可在需要时再调 `font_register`，文档已说明。
- `ttc` 仅系统字体走原生；资源库 FontFace 加载 ttc 可能失败，建议入库 ttf/otf/woff/woff2。
- name 表解析对损坏文件返回 null，绝不抛出中断扫描。
- `font.js` 为 preload Node 环境（CommonJS），不套用前端 TS 行数红线，但保持清晰结构。
- 新增字体源只需扩展 `source` 枚举 + 在 `listFonts` 合并逻辑追加，`online` 已预留。
