# 01 项目笔记模块

> 项目详情页「笔记」：笔记是项目的一个模块，数据根目录为 `~/.mistrelle/project/{projectId}/notes`（见 entity/project 目录结构注释），Obsidian 风格附件规范，tiptap 所见即所得编辑，侧栏文件树 + 右键菜单操作。

## 目录结构与附件规范

```
~/.mistrelle/project/{projectId}/notes/   # 项目笔记库根（buildProjectNoteDirPath）
├── a.md                        # 根目录笔记
├── a.assets/                   # 附件目录（与 a.md 同名同级，粘贴/拖入/选择图片落盘于此）
└── drafts/                     # 文件夹（可任意嵌套）
    ├── idea.md
    └── idea.assets/
```

- 正文内图片一律使用**相对路径**引用：`a.assets/xxx.png`（相对 md 所在目录），保证可移植。
- 移动 / 复制笔记时附件目录一并移动，相对引用天然有效；**仅重命名（basename 变化）**需要同步重命名 `.assets` 目录并改写正文内引用。无双链功能，不更新其他笔记。
- 笔记彻底并入项目：独立笔记模块（`~/.mistrelle/note`）与 `/inspiration/note` 页面已删除。

## 数据模型（NoteTypes.ts）

```ts
interface NoteNode {
  type: 'note' | 'folder'
  name: string      // 名称（note 不含 .md）
  key: string       // 相对笔记库根路径，全局唯一标识（如 drafts/idea、drafts）
  parentKey: string // 父目录相对根路径（根为 ''）
  path: string      // 绝对路径
  size: number
  mtime: number
  children?: NoteNode[]   // 仅 folder
}
```

## NoteService 契约（src/modules/note/NoteService.ts）

全部走 `window.preload.fs`，是笔记文件操作的唯一入口。**路径相关函数以笔记库根（root）为首参**，root 由 `noteRootPath(projectId)` 获得：

| 函数 | 说明 |
|---|---|
| `noteRootPath(projectId)` | 项目笔记库根：`~/.mistrelle/project/{id}/notes` |
| `noteKeyToAbs(root, key)` / `noteKeyDirAbs` / `noteAssetsDirAbs` | key → md / md 目录 / `{name}.assets` 绝对路径 |
| `folderRelToAbs(root, rel)` | 文件夹相对路径 → 绝对路径（`''` 为根） |
| `normalizeNoteName` / `validateNoteName(name, conflicts)` | 名称规范化与校验（非法字符 / 以 . 开头 / 重名） |
| `listSiblingNames(root, parentRel)` | 父目录内展示名集合（跳过隐藏项与 `.assets` 目录），用于冲突校验 |
| `readNoteTree(root)` | 递归构建树（文件夹在前、名称排序） |
| `createNote(root, name, parentRel)` / `createFolder(root, name, parentRel)` | 新建 |
| `readNote(root, key)` / `writeNote(root, key, content)` | 读 / 写正文 |
| `renameNote(root, key, newName)` | 重命名笔记 + 附件目录 + 改写正文引用（见下） |
| `renameFolder(root, rel, newName)` | 重命名文件夹（内部相对引用不受影响） |
| `deleteNote(root, key)` / `deleteFolder(root, rel)` | 删除（附件目录 / 文件夹递归） |
| `resolveNoteImage(baseDir, src)` | 相对路径 resolve 后经 `pathToHref` 转 file://，供编辑器渲染 |
| `noteAssetRel(noteName, file)` | `{name}.assets/{file}` 相对引用构造 |
| `saveNoteImage(root, noteKey, {file?/sourcePath?})` | 图片写入 `{name}.assets/{ts}_{file}`，返回相对引用 |

**重命名流程**（调用方需先 flush 该笔记未保存内容）：

1. `rename(old.md → new.md)`（与同级条目校验重名）
2. 若 `old.assets` 存在 → `rename(old.assets → new.assets)`
3. 改写正文内 `{old}.assets/` → `{new}.assets/` 后写回

**引用改写正则**（带边界防护，避免误伤 `a2.assets`）：

```ts
const refRe = new RegExp(`(^|[^\\w-])${escapeRegExp(oldBase)}.assets/`, 'g')
md.replace(refRe, `$1${newBase}.assets/`)
```

**路径基建**（src/modules/project/service/ProjectService.ts）：

- `buildProjectNoteDirPath(id)` → `join(buildProjectDirPath(id), 'notes')`
- `projectCreateSkeleton` 创建 `files / chat / tasks / notes` 与 `dynamics.json`

## 页面结构（src/pages/project/note/）

```
NotePage.vue            # 子页面（props.id 来自 detail 的 <router-view :id>），侧栏文件树 + 右侧 tab 页 + 编辑器
useNotePage.ts          # 状态编排：tree / tabs / activeKey + 防抖保存 + 项目切换重置
components/
├── NoteSidebar.vue     # 文件树容器：展开状态、内联新建状态、根空白右键菜单
├── NoteTreeNode.vue    # 递归树节点：文件夹展开/折叠、笔记打开、节点右键菜单
├── NoteCreateInput.vue # 内联新建输入（回车确认 / Esc / 失焦取消）
├── noteContextmenu.tsx # 右键菜单构建（useContextMenu 封装）
├── NoteEditor.vue      # tiptap 编辑器（StarterKit + Markdown + NoteImage + NoteSlash + TableKit）
├── NoteImage.ts        # 图片节点：相对路径 → pathToHref 渲染（源真相保持相对路径）
└── NoteSlash.ts        # / 斜杠命令（@tiptap/suggestion + 通用 suggestion 渲染器）
modals/
├── NoteRenameDialog.tsx    # DialogPlugin 外壳 → openNoteRenameDialog（支持 kind: note/folder）
└── NoteRenameContent.vue   # 重命名表单（仅校验收集，实际重命名由页面处理）
```

### 侧栏文件树交互

- **左键笔记**：打开 tab（已开则激活）。
- **左键文件夹**：展开 / 折叠。
- **右键空白区**：新增笔记 / 新增文件夹（根目录）。
- **右键文件夹**：新增笔记 / 新增文件夹（该文件夹内，自动展开）+ 重命名 / 删除。
- **右键笔记**：重命名 / 删除。
- **内联新建**：菜单触发后在该层级显示输入框，回车确认、Esc / 失焦取消；新建笔记成功后直接打开。
- 重命名 / 删除走 `NoteRenameDialog`（命令式弹窗）与 `MessageBoxUtil.confirm`。

## 关键实现点

- **项目切换重置**：路由复用组件实例，`useNotePage(projectId)` watch `root` 变化，先用**旧 root** 落盘全部脏 tab，再清空 tabs/activeKey 并重载新项目树，避免跨项目串数据。
- **tab 标识**：`NoteTab.key` 为笔记相对库根路径（如 `drafts/idea`），重命名笔记 / 文件夹时同步改写已打开 tab 的 key（文件夹重命名按前缀替换），活动 tab 高亮同步。
- **自动保存**：编辑器 `change` → 800ms 防抖落盘（定时器闭包捕获当时的 root）；关闭 / 重命名 / 删除 / 项目切换 / 卸载前先 flush。
- **编辑器重挂载**：`NotePage.vue` 用 `:key="activeTab.key"`，切换 tab / 重命名后重建 editor；初始内容来自 tab 内存快照。
- **图片落盘**：粘贴 / 拖入走 `saveNoteImage(root, noteKey, { file })`，斜杠「图片」命令走 `dialog.open` + `saveNoteImage(root, noteKey, { sourcePath })`，插入节点 `![alt]({name}.assets/xxx.png)`。
- **右键菜单**：统一走 `@/hooks/UseContextMenu`（内含 preventDefault + stopPropagation，节点菜单不会冒泡到根菜单）。
- **弹窗约定**：重命名按 AGENTS 规范拆 `.tsx` 外壳 + `.vue` 内容，`footer: false`，`destroyOnClose: true`。

## 接入点

- 路由：`/project/:id` children 新增 `{ name: '项目-笔记', path: 'note' }`。
- 项目详情 `detail/index.vue`：tabs 新增「笔记」，`showFooter` 排除「项目-笔记」。
- AppSide 菜单：灵感组仅保留「碎碎念」，「笔记」入口已删除。
- 独立笔记模块与 `getAppData2Note` 常量已删除。

## 注意事项

- 名称即文件名，大小写敏感，不允许 `/ \ : * ? " < > |` 与 `.` 开头；同名冲突按「父目录同级条目」判定（`.assets` 附件目录不占名）。
- 编辑器保存的是 `editor.getMarkdown()` 全文，脏标记保证不丢失；写入失败恢复脏标记。
