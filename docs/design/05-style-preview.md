# 设计风格预览（所见即所得卡片）

## 功能概述

让设计风格「所见即所得」：列表卡片整卡按风格规范渲染（配色 / 字体 / 圆角 / 边框 / 阴影 / 留白全部来自风格数据），详情页顶部新增「效果预览」展示同版式的大样张。用户无需再靠色板与文字描述想象风格效果。

核心组件 `StyleCardFace.vue` 是风格规范的数据渲染（同画布样张性质），**不使用 tdesign 组件**——卡片外观必须服从用户定义的风格 tokens 而非应用主题；交互控件（下拉菜单、弹层）仍由外层壳用 tdesign 承载。

## 文件结构

| 文件 | 角色 |
|------|------|
| `src/pages/design/components/StyleCardFace.vue` | 按风格规范渲染的「风格卡片面」，列表卡与详情大样张共用；`--sp-*` CSS 变量换算 |
| `src/pages/design/list/components/DesignStyleCard.vue` | 列表卡壳层：点击进详情 + `t-dropdown` 菜单（经 `#actions` 插槽嵌入卡片面标题行） |
| `src/pages/design/detail/components/StylePromptBlock.vue` | 明细页「视觉提示」区块（自 index.vue 抽出，控行数） |
| `src/pages/new/PageNew.vue` | 新建聊天页：设计风格下拉面板底部实时预览（`panelBottomContent` 插槽 + 选项 `mouseenter`） |

## 数据契约变化

`AiDesignStyleItem`（index.json 索引项）扩展三个渲染规范字段，列表卡片无需读单条文件即可整卡渲染：

```ts
export interface AiDesignStyleItem extends BaseEntity, AiDesignStyleCore {
  colorPalette: AiDesignStyleColorPalette
  typography: AiDesignStyleTypography   // 新增：卡片文字按此渲染
  tokens: AiDesignStyleTokens           // 新增：卡片外观按此渲染
  whitespaceRatio: AiDesignStyleWhitespaceRatio // 新增：映射内边距密度
}
```

- entity 新增 `buildAiDesignStyleTypography(partial?)`（镜像 `buildAiDesignStyleTokens`，兜底旧数据）与 `normalizeDesignStyleItem(item)`（索引项归一化，内部复用两个 builder + `normalizeWhitespaceRatio`）。
- `DesignStyleStore.put()` 索引 item 字面量同步写入三字段；`init()` 读取后逐条 `normalizeDesignStyleItem` 兜底；`getDetail()` 补 `typography` 归一化。
- **旧数据兼容**：旧 index.json / 单条文件缺新字段时读取即兜底默认值，预览正常渲染；编辑保存一次自动落盘补全，无需迁移脚本。
- `designStyleTools.ts` 的 `toSummary` 按显式字段取值，不受索引项扩展影响。

## StyleCardFace 渲染机制

props：`style`（`AiDesignStyleItem | AiDesignStyle`）、`variant: 'compact' | 'full'`、`scale?`（缺省 compact 0.6 / full 1）。

script 把规范数据换算为一组 `--sp-*` CSS 变量（尺寸 = 规范值 × scale），模板与样式全部引用变量：

| 变量 | 来源 |
|------|------|
| `--sp-bg / --sp-surface / --sp-primary / --sp-secondary / --sp-text / --sp-text-2` | `colorPalette` 六色 |
| `--sp-on-primary` | `contrastOn(primary)`：W3C 相对亮度 ≥ 0.5 取深色文字否则白，保证主色上按钮文字可读 |
| `--sp-border` | `border.width×scale + style + color`；style 为 `none` 时输出 `none` |
| `--sp-radius / --sp-btn-radius` | `radius.medium` / `radius.small`；`pill` 时按钮为 `999px` 胶囊 |
| `--sp-shadow / --sp-shadow-hover` | `shadow` 四元组 × scale；`enabled: false` 输出 `none`；hover 版加大 blur 与 offsetY |
| `--sp-motion` | `motion.duration + easing`，用于卡片 hover 过渡（顺带展示动效规范） |
| `--sp-pad / --sp-gap` | `spacing.cardPadding / sectionGap` × scale × 留白密度系数（35 → 0.85 / 55 → 1 / 70 → 1.2） |
| `--sp-title-* / --sp-body-* / --sp-cap-*` | `typography` 三层级 font / weight / size / lineHeight（font 为 CSS font-family 列表原样使用，空则 `inherit`） |

版式（通用内容卡，所有风格共用同一版式，差异全部来自规范本身）：

- 封面装饰区：surface 底 + primary 大圆 + secondary 圆角方块几何构图；compact 内嵌一枚装饰按钮（primary 底 + `--sp-btn-radius`），full 的按钮组放正文。
- 标题（`style.name`，heading 字体）+ 内置徽标（描边文本徽标，风格文字色，避免 t-tag 在任意底色不可读）+ `#actions` 插槽（壳层放下拉菜单，触发器 `color: inherit` 继承风格文字色）。
- 正文（`description`，body 字体，最多 2 行）。
- compact：meta 行（分类 + tags，caption 字体）；full：主 / 次按钮组（展示按钮圆角与边框规范）+ `signature` 签名落款（caption 字体）。
- hover 上浮加深阴影仅 compact 变体，过渡用 `--sp-motion`。

## 注意事项

- 组件声明 prop 名为 `style`，父级用 `:style="s"` 传递——`style` 虽是保留 attr，但显式声明为 prop 后按 prop 传递（既有模式，与旧卡片一致）。
- 菜单弹层（t-dropdown-menu）是全局 popup，保持 tdesign 主题，不受卡片风格影响。
- 字体直接内联 `font-family`：配置来源为 `font_list` 真实本机字体，未安装时浏览器自然回退。
- `StyleCardFace.vue` 恰为 300 行红线，再扩功能需先拆分（如把 cssVars 换算抽到 ts）。

## 新建聊天页下拉悬浮预览

PageNew 选择设计风格时，每个选项内容由 `t-popup`（`trigger="hover"` + `placement="right-top"` + `delay [120, 100]`）包裹，悬停选项即在选项右侧悬浮渲染该风格的 `StyleCardFace` compact / scale 0.5：

- 预览直接用选项数据 `s` 渲染，无需悬停 id 跟踪 / 受控 visible / 回落已选等状态；下拉关闭随面板隐藏。
- popup 的 hover 触发在鼠标进入选项内容根节点后生效，鼠标移入预览框可保持显示细看；快速划过时靠 delay 抑制闪烁。
- 悬浮框内容经 `overlay-inner-style` 去默认内边距，由容器给 8px 呼吸边距；popup 与预览插槽均编译在 PageNew 渲染上下文，scoped 样式可用。
- 选项量 = 本地内置 8 预设 + 用户自建（在线库另计），每选项一个 popup 实例开销可接受；超 100 项会启用虚拟滚动（threshold），届时 popup 随选项 DOM 复用。
