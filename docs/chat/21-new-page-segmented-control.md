# 新建页场景选择器（SegmentedControl）

## 定位

`src/renderer/src/components/ui/SegmentedControl.vue`：通用分段选择器（Fluent 风格，绝对定位滑块 + 位移动画）。
当前消费方为新建聊天页 `pages/new/PageNew.vue` 的两处选择器：

- 一级「家族」：`SCENE_FAMILIES` 派生（写作 / 设计创意 / 日常办公）
- 二级「子场景」：`currentFamily.variants.options`（写作→文章/短篇，设计→画布/HTML 引擎）

## 结构与样式契约

| 元素 | 类名 | 角色 |
|------|------|------|
| 容器 | `.segmented` | 轨道，背景 `--fluent-item-hover`，`position: relative` 兼作 offsetParent |
| 滑块 | `.segmented__indicator` | 选中态视觉，背景 `--fluent-card-bg`，`transform/width` 由 JS 量取 |
| 选项 | `.segmented__item` / `--active` | `--active` 只管文字（primary + 600）与图标（accent），**不设自身背景** |

> 选中态的唯一视觉表达是滑块；滑块失效时选中项只剩「浅色文字」，整排看起来会「选中反转」。

主题极性：滑块是半透明卡面色，深色主题下比轨道**更暗**（深色选中），浅色主题下比轨道**更亮**（浅色选中）。这是既有设计，两处选择器一致。

## 事故复盘：二级选择器「选中反转」（2026-09-16）

**复现**：初始写作正常 → 切到「设计创意」→ 切回「写作」，二级选择器整排反转（选中项无滑块，只剩浅色文字）。

**根因**：滑块几何原先取自 `v-for` 的数组模板引用 `ref="itemRefs"`：

- 一级选项永不变化，`v-for` 子节点不重建 → 数组引用始终有效 → 一直正常；
- 二级选项在 writing ↔ design 间**整体替换**（key 完全不同），但 `<template v-if="currentFamily?.variants">` 在两者都为真，**组件实例复用、不重建**，只是 `<button>` 全部卸载重挂；
- Vue 的 `v-for` 数组模板引用在列表整体替换后与存活节点失同步（官方文档明确「不保证顺序」），`itemRefs.value[index]` 指向 `null` / 已卸载节点，`offsetWidth === 0`；
- 此后 `options`（注册表稳定数组引用）与 `modelValue` 都不再变化，`computed` 不重算 → 滑块永久塌缩为 `width: 0`。

切到「日常办公」不复现：该家族无 variants，二级组件被 `v-if` **卸载**，回来是全新实例、引用重新建立。

**修复**（`SegmentedControl.vue`）：

1. 根元素恢复 `ref="containerRef"`，新增 `getItem(index)`：`containerRef.value?.querySelectorAll('.segmented__item')[index]`，**从真实 DOM 取活节点**，不再用数组模板引用。
2. `indicatorStyle` 由 `computed` 改为 `ref` 状态 + `measure()`：
   ```ts
   watch([selectedIndex, () => props.options], measure, { immediate: true, flush: 'post' })
   ```
   `flush: 'post'` 保证 `options` 变化触发的 `v-for` 重建完成后再量取。
3. `onMounted` 量一次 + `ResizeObserver` 观察容器（字体加载 / 标签宽度变化），`onBeforeUnmount` 断开。
4. 顺带移除 `:id="segmented-item-${index}"`（两个实例间会重复，且无引用方）。

`offsetLeft` / `offsetWidth` 的几何公式未变（容器是 offsetParent），只换了几何来源并补上重测时机。

## 注意事项

- ⚠️ **不要改回 `v-for` 数组模板引用**做选中项量取：凡 props.options 会在同一实例内整体替换的场景，都会复现本次事故。
- 量取必须在 DOM patch 之后（`flush: 'post'` / `onMounted`）。
- 键盘 ←/→ 的焦点移动同样走 `getItem(next)`，与量取共用同一取节点口径。

## 关键文件

| 文件 | 作用 |
|------|------|
| `src/renderer/src/components/ui/SegmentedControl.vue` | 组件实现（本次修复点） |
| `src/renderer/src/windows/main/pages/new/PageNew.vue` | 一级 / 二级选择器调用方（`v-model="type"` / `v-model="variant"`） |
| `src/renderer/src/windows/main/modules/chat/scenes/index.ts` | `SCENE_FAMILIES` / `variants.options` 数据源 |
