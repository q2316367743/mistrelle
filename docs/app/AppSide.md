# AppSide 侧边栏菜单

> 主应用外壳左侧导航栏。原为 `AppSide.vue` 内逐行手写的 `<button>` + `v-if` 子菜单（无展开动画），已重构为**数据驱动、可递归复用**的菜单组件。

## 组件职责

| 文件 | 职责 |
|------|------|
| `src/pages/app/AppSide.vue` | 外壳：`t-aside`、定位（`.side-container` / `.user-menu`）、定义 `menuTree` 数据、底部用户 `t-dropdown`（`settingOptions`）、`<ChatList />` |
| `src/pages/app/components/SideMenu.vue` | 递归入口 / 列表外壳：`<nav class="menu-list">` 遍历 `items` 渲染 `SideMenuNode`；**导出 `SideMenuItem` 类型** |
| `src/pages/app/components/SideMenuNode.vue` | 递归节点：渲染单行 + 子菜单展开/收起动画；承载 `.menu-item` / `.menu-icon` / `.active` / `::before` 左侧 accent 条等样式 |

## 数据结构

`SideMenuItem`（在 `SideMenu.vue` 用额外 `<script lang="ts">` 块导出）：

```ts
interface SideMenuItem {
  label: string
  icon?: Component              // tdesign 图标组件，模板用 <component :is>
  to?: string                   // 点击导航目标；存在 children 时一般为空（仅展开/收起）
  match?: 'exact' | 'prefix'    // to 判定 active 的方式，默认 exact
  activePaths?: string[]        // 额外按前缀判定自身 active 的路径（如父级覆盖 /design/detail/）；不因子孙选中而高亮
  children?: SideMenuItem[]
}
```

`menuTree` 定义在 `AppSide.vue`，当前映射（见源码）：

- 新建 → `/new`
- 项目 → `to:'/project/list'`，`activePaths:['/project/']`（保留 `startsWith('/project/')` 高亮语义）
- 设计（父，`activePaths:['/design/detail/']`）→ 设计风格 `/design/list`、字体 `/design/font`
- 更多拓展（父）→ Agent `/agent`、技能 `/skill`、工具 `/tool`
- 闲庭漫步（父）→ AI HOT `/attachment/aihot`

## active 判定（SideMenuNode 内，复用 `route.path` 范式）

每项只按自身 `to` / `activePaths` 判定 `.active`，**不向子孙冒泡**。二级菜单选中子项时，父级不高亮。

```ts
function isSelfActive(item: SideMenuItem): boolean {
  if (item.to) {
    const match = item.match ?? 'exact'
    if (match === 'prefix' ? route.path.startsWith(item.to) : route.path === item.to) return true
  }
  return !!item.activePaths?.some((p) => route.path.startsWith(p))
}
```

覆盖场景：

- 「设计风格」`/design/list`、字体 `/design/font`：仅对应子项高亮，父级「设计」不高亮
- 「设计」在 `/design/detail/*` 时仍高亮（自身 `activePaths`）
- 「项目」在任意 `/project/*` 时高亮

展开仍单独看子孙：`hasActiveDescendant` 递归检查子项是否 `isSelfActive`，深链接进入时父级默认展开，但样式不跟选中。

## 展开/收起动画

- 每个有 `children` 的节点维护自身 `expanded`（`ref`）；**初始值 = 有 children 且（自身 active 或子孙 active）**，即深链接进入时该父级默认展开。
- 嵌套容器包 `<transition name="submenu">`，用 JS 钩子做动态高度过渡：
  - `onEnter`：`height:0 → scrollHeight`
  - `onAfterEnter`：`height:auto`
  - `onLeave`：`height:scrollHeight → 0`
  - 配合 `opacity` + `overflow:hidden` + `transition: height/opacity var(--fluent-transition-fast)`
- chevron 图标：`transform: rotate(90deg)` + `transition: transform 200ms ease-in-out`
- 旧实现仅 chevron 旋转、子菜单 `v-if` 瞬时切换，无高度动画；现已补齐。

## 导航

叶节点（`to` 存在、`children` 不存在）：点击 `router.push(to)`，且 `route.path === to` 时跳过（避免重复 push）。沿用 `AppSide`/`ChatList` 既有的 `useRouter` + `route.path` 判定范式（不使用 `<router-link>` / tdesign `t-menu` router 模式）。

## 样式约定

- `.menu-item` 样式为 scoped，按既有代码库惯例每个组件自带一份（`ChatList.vue`、`SideMenuNode.vue`、`AppSide.vue` 的用户按钮各持一份，未抽全局），均复用 Fluent token（`--fluent-item-hover` / `--fluent-item-selected` / `--fluent-item-selected-border` / `--fluent-focus-ring` / `--fluent-transition-fast`）与 tdesign token，未使用裸色值。
- 子菜单缩进：`pl-16px`（逐级嵌套自然累加）。

## 注意事项

- `AppSide.vue` 仍 prop-less / emit-less，状态来自全局 `collapsed`（`@/global/BeanFactory`）与 router，`App.vue` 无需改动。
- 已删除死代码：原 `active = ref('agent')`（恒为 `'agent'`，仅用于恒真的 `v-if` 守卫，已直接渲染 `<ChatList />`）、`note`/`more` 的 `useBoolState` 及其 `noteIconStyle`/`moreIconStyle`/`toggle*`。
- 新增菜单项只需在 `AppSide.vue` 的 `menuTree` 追加数据，无需改模板。
