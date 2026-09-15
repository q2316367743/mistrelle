# 08 · 选片段去 AI 味（气泡菜单入口）

> 2026-09-15。在文章编辑器选中文字的气泡菜单（`ArticleBubbleMenu`）新增「去 AI 味」按钮：
> 对**选中片段**流式改写，弹对比窗确认后替换，与底部动作条的**整篇**去 AI 味（`useArticleAssist`，走版本历史）互补。

## 定位辨析

- 需求口误澄清：入口加在 `ArticleBubbleMenu.vue`（**选中文字**时的格式悬浮框），不是 `ArticleImageMenu.vue`
  （后者仅在选中图片时出现，没有文字选区，语义不成立）。
- 与整篇去 AI 味的差异：**不建版本、不落数据**，替换即写回正文（走 `onUpdate` 自动保存）；
  深度复用整篇的选择弹窗 `openHumanizeDepth`（确认后才锁编辑器发起请求），记忆深度同源。

## 流程（`useSelectionHumanize.ts` 编排）

```
点按钮 → 校验（登录 / 选区非空 / 选区不含图片节点）
      → openHumanizeDepth 选深度（默认 = 上次深度，取消则无副作用）
      → editor.setEditable(false) 锁编辑器（菜单保持显示，按钮 loading，其余格式按钮禁用）
      → requestHumanizeStream（SSE，depth = 所选深度，并写入共享记忆）
      → 成功：打开对比弹窗（弹窗期间保持锁定）
           ├─「替换」→ 校验原文未被改动 → insertContentAt({from,to}, …) → settle
           └─「取消」→ settle（丢弃）
      → 失败：MessageUtil.error + settle（解锁）
```

`settle` = 清弹窗引用 + `humanizing=false` + 解锁。**解锁让位于父级**：`isParentLocked()`
（即 BubbleMenu 的 `props.disabled`，对应版本级改写中的 `:editable="!humanizing"`）为真时不抢
`setEditable(true)`，避免版本级流式写入期间被误解锁。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `article/useSelectionHumanize.ts` | 编排 composable：校验 / 锁 / 请求 / 弹窗 / 替换 / 收场 |
| `article/components/SelectionHumanizeDialog.tsx` | 弹窗外壳 `openSelectionHumanizeDialog(options)`（命令式 DialogPlugin 两件套之外壳） |
| `article/components/SelectionHumanizeContent.vue` | 弹窗内容：monaco diff 双栏（左=选中原文 / 右=改写结果）+ 替换/取消按钮 |
| `article/components/wordDiffTheme.ts` | 共享「只高亮变化字符」monaco 主题（自 `VersionDiffContent.vue` 抽出，两处共用） |
| `article/components/ArticleBubbleMenu.vue` | 新增去 AI 味图标按钮（`AiEditIcon`）+ tooltip / 登录态 / loading |
| `modules/ai/humanize.ts` | 深度记忆上移为共享：`getLastHumanizeDepth` / `setLastHumanizeDepth`（整篇与选片段同源） |
| `article/useArticleAssist.ts` | 改用共享深度记忆（原模块级 `lastHumanizeDepth` 删除） |

## 弹窗防误关（本需求硬性要求）

改写已消耗积分，弹窗**只允许「替换 / 取消」两个出口**，DialogPlugin 显式禁掉一切旁路：

```ts
DialogPlugin({
  footer: false,          // 底部默认按钮不用，操作在内容组件内
  closeBtn: false,        // 禁右上角 ×
  closeOnOverlayClick: false, // 禁点遮罩关闭
  closeOnEscKeydown: false,   // 禁 ESC 关闭
  destroyOnClose: true,
  …
})
```

底部左侧有常驻灰字提示「取消将丢弃本次改写结果（已消耗的积分不予退还）」。

## 替换的防御与实现

- **原文校验兜底**：替换前比对 `doc.textBetween(from, to, '\n').trim()` 与发起时的原文，
  不一致（如流程期间用户触发了整篇去 AI 味清空正文）则提示「正文已发生变化…已丢弃」，不写入。
- **单行 / 多行**：结果无换行时插 `{type:'text'}`（保留标题 / 引用等所在块）；多行时按 `\n`
  拆成 `paragraph` 块数组插入。
- **选区含图片**：`nodesBetween` 检测到 image 节点直接拒绝启动（替换会连带删图），提示仅选文字。
- **组件卸载**：`onBeforeUnmount` 中止在途请求（AbortController）并 `destroy` 遗留弹窗
  （弹窗挂在 body，不随组件卸载）。

## 注意事项

- monaco 主题是全局态（同 docs/writing/07）：diff 选项不含 theme，用 `setTheme` 生效，卸载还原。
- ⚠️ monaco diff 在**宽度低于断点（默认 900px）时自动退化成上下 inline 对比**——片段弹窗
  `min(960px, 94vw)` 恒低于默认断点，必须显式 `renderSideBySideInlineBreakpoint: 0`
  强制左右分栏，否则永远看不到左右对比（第一版踩坑）。
- 片段 diff 高度随内容行数伸缩（`min(40vh, lines*22+28 px)`，下限 200px），短文本不留大片空白。
- 请求 / 弹窗期间气泡菜单**保持显示**（按钮 loading + 其余格式按钮 `:disabled="humanizing"`），
  不要在 `shouldShow` 里隐藏——否则锁定中的编辑器没有任何进度反馈。
