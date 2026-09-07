# AppSide 侧边栏菜单

> 主应用外壳左侧导航栏。原为 `AppSide.vue` 内逐行手写的 `<button>` + `v-if` 子菜单（无展开动画），已重构为**数据驱动、可递归复用**的菜单组件；2026-09-04 起组件上移为全局组件（`@/components/menu/`），主窗口 `AppSide` 与伙伴窗口 `buddy/App.vue` 共用同一套侧边栏菜单。2026-09-06：底部用户区由 `t-dropdown` 改为 `t-popup` 自定义面板（参考 Workbuddy 账号菜单），设置侧栏补齐全部设置页入口。外观由「浅色/深色」扩展为「系统/浅色/深色」三态（2026-09-07）。

## 组件职责

| 文件 | 职责 |
|------|------|
| `src/renderer/src/windows/main/pages/app/AppSide.vue` | 主窗口外壳：`t-aside`、定位（`.side-container` / `.user-menu`）、定义 `menuTree` / `menuSettingTree`、底部 `<UserMenu />`、`<ChatList />` |
| `src/renderer/src/windows/main/pages/app/components/UserMenu.vue` | 底部用户触发条 + `t-popup` 面板（账号 / 积分 / 设置入口 / 外观 / 登录登出） |
| `src/renderer/src/windows/main/pages/app/components/UserMenuRow.vue` | 用户面板行：图标 + 标题/描述 + 右侧操作 / 箭头 |
| `src/renderer/src/windows/buddy/App.vue` | 伙伴窗口外壳：`t-aside` + `<SideMenu :items="menus" />`（硬件功能菜单，当前仅红绿灯一项） |
| `src/renderer/src/components/menu/SideMenu.vue` | 递归入口 / 列表外壳：`<nav class="menu-list">` 遍历 `items` 渲染 `SideMenuNode`；**导出 `SideMenuItem` 类型** |
| `src/renderer/src/components/menu/SideMenuNode.vue` | 递归节点：渲染单行 + 子菜单展开/收起动画；承载 `.menu-item` / `.menu-icon` / `.active` / `::before` 左侧 accent 条等样式 |

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

- 新建（`Constant.name`）→ `/new`
- 生图 → `/attachment/image`
- 设计（父，`activePaths:['/design/detail/']`）→ 设计风格 `/design/list`、卡片风格 `/design/card`、字体 `/design/font`
- 闲庭漫步（父）→ 笔记卡片 `/attachment/card`、可用性检测工具 `/attachment/test`、模型对比检测 `/attachment/compare`
- 更多拓展（父）→ Agent `/agent`、技能 `/skill`、工具 `/tool`

`menuSettingTree`（`route.path.startsWith('/setting')` 时滑入）：

- 系统设置 → `/setting/global`
- 账户设置 → `/setting/account`
- 智能体设置 → `/setting/default`
- 个性化 → `/setting/personalize`
- 记忆 → `/setting/soul`
- 模型 → `/setting/ai`
- 安全中心 → `/setting/secure`
- 网络设置 → `/setting/network`

`menus` 定义在 `buddy/App.vue`：红绿灯 → `/hardware/traffic-light`，`match:'prefix'` 覆盖子路径。

## 用户菜单（t-popup）

不再用 `t-dropdown`：下拉项高度/布局受限。改为 `t-popup`（`trigger=click`，`placement=top-left`，内容宽 272px），面板结构对齐 Workbuddy 账号菜单，入口映射到本产品已有能力：

| 区域 | 行为 |
|------|------|
| 顶栏 | 显示昵称；已登录可复制用户名（`inject.clipboard.copyText`） |
| 会员 | 档位名（无档位为「体验版」）+「升级」→ 既有 `openMemberTier` |
| 积分余额 | 仅已登录：刷新（`authStore.refresh`）+ 总额 + 箭头 → `openPointsLedger` |
| 登录 / 注册 | 未登录显示，打开 `LoginDialog` |
| 设置 | 不在设置路由时进入 `/setting/global`（侧栏切到 `menuSettingTree`）；已在设置内则只关面板 |
| 记忆与进化 | 进入 `/setting/soul` |
| 外观 | `t-radio-group` 系统 / 浅色 / 深色，调用 `setColorMode`（见下） |
| 退出登录 | 仅已登录，`authStore.signOut` |

未移植 Workbuddy 的「加油站 / 邀约 / 成长计划 / 帮助与反馈 / 检查更新」：本产品没有对应能力，不造空入口。打开弹层时 `refreshIfStale`。

## 外观（ColorMode）

`useColorMode`（`@/hooks/ColorMode.ts`，主窗口经 `BeanFactory` 单例导出 `isDark` / `mode` / `setColorMode`）：

- **`mode`**（`'system' | 'light' | 'dark'`）：记录用户"所选模式"，默认（无本地记录）为 `system`；面板三态按钮绑定它。
- **`isDark`**（布尔）：当前"生效深浅"，系统模式下跟随 `prefers-color-scheme`，其余消费方（Monaco、右键菜单等）只看 `isDark`，语义不变。
- `setColorMode` 把所选模式写入 `localStorage` 键 `mistrelle-color-mode`（`system` \| `light` \| `dark`），并立即同步 `isDark`。
- `prefers-color-scheme` 变化监听：仅当 `mode === 'system'` 时更新 `isDark`（兼容存量只存 `light`/`dark` 的旧值，其视为用户锁定）。
- 写 `document.documentElement[theme-mode]`，与 tdesign / Fluent token 一致。

伙伴窗口仍自己调用 `useColorMode()`，不共享主窗口的 `isDark` ref / `mode`；新开窗口会读到已持久化的选择。

## 宽度自适应

组件不锁定宽度：`.menu-list` 为 `width: 100%`、节点按钮 `width: 100%`，由外层容器决定实际宽度。主窗口 `.side-container` 内宽 204px、伙伴窗口 200px，各自撑满。新增使用方只需控制好容器宽度。

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

- `.menu-item` 样式为 scoped，按既有代码库惯例每个组件自带一份（`ChatList.vue`、`SideMenuNode.vue`、`UserMenu.vue` 的用户按钮各持一份，未抽全局 CSS），均复用 Fluent token（`--fluent-item-hover` / `--fluent-item-selected` / `--fluent-item-selected-border` / `--fluent-focus-ring` / `--fluent-transition-fast`）与 tdesign token，未使用裸色值。
- 子菜单缩进：`pl-16px`（逐级嵌套自然累加）。
- 用户面板挂到 body（`t-popup` 默认 attach），不受侧栏 overflow 裁剪；浮层圆角/阴影走全局 `.t-popup .t-popup__content`。

## 注意事项

- 组件已上移到 `@/components/menu/`（2026-09-04），跨窗口共用；旧位置 `windows/main/pages/app/components/` 勿再引用（该目录现仅放主窗口私有的 `ChatList` / `UserMenu`）。
- `AppSide.vue` 仍 prop-less / emit-less，状态来自全局 `collapsed`（`@/global/BeanFactory`）与 router，`App.vue` 无需改动。
- 伙伴窗口接入时同步删除了其手写的 `.menu-item` 样式副本；`buddy/App.vue` 不再自带菜单样式，样式以 `SideMenuNode.vue` 为唯一事实源（`ChatList` 与用户按钮的副本按惯例仍各自持有）。
- `SideMenuNode` 内部使用 auto-import 的 `useRouter`/`useRoute`，两个窗口入口均已启用 auto-import，跨窗口使用无额外配置。
- 已删除死代码：原 `active = ref('agent')`（恒为 `'agent'`，仅用于恒真的 `v-if` 守卫，已直接渲染 `<ChatList />`）、`note`/`more` 的 `useBoolState` 及其 `noteIconStyle`/`moreIconStyle`/`toggle*`。
- 新增菜单项：主窗口在 `AppSide.vue` 的 `menuTree` / `menuSettingTree` 追加数据、伙伴窗口在 `buddy/App.vue` 的 `menus` 追加数据，均无需改模板。
- 进入设置页时 `.side-setting` 可滚动，避免矮窗口裁掉后几项。
