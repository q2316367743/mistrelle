# AIHOT 功能整体移除（2026-09-05）

> 应用户要求整体移除 AIHOT 资讯功能：页面、AI 工具、API 客户端、本地镜像服务、DB 表全链路删净。

## 移除范围

### 整体删除

| 位置 | 内容 |
|------|------|
| `src/renderer/src/windows/main/pages/extend/aihot/` | 页面 13 文件（四页签视图 / 时间轴 / 事件抽屉 / 日报 / 已读标记） |
| `src/renderer/src/windows/main/modules/api/aihot/` | API 客户端 10 文件（types + 8 端点，baseURL aihot.virxact.com） |
| `src/renderer/src/windows/main/modules/aihot/` | AihotSelectedService（snapshot/changes 增量镜像）+ AihotRequestError |
| `src/renderer/src/windows/main/modules/tool/components/aihot/` | 4 个 AI 工具（aihot_selected / aihot_items / aihot_hot_topics / aihot_daily） |
| `src/main/src/db/schema/aihot.ts`、`db/repo/aihotRepo.ts` | aihot_item / aihot_meta 表定义 + DAO |
| `docs/tool/09-aihot-tools.md`、`docs/attachment/01-aihot-page.md` | 专属文档 |

### 共享文件局部修改

- `router.ts`：删 `/attachment/aihot` 路由；`AppSide.vue`：删「AI HOT」菜单项（含仅此使用的 `ComponentRadioIcon` import）
- `modules/tool/index.ts`：删 aihot 分组（toolGroups / toolMap / import 三处；toolRegistry / toolOptions 自动派生）
- `collectionLoader.ts`：`load_tool_collection` 参数描述示例去掉 ` / aihot`
- DB 桥四文件：`dbChannels.ts`（5 通道 + 7 类型）、`dbIpc.ts`（5 handler + 导入）、preload `db.ts`（aihot 节点）、渲染层 `types/db.d.ts`（7 类型 + DbApi.aihot）
- `aiWindow.ts`：webviewTag / did-attach-webview **保留**（LinkPreviewDrawer 仍被 FilePreviewDialog 使用），仅注释去 aihot 化

### 数据库

- 迁移 `resources/drizzle/0010_shocking_molten_man.sql`：`DROP TABLE aihot_item / aihot_meta`（用户拍板删表；
  内容只是可重新拉取的资讯缓存镜像）。历史迁移 0000/0002（建表、加 read 列）为既成事实不改写。

## 保留项与明确不处理

- `LinkPreviewDrawer` 公共组件与 webview 能力：保留，见 `docs/attachment/02-embedded-link-viewer.md`
- 存量聊天配置中残留的 `aihot` 集合白名单 id：加载已删集合仅返回「未找到」提示，无害，不做存量数据清理
- `SKILL_TOOL_NAMES`、`getCacheDir`、`JsonFileUtil` 等与 aihot 无关联，不动

## 关联文档更新

- `docs/data/01-sqlite-storage.md`：去 aihot 示例化，改为通用存储层文档
- `docs/attachment/02-aihot-embedded-link-viewer.md` → 改名 `02-embedded-link-viewer.md`（组件仍在用）
- `docs/README.md` 索引同步；`docs/app/AppSide.md`、`docs/app/02-main-directory.md`、`docs/tool/11` 清理 aihot 字样
