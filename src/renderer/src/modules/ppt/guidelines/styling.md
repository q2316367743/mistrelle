# POM 样式经验（来自官方 styling-guide 文档转写）

## 1. 颜色系统

- **颜色一律 6 位 hex 不带 #**（如 `F8F9FA`），全篇统一格式。
- 用 `<Theme>` 声明全局色板：`<Theme surface="0F172A" accent="38BDF8" textMain="F8FAFC" textMuted="94A3B8" />`，之后
  `backgroundColor="$surface"`、`color="$accent"` 引用； **换主题只改一处**。
- 推荐色板（角色 → 色值）：

| 用途             | 色值     |
|------------------|----------|
| 标题（近黑）     | `1A1A2E` |
| 正文（深灰）     | `333333` |
| 副标题（中灰）   | `666666` |
| 弱化文字（浅灰） | `999999` |
| 主色（蓝）       | `1D4ED8` |
| 成功（绿）       | `16A34A` |
| 警告（琥珀）     | `D97706` |
| 危险（红）       | `DC2626` |
| 信息（天蓝）     | `0EA5E9` |
| 浅色背景（米白） | `F8F9FA` |
| 边框（浅灰）     | `E5E7EB` |

- 经验：全篇 ≤ 5 个语义色 + 灰阶；深色页用 `surface` 深底 + `textMain` 浅字。

## 2. 字体规范

- 默认字体 **Noto Sans JP**（内置，中文可显示）；`fontFamily` 可换系统字体。
- **字号分级（官方规范）**：标题 28–40 / 小标题 18–24 / 正文 13–16 / 注释 10–12。
- `lineHeight` 默认 1.3（Text 与 Ul/Ol 保持同一数值视觉一致）。
- KPI 大数字 + 小单位：`<Text>¥84.2<Span fontSize="20">M</Span></Text>`——同一基线自动对齐，不用 HStack 拼。
- 文本效果：`highlight`（高亮底）、`underline.style="wavy"`（波浪下划线）、`glow`（发光）/ `outline`（描边）原生导出可编辑（glow 需
  PowerPoint 查看，LibreOffice 不渲染）。

## 3. 边框 / 阴影 / 圆角 / 渐变

- **卡片标准样式**（信息块通用）：
  ```
  VStack: backgroundColor="FFFFFF" borderRadius="8" padding="24" gap="8"
          border.color="E5E7EB" border.width="1"
          shadow.blur="4" shadow.offset="2" shadow.color="000000" shadow.opacity="0.1"
  ```
- **侧边强调条**：`border.color="E5E7EB" border.width="1" borderLeft.color="1D4ED8" borderLeft.width="6"`（细框 +
  粗强调线）；标题下划线用 `borderBottom`。
- **背景渐变**（原生 PowerPoint 渐变，可编辑）：`backgroundGradient="linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)"`
  ；深色封面页常见。
- **文本渐变**：`textGradient="linear-gradient(90deg, #38BDF8 0%, #A78BFA 100%)"`——标题视觉锚点。
- `opacity`（0-1）控制背景透明度；`shadow.type="inner"` 做内阴影。

## 4. 样式最佳实践

- **先定 Theme 再画页面**：所有颜色从令牌引用，全篇和谐且可整体换肤。
- **卡片化内容**：指标 / 要点放卡片（白底 + 圆角 + 细边 + 轻阴影），比裸文字专业。
- **卡片内层级**：标签 `fontSize="12" color="999999"` + 数值 `fontSize="28" bold="true"`（涨跌用语义色：绿 `16A34A` / 蓝
  `1D4ED8`）。
- **蒙层叠字**：图片上放文字用 `Layer` + 半透明遮罩（`Shape fill.color="000000" fill.transparency="0.6"`）+ 居中白字。
- **留白**：页面 padding ≥ 40、卡片 gap 8-16、标题下留 24 左右。
- **注意**：`rotate` 只影响渲染不影响布局（兄弟不避让），旋转元素需自行核对最终位置。
