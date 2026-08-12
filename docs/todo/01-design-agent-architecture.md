# 01 海报设计 Agent 插件 · 技术架构方案

> 状态：方案定稿（待实施）
> 适用范围：mistrelle 从「通用 agent」收敛到「海报设计方向」的整体架构
> 关联文档：`canvas/02-canvas-node-model.md`、`subagent/01-subagent-module.md`、`chat/03-canvas-node-reference.md`、
> `tool/02-asset-tools.md`

---

## 1. 背景与方向

项目原为通用 agent，现明确方向： **面向海报设计的 agent**。核心资产已经具备：

- `design` 聊天类型 + Leafer 画布，AI 主动绘制设计稿；
- 完整 canvas 节点模型（`schema 2` JSON）、布局引擎、批量编辑、渲染器、动画导出；
- 内置 design skill（反 AI 俗套铁律、区域分组铁律、调色板 token、几何核对）；
- 子 Agent design 型、画布节点引用（双击节点 → 注入聊天）、素材工具链（`website_logo` / `icon_svg` / `image_*` / `font_*`）。

转型目标： **在保留通用聊天能力的基础上，新增「项目制海报设计」形态**。现有 `design` 聊天类型（AI 主动设计海报）继续保留，新增以「设计图」为核心的工作流。

---

## 2. 核心原则：双形态并存，底层不分叉

### 2.1 两种产品形态

| 形态                         | 布局                                  | 画布归属         | 适用场景                                          |
|------------------------------|---------------------------------------|------------------|---------------------------------------------------|
| **A · 聊天驱动（现有保留）** | 左聊天 / 右画布                       | 聊天持有画布引用 | 「我先有个想法，聊着聊着画出一张图」的零散创作    |
| **B · 项目驱动（新增）**     | 项目 → 页面 → 设计图，左画布 / 右聊天 | 页面持有设计图   | 系统性海报生产：套模板、AI 替换内容、系列统一风格 |

两种形态 **并存**，各自独立入口，都生产 `.canvas` 文件。

### 2.2 共享底层（不分叉）

两套形态共用同一套能力，区别仅在「谁持有画布引用、谁在左谁在右」：

- `.canvas` 数据模型（`schema 2`，`CanvasDoc`）；
- `canvas_*` 工具链（`canvas_create/open/batch_edit/get_nodes/inspect/set_palette/...`）；
- agent（主对话 + 子 Agent design 型）+ design guideline / `canvasPrompt`；
- 模板机制（占位节点）；
- 素材工具链。

> 结论：新增工作量集中在 B 形态的「项目 / 页面 / 设计图编排层 + 左画布右聊天布局」，画布引擎与 agent 工具链零新造。

---

## 3. 信息架构与数据模型

### 3.1 三层实体

```ts
interface DesignProject {
  id: string
  name: string
  pages: string[]          // DesignPage.id 列表
  createdAt: number
}

interface DesignPage {
  id: string
  projectId: string
  name: string
  designIds: string[]      // DesignFile.id 列表（左下设计图列表）
  chatId: string           // 绑定一条 design 类型会话（页面级）
}

interface DesignFile {
  id: string
  pageId: string
  name: string
  canvasPath: string       // 落盘路径，见 3.2
}
```

术语约定： **Project（项目）→ Page（页面，用户口中的"分组"）→ Design（设计图 = 一个 `.canvas` 文件）**。

### 3.2 落盘结构

```
~/.mistrelle/design/
└── {projectId}/
    ├── project.json              # DesignProject 索引
    └── {pageId}/
        ├── page.json             # DesignPage（含 designIds / chatId）
        ├── {designId}.canvas     # CanvasDoc（schema 2）
        └── {designId}.canvas
```

相比现有「画布挂在对话沙盒 `outputs/canvas-{version}.canvas`」，B 形态将画布归属从对话沙盒迁移到 `design/` 目录，按
`designId` 命名， **设计图不再依赖某个对话存在**。

### 3.3 聊天绑定（页面级）

`chatId` 挂在 **Page** 上（一个页面一条 design 会话），而非每个
DesignFile。理由：页面是「同系列同风格」的自然聚合单位，页面级对话能承载「这套统一用珊瑚橙 + 夏日风」这类系列意图，避免每张图重复说。

### 3.4 切图重定向机制（页面绑定的关键一环）

左下切换设计图时， **右侧聊天上下文不变**，仅把 agent 的操作画布重定向到新图：

```
切换设计图 → 更新 Page 对话的「当前 designId」 → canvas_open(新 designId)
```

agent 始终 `canvas_open(当前选中的设计图)`，所以单图微调也精准；这是页面绑定相比设计图绑定多做的唯一一步。

---

## 4. 形态 B 页面布局

参考 ardot / figma 的左侧大纲式导航：

```
┌────────────┬────────────────────────┬──────────────┐
│ 页面（左上） │                        │              │
│  页面A ✓    │     画布（中部）        │   协作聊天    │
│  页面B      │   当前打开的设计图      │  （绑定页面） │
│ ────────── │                        │              │
│ 设计图（左下）│                      │              │
│  图1 ✓      │                        │              │
│  图2        │                        │              │
│  图3        │                        │              │
└────────────┴────────────────────────┴──────────────┘
```

- **左上 PageList**：切换页面；
- **左下 DesignList**：当前页面的设计图列表（新建 / 切换）；
- **中部画布**：打开的设计图（`CanvasRenderer` + 元素树，复用 `DesignAside` 内容抽出的主区组件）；
- **右侧 `LChatEngine`**：`chatType='design'`，`sessionId = Page.chatId`。

---

## 5. 编辑能力分层（关键难点拆解）

### 5.1 model / view 分离（现状已支持）

- `CanvasStore` = model（`nodes` + `palette`），`CanvasRenderer`（Leafer）= view；
- 单一事实源；后续补充 **防抖自动保存**（model 变更 → 落盘 `.canvas`）+ **统一撤销栈**（手动与 AI 变更同源入栈）。

### 5.2 难点

AI 生成的节点优先使用 **声明式自动布局**（`group` + `layout` + palette token，子节点不写 x/y 交给引擎算）。若要求「AI
能做的手动也能做」且 **完全对等**，手动编辑器需做到 figma 级自动布局编辑——无底洞。

### 5.3 重新定义目标

> 不是「手动 UI 功能对等 AI」，而是「任何变更都落到同一个 model，且人类可用『基础手动 + 自然语言 AI』两种入口达成等效结果」。

### 5.4 能力分层

| 层             | 入口                | 能力范围                                                                                                                                 |
|----------------|---------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| **基础编辑层** | 人类手动 + AI 均可  | 移动 / 缩放 / 改文本 / 改颜色 / 换图片 / 删除 / 调图层顺序（model 基础字段）                                                             |
| **轻量分组**   | 人类手动（第一版）  | 成组 / 解组；layout 方向（无 / 横 / 纵）；group gap 间距                                                                                 |
| **结构编辑层** | 主要 AI（自然语言） | padding 四元素；对齐枚举（主轴/交叉轴）；`fill_container` / `hug_contents`；`ABSOLUTE` 锚点 / `wrap`；palette token；批量生成 / 几何核对 |

### 5.5 复杂度命门（必须卡死）

**layout 组内的子元素不开放「自由拖位置」**。否则会出现 figma 那套状态机爆炸（拖出流 / 改约束 / 混合自由与自动定位）。简化规则：

- layout 组内子元素位置交给引擎算；
- 人类可做的：改内容 / 字号 / 尺寸（尺寸变化触发引擎重排，布局自动适应）、把元素拖出组（= 解组后恢复自由）、整体移动整个 group；
- 想要「组内元素间距 / 对齐」调整 → 调 group 的 gap，或对右侧聊天说一句（AI 设对齐枚举）。

### 5.6 互通保证

手动成组产出的 `group` 节点，与 AI 用 `canvas_batch_edit` 创建的 `group` **完全同构**（同一 `CanvasNode(type:'group')` +
`layout` 字段）。因此 AI 能继续在手动组上加元素 / 改布局，人类也能在 AI 建的组上手动切方向——单一 model 闭环。

### 5.7 实现落点

在 `CanvasStore` 增加：

- `group(ids)`：创建 group 节点，子节点 `parent` 指向它（复用 `batchEdit` 的 TypeBox 校验与落盘）；
- `ungroup(groupId)`：删除 group，子节点提升回原父（顶层或上层 group），保留各自 x/y；
- `setLayout(groupId, layout, gap)`：改组的 `layout` / `gap`。

---

## 6. 模板系统

- **模板 = 带占位节点的 `.canvas`**（用 `placeholderLabel` 或约定命名如 `__ph_title`）；
- **套模板** = 复制模板 → 新建 `DesignFile`；
- **AI 替换内容** = 在绑定该页面的对话里，`canvas_get_nodes` 找到占位节点 → `canvas_batch_edit` 替换文本 / 图片（复用现有
  placeholder 能力，零新引擎）。

典型闭环：「我有个模板，套用后让 AI 替换内容」。

---

## 7. 复用清单（印证底层不分叉）

| 现有资产                                            | 用途                                        |
|-----------------------------------------------------|---------------------------------------------|
| `.canvas` schema 2 模型                             | DesignFile 直接复用                         |
| `CanvasStore` 的 batchEdit                          | 仅改 `open` / `read` 路径按 `designId` 寻址 |
| `canvas_*` 全套工具                                 | design 对话注入不变                         |
| design guideline / `canvasPrompt`                   | 生成初稿工作流直接复用                      |
| 子 Agent design 型                                  | 「生成初稿」按钮可委托                      |
| `DesignAside`（元素树 + CanvasRenderer）            | 抽成 B 形态中画布主区组件                   |
| 素材工具链（`image_*` / `website_logo` / `font_*`） | 素材库补全与 AI 引用                        |

---

## 8. 落地步骤（建议顺序）

1. **数据层** `src/modules/design/`：`types`（Project / Page / DesignFile）+ `store` + `io`（落盘 `~/.mistrelle/design/...`
   ，索引 `project.json` / `page.json`）；新建设计图时经 `ChatSessionManager` 建 design 会话，chatId 写回 Page。
2. **导航 + 项目 / 页面列表页**：主导航新增「设计」页（项目列表 → 页面）；聊天页保留 office / writing / design 三类型（形态 A
   不动）。
3. **B 编辑器页**：左上 PageList + 左下 DesignList + 中画布（抽 `DesignAside`）+ 右 `LChatEngine`（design，sessionId =
   Page.chatId）。
4. **画布归属迁移 + 切图重定向**：`CanvasStore` 支持按 `designId` 路径 `open` / `read`；切换设计图调 `canvas_open` 重定向
   agent 画布。
5. **基础编辑 + 轻量分组**：拖拽改基础字段、成组 / 解组、layout 方向 + gap、 **防抖自动保存**、 **统一撤销栈**
   （human-in-the-loop 底线，先做扎实）。
6. **模板系统**：预置 `.canvas` 占位 + 套模板新建 + AI 替换。
7. **agent 增强**：对话默认 `canvas_open` 当前图；顶部「生成初稿」按钮（预置 prompt 触发 design 工作流 / 子 Agent design
   型）；选区即 pin（升级双击节点引用为「选中即带上 nodeId」）。
8. **素材库补全 + 文档同步**：插图素材落地（`image_*` / `website_logo` 落盘）；补调色板（对接 `canvas_set_palette`
   token）与模板入口；按 AGENTS.md 红线补 `docs/design/*.md` 并更新 `docs/README.md` 索引；UI 全程 tdesign、弹窗走
   `DialogPlugin` / `DrawerPlugin` 命令式、超 300 行拆分。

---

## 9. 关键决策记录

| 决策点     | 结论                                                                                                                     |
|------------|--------------------------------------------------------------------------------------------------------------------------|
| 形态       | 双形态并存：A 聊天驱动保留，B 项目驱动新增                                                                               |
| B 布局     | 左上页面 / 左下设计图 / 中画布 / 右聊天                                                                                  |
| 聊天绑定   | 页面级（一个页面一条对话，agent 自动 `canvas_open` 当前图）                                                              |
| 模板       | 预置 `.canvas` 占位节点，AI `batch_edit` 替换                                                                            |
| 编辑分层   | 基础字段 + 轻量分组（成组/解组 + layout 方向 + gap）手动；高级布局（padding/对齐/fill_hug/ABSOLUTE/wrap/palette）交给 AI |
| 复杂度命门 | layout 组内子元素不开放自由拖位置                                                                                        |

---

## 10. 待确认 / 后续事项（TODO）

- 形态 A 产出的画布未来可「导入到项目」（B 形态），先标记 TODO，本期不做；
- 手动分组第二版是否扩展 padding / 对齐 UI（视用户反馈，优先用自然语言 AI 兜底）；
- mode A 与 mode B 的画布是否需要统一视图切换（如 B 形态内也能「仅聊天」模式）。
