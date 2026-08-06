# 画布节点模型与批量编辑（v2）

> 设计创意画布的 v2 数据模型与技术实现。面向 **平面设计作品**（海报 / 封面 / 配图 / 读书笔记），
> 参考 ardot `batch_edit` 的"科学流程"，但 **不搬它的 UI 布局学说**（frame/flexbox 教条、组件/变量体系）。
>
> 关键文件：
> - 数据模型 `src/modules/tool/components/canvas/canvasTypes.ts`
> - 布局引擎 `src/modules/tool/components/canvas/canvasLayout.ts`
> - 存储与批量编辑 `src/modules/tool/components/canvas/CanvasStore.ts`
> - 渲染器 `src/modules/tool/components/canvas/canvasRender.ts`
> - 工具集 `src/modules/tool/components/canvas/canvasTools.ts`
> - **输入 schema（TypeBox 单一源）** `src/modules/tool/components/canvas/canvasSchemas.ts`
> - 固定提示词 `src/modules/tool/components/canvas/canvasPrompt.ts`
> - 内置参考 `src/modules/tool/components/canvas/guidelines/*.md` + `guidelines.ts`

---

## 1. 设计目标

- **图层树 + 自由定位**为主：海报是"构图 + 排版"艺术，绝对坐标是基本盘；`group` 可 **可选**
  开启自动布局，仅用于局部整齐排布（徽章 / 多图拼贴 / 卡片）。
- **批量原子编辑**：`canvas_batch_edit` 一次执行 insert/copy/update/move/delete/image，≤25 个/批，任一失败整体回滚 →
  少轮次、可控。
- **调色板 token**：`canvas_set_palette` 定义 3-5 色，fill/stroke 用 `$token名` 引用 → 全页色彩和谐。
- **内置设计 skill**：固定提示词只放铁律，完整规则（风格/构图/字体/操作/工作流）由 `canvas_guidelines(topic)` 按需加载 →
  prompt 前缀稳定可缓存。

## 2. 与 ardot batch_edit 的取舍对照

| 从 ardot 照搬（科学流程）                                | 改造 / 丢弃（UI 专属）                            |
|----------------------------------------------------------|---------------------------------------------------|
| 批量操作 + 失败回滚、`as` 绑定名单批内引用               | `frame` → `group`（容器，默认自由定位）           |
| 节点必赋有意义 `name`；`path` 用 `;` 分隔更新嵌套        | flexbox → **可选** `layout`，仅局部用             |
| 颜色统一 `fill`、圆角 `cornerRadius`、字重数字           | components/ref/reusable 组件体系 → 不做           |
| 反 AI 俗套风格铁律（style-guide）                        | 完整变量系统 → 简化成 `palette` token             |
| 分层校验（导出查看 → 修正 ≤2 轮）                        | web-app/mobile/landing 场景 → 创意场景指南        |
| 按需加载指南（`fetch_guidelines` → `canvas_guidelines`） | fill_container/hug_contents 教条 → 仅布局组内有效 |

## 3. 数据模型（`.canvas` 文件 = schema 2 JSON）

```ts
interface CanvasDoc {
  schema: 2
  name: string;
  version: number;
  title?: string
  width: number;
  height: number;
  background: string
  nodes: CanvasNode[]          // 根图层；children 顺序即 z 序（后画者在上）
  palette: Record<string, string>  // token名 → 颜色
}
```

节点类型：`group / text / rect / ellipse / line / polygon / star / path / image / svg`。

核心字段（详见 `canvasTypes.ts`）：

- **定位**：`x/y`（绝对坐标）、`width/height`（数值，布局组内可 `fill_container` / `hug_contents`）、`rotation`、`opacity`、
  `visible`、`blendMode`、`layoutPositioning`（布局父内 AUTO / ABSOLUTE）
- **自动布局（group 可选）**：`layout: none|horizontal|vertical|wrap`、`gap`、`padding`（数值 / `[h,v]` / `[t,r,b,l]`）、
  `primaryAxisAlignItems` / `counterAxisAlignItems`（大写枚举）、`layoutGrow`
- **样式**：`fill` / `stroke`（纯色 / 渐变对象 / `$token名`）、`strokeWidth`、`dashPattern`、`cornerRadius`、`effects[]`
  （drop-shadow / inner-shadow / layer-blur / background-blur）
- **文本**：`text`、`fontSize`、`fontFamily`、`fontWeight`（数字或 "400"~"900"）、`italic`、`letterSpacing`、`lineHeight`（数值 /
  AUTO）、`textAlign`（left/center/right）、`textCase`（none/upper/lower）；文字颜色 = `fill`（必须设置否则不可见），描边字 =
  `stroke` + `strokeWidth`
- **矢量/图片**：`points`（折线，相对 x/y）、`sides`、`corners`、`innerRadius`、`startAngle`、`path`（SVG 路径）、`imageUrl`、`svg`
  （内联）
- **图标用原生节点**：图标 / 简单图形优先用原生节点组合（rect / ellipse / path / line / star / polygon），颜色用 `fill` +
  `$token`；内联 `svg` 字符串仅复杂图标兜底（内部颜色无法引用调色板 token，且导出 PNG 可能因异步加载缺失）。`path` 描边图标设
  `fill: "none"` + `stroke`；`line` 颜色写在 `stroke`
- **占位图**：`placeholderLabel`（G 操作 placeholder 生成，渲染层绘制灰色渐变 + 居中标签）

## 4. 布局引擎（canvasLayout.ts）

`layoutCanvasDoc(doc) → LayoutNode[]`：输出每节点绝对 x/y/w/h。

- 自由定位：非布局组内子节点直接按 x/y。
- 可选自动布局：horizontal / vertical / wrap 按 gap/padding/对齐排布；fill 均分剩余；`layoutPositioning: 'ABSOLUTE'`
  子节点忽略布局。
- `hug_contents`：文本宽度用 `canvas.measureText` 近似（document 不可用时有字符估算兜底）；容器 = 子节点扩展 + padding。
- **预览与导出共用同一实现**（单一事实源）。

## 5. 渲染器（canvasRender.ts）

- `buildDocElements(doc, scale, offsetX, offsetY) → [rootGroup]`：背景 + 全部根图层包在 **一个根 Group**，缩放/平移用根
  Group 变换，元素坐标保持文档空间 → Path 不再需要二次 scale、阴影/模糊随组自动缩放。
- `buildNode(layout, palette)` 递归：group → `Group`（有 fill 时内嵌背景 `Rect`）；叶子映射 Leafer primitive；text 映射
  `Text`（含描边字 / 字距 / 行高 / 对齐 / 大小写）；svg 用 `Platform.toURL` 转 blob。
- **渲染语义**：`fill` / `stroke` 为 `"none"` 时表示显式无填充 / 无描边（渲染时省略属性，避免给 Canvas 赋非法颜色导致状态泄漏）；
  `line` 的颜色取自 `stroke`（兼容旧数据 `fill` 兜底），并保留 dashPattern / strokeCap。
- `exportCanvasPng(doc, region?)`：scale=1 复用同一构建，通过 `screenshot` 限定导出矩形—— **缺省严格导出整张画布**（0,0 →
  doc 尺寸，越界元素裁剪，杜绝「导出尺寸 ≠ 画布尺寸」）；传 `region {x,y,width,height}` 可导出指定区域（用于画布内容器 /
  卡片按设计区域导出）。辅助函数：`computeNodeBounds(doc, id)`（节点含子树包围盒）、`normalizeRegion(region)`。
- 预览组件 `CanvasRenderer.vue` 调用 `buildDocElements`（fit/缩放/平移逻辑不变）。

## 6. Store 与批量编辑（CanvasStore.ts）

- 生命周期：`refreshFiles / open / read / create / delete / save`，`readDoc`/`refreshFiles` **只识别 schema 2**（旧扁平
  shapes 文件直接不可见，兼容策略：不兼容）。
- `batchEdit(ops)`：顺序执行 I/C/U/M/D/G，**单点容错**——每个 op 先经 TypeBox 校验再执行，任一 op 校验或执行失败
  只让该 op 在 `results` 内联返回 `{ error }`，其余 op 照常执行并一次性落盘（一个坏节点不拖垮整批）；返回
  `{ results, potentialIssues }`。级联语义：被跳过的 op 不写入 `as` 绑定，后续引用它的 op 独立报错。
- `as` 绑定：insert/copy 可带 `as`， **仅同一批内**用 `parent: "@绑定名"` 引用；跨批用返回的真实 id。
- `path`：`'id'` 或 `'父id;子id'`（可多层）或 `'@绑定;子id'`；update 禁改 `id/type/children`（TypeBox 校验拒绝并报错）。
- image 操作：`placeholder` 设 `placeholderLabel`；`stock`/`ai` 用 picsum 稳定种子 URL 下载到沙盒
  `outputs/images/{nodeId}.jpg`（`requestDownload`），失败退回远程 URL。

## 7. 工具清单（canvasTools.ts）

| 工具                                                                            | 风险             | 说明                                                                                          |
|---------------------------------------------------------------------------------|------------------|-----------------------------------------------------------------------------------------------|
| `canvas_list` / `canvas_read` / `canvas_open` / `canvas_delete` / `canvas_save` | safe / dangerous | 生命周期（schema 2 过滤）                                                                     |
| `canvas_create`                                                                 | safe             | 创建画布；description 内置常用比例                                                            |
| `canvas_export`                                                                 | sensitive        | 渲染 PNG（路径感知策略，沙盒内放行）；支持可选 `node`（节点包围盒）/ `region`（指定区域）导出 |
| `canvas_batch_edit`                                                             | sensitive        | 核心：`operations: CanvasBatchOp[]`                                                           |
| `canvas_get_nodes`                                                              | safe             | 返回图层树 + palette                                                                          |
| `canvas_set_palette`                                                            | sensitive        | 定义/合并调色板                                                                               |
| `canvas_guidelines`                                                             | safe             | topic: style-guide / composition / typography / operations / workflow                         |

安全策略：`canvas_*` 全部注册 `allow`（仅读写沙盒 outputs/），`canvas_export` 走路径感知策略。

## 8. 内置 skill（canvasPrompt.ts + guidelines/）

- **固定提示词**：角色（资深平面设计师）、工作流（选比例 → 定 palette → batch 分层构建 → ≤2 轮修正；导出仅由用户要求触发）、图层模型速查、反
  AI 俗套铁律、构图与字体铁律、**排版防错规则**（垂直间距、几何中心定位、宽度估算、居中禁止「估宽 + 目测 x」）、按需加载指令。
- **内置参考**（`guidelines.ts` 用 `?raw` 打包，`canvas_guidelines` 读取）：
  - `style-guide.md`：反 AI 俗套铁律 + 创意武器库（改编自 ardot rules/style-guide.md）
  - `composition.md`：构图法则 + 常用画布尺寸
  - `typography.md`：字体层级 / 字距行距 / 描边与渐变文字
  - `operations.md`：batch_edit 操作与节点速查 + 示例
  - `workflow.md`：端到端工作流与收敛阈值
  - 场景指南：`poster.md`（海报）/ `book-cover.md`（书籍封面）/ `album-cover.md`（专辑封面）/ `social-media.md`（公众号封面 +
    小红书配图）/ `knowledge-card.md`（读书笔记 / 知识卡片）
  - 各场景指南统一结构：画布尺寸表 → 构图 → 文字排版 → 色彩 → 素材来源 → 自检清单

## 9. 注意事项

- 旧扁平 `shapes[]` 文件 **不兼容**（schema 1），列表/读取直接过滤；需重新 `canvas_create`。
- **节点 `type` 可省略**：AI 常省略 `type` 靠字段推断，store 会按字段自动推断（svg/image/path/text/polygon/star/line/group，兜底
  rect），并在校验前补全；读取已落盘画布时也会对缺失 `type` 的存量节点做治愈，保证不崩。
- **输入校验（TypeBox 单一源）**：`canvasSchemas.ts` 用 TypeBox 定义节点 / 批量操作 / patch 三套 schema，**同时**生成喂给
  模型的参数描述（`canvasTools` 的 `parameters`）与运行时校验器，两处永不脱节。字段类型严格（`width/height` 为
  number 或 `fill_container`/`hug_contents`，`padding` 为 number|number[]，`fontWeight` 为 number|"400"~"900" 等），
  枚举用 Literal 联合，`additionalProperties: false` 拒绝未知字段。
- **非法即报错反馈**：`insert`/`copy`/`update` 入参不符合 schema 时抛错，经 `agentTools` 回填给模型（"第 N 个操作失败：字段 xxx …"）
  让 AI 自纠，不再静默丢弃；渲染层兜底（`buildNode` 未知类型返回空 `Group`、单节点失败跳过）仍保留作最后防线。
- 旧模型无此校验时可能落盘的脏数据（如 `width:"500"`）读盘仍宽松展示，不影响渲染。
- 渲染端兜底：`buildNode` 对未知类型返回空 `Group`（绝不返回 `undefined`），单节点构建失败会跳过而非拖垮整张画布。
- 文本 `hug_contents` 宽度为近似值（measureText / 字符估算），多行文本请给显式宽度。
- `line` 的 `points` 相对节点 x/y（旧模型为绝对坐标，语义已变）。
- image 的 `ai` 类型暂按 `stock` 兜底（当前无文生图服务）。
- 图片未显式 width/height 时可能 0 尺寸不可见，建议 G 前先给目标节点尺寸。

## 10. v2 预留（下个迭代）

- 变量系统、组件（reusable/ref）如后续需要再评估（当前用 palette 满足色彩一致性）。
- 更多场景指南（如海报子类型细分：电影 / 音乐 / 活动）可按需补充 `guidelines/` 文件与 topic。
- G 操作的 `ai` 类型待接入真实文生图服务后升级。
