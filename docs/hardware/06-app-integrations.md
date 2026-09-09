# 06 应用集成页（伙伴窗口设置）

> 2026-09-07：插件安装从红绿灯页 OpencodePanel 独立为「设置-应用集成」页；检测/安装 IPC 从
> trafficLight 域迁出为独立 integrations 域；插件改名 `mistrelle-integration.js`；
> 硬件页（红绿灯/圆屏）按集成状态门控启用与配置。
> 2026-09-07：集成卡片新增「最近事件」调试面板（同页加收）——集成事件流实时前端展示，
> 纯内存不落盘；详见下方「调试事件流」节。

## 实现思路

- **定位**：应用集成 = 外部软件（opencode 等）侧的接入配置（内置事件插件装入其插件目录）。
  集成页只负责「检测三态 + 一键安装 + 说明支持哪些事件」；**启用与事件绑定/转发配置仍在各硬件页**，
  但以集成状态门控——未集成置灰并引导去安装，避免用户在无效状态下配置。
- **页面结构**：伙伴窗口新增「设置」一级菜单（SideMenu children 多级），下挂两个二级目录：
  `/settings/integrations` 应用集成（本页）、`/settings/quota` 额度配置（原 `/plugins/quota`
  额度插件页迁入改名，页面目录同步移至 `pages/settings/quota/`）。
- **独立域**：`checkPlatform`/`installPlatform` 原挂在 `trafficLight:` 通道与
  `buddy/traffic-light/platformConfig.ts`，但集成概念服务多设备且独立成页，故迁出：
  通道 `integrations:check`/`integrations:install`、main `buddy/integrations/`、
  preload `modules/integrations/`、类型 `@common/types/integrations.ts`（四处同步，
  契约按域同居）。`SoftwareName` 类型仍留在 trafficLight.ts（红绿灯配置的键全集），集成域复用。
- **状态单例**：渲染层 `useIntegrations.ts` 模块级单例（对齐 useQuota/useTrafficLight 模式），
  初始化时遍历 `INTEGRATION_REGISTRY` 逐个 check；集成页与两个硬件页共用同一份 statuses，
  安装成功后立即重查，硬件页门控即时解除。
- **三态检测**（main 逐字比对）：`missing`（目标文件不存在）/ `outdated`（存在但与内置模板内容
  不一致，可更新）/ `ready`（一致）。内容比对让模板升级可感知；模板不可读按 missing 兜底。

## 门控规则（用户拍板）

| 状态 | 硬件页行为 | 集成页行为 |
|------|-----------|-----------|
| missing | 启用开关/绑定下拉/心跳开关**置灰** + warning alert「去安装集成」链接 | 显示「安装插件」按钮 |
| outdated | **不置灰**（旧版插件功能仍正常）+ warning alert「去更新插件」链接 | 显示「更新插件」按钮 |
| ready | 正常可用，无提示 | 无按钮，绿色「已就绪」 |

- 红绿灯页：`OpencodePanel.vue` 消费 `statusOf('opencode')` 门控启用开关与事件绑定下拉
  （串口连接/调试模式不依赖集成，不受限）。
- 圆屏页：`EventStatusPanel.vue` 同款门控「向屏幕推送心跳」开关（串口/额度面板不受限）。

## 数据结构 / API 契约

- **类型** `@common/types/integrations.ts`：`PlatformConfigStatus`（+Options 名称映射）、
  `PlatformStatus { status, path }`、`PlatformInstallResult { ok, msg?, path }`（均不抛错）、
  `INTEGRATION_ACTIVITY_LIMIT`（事件流上限 200）、
  `IntegrationActivityEntry { platform: string; event: string; accepted: boolean; at: number }`
  （/buddy/event 收到的每条请求，白名单外保留原始字符串，accepted=false=已丢弃）、
  `IntegrationApi { checkPlatform(software), installPlatform(software), uninstallPlatform(software),
  getActivity(), clearActivity(), onActivity(cb) }`
  （`window.preload.integrations`，仅伙伴窗口独立 preload 注入，vite-env.d.ts 声明）。
- **通道** `@common/buddy/integrations/integrationChannels.ts`：`integrations:check` /
  `integrations:install` / `integrations:uninstall` / `integrations:getActivity`（渲染层首拉全量缓冲）/
  `integrations:clearActivity`（清空）/ `integrations:activity`（主进程 → 渲染层单条推送）。
- **登记表** 渲染层 `registry.ts`：`INTEGRATION_REGISTRY: IntegrationItem[]`
  （`{ name: SoftwareName, label, description, devices, events }`），决定集成页卡片与顺序；
  `events` 为该软件插件支持上报的事件全集（opencode = `BUDDY_EVENT_NAMES` 24 个），
  卡片按 `BUDDY_EVENT_GROUPS` 分组渲染中文 chips，说明「支持哪些事件」。
- **main adapter**：`buddy/integrations/platformConfig.ts` 的 `ADAPTERS: Record<SoftwareName, PlatformAdapter>`，
  opencode 实现 = 模板 `resources/plugins/opencode/mistrelle-integration.js` 复制到
  `~/.config/opencode/plugins/mistrelle-integration.js`，install 顺带 `rmSync` 旧名残留
  `mistrelle-traffic-light.js`（防 opencode 双载双投递；清理失败不影响安装结果）。
  2026-09-09 起每个 adapter 增配 `uninstall()`：opencode = 删插件文件与旧名残留（幂等）；
  zcode = 摘本方钩子条目还原 config.json（保留用户自有条目，events 全空才整体还原 hooks 键）+ 删脚本目录；
  集成卡片对已安装（ready/outdated）状态展示「卸载」文字按钮（MessageBoxUtil.confirm 确认）。

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| common | `src/common/types/integrations.ts` | 域类型契约（三态/检查/安装结果/IntegrationApi），事实源 |
| common | `src/common/buddy/integrations/integrationChannels.ts` | IPC 通道常量 |
| main | `src/main/src/buddy/integrations/platformConfig.ts` | adapter 注册表 + opencode 三态检查/覆盖安装/旧名清理 |
| main | `src/main/src/buddy/integrations/integrationsIpc.ts` | 四个 handler（registerIpc.ts 注册 `registerIntegrationsIpc()`） |
| main | `src/main/src/buddy/integrations/integrationsActivity.ts` | 监听器②集成调试事件流：订阅**原始事件总线**全量采集（accepted 打标）+ 内存缓冲(200) + 广播 + 清空（registerIpc.ts 注册 `initIntegrationsActivity()`） |
| main | `src/main/src/buddy/events/buddyEventFilter.ts` | 监听器①白名单过滤：原始事件命中双白名单才发布校验后总线（registerIpc.ts 注册 `initBuddyEventFilter()`） |
| preload | `src/preload/src/modules/integrations/integrations.ts` | integrationsApi 薄封装（check/install + activity 订阅 + get/clear）；`preload/buddy.ts` 注入 `integrations` 域 |
| renderer | `windows/buddy/pages/settings/integrations/registry.ts` | INTEGRATION_REGISTRY 集成登记表 |
| renderer | `windows/buddy/pages/settings/integrations/useIntegrations.ts` | 状态单例（statuses/statusOf/check/install + activity/clearActivity，init 遍历登记表检测并订阅事件流） |
| renderer | `windows/buddy/pages/settings/integrations/IntegrationsPage.vue` | 页面骨架 + intro |
| renderer | `windows/buddy/pages/settings/integrations/components/IntegrationCard.vue` | 集成卡片：状态 tag/安装按钮/可驱动设备/插件位置/支持事件分组 chips + 事件流面板 |
| renderer | `windows/buddy/pages/settings/integrations/components/EventFeedPanel.vue` | 卡片内「最近事件」折叠面板（展开滚动日志/跟随滚底开关/空态/清空按钮） |
| renderer | `windows/buddy/router/index.ts` + `App.vue` | `/settings/*` 路由 + 「设置」多级菜单（activePaths 高亮父级） |

## 调试事件流（2026-09-07 加收）

- **动机**：集成卡片原来只说明「支持哪些事件」，无法确认外部软件是否真的在投递、投递了哪些事件。
  「最近事件」面板把该集成软件发来的**全部请求**实时展示在卡片内——**命中白名单的行整行绿字**
  （已分发到设备），**未命中白名单的行灰字 + 「已丢弃」标注**（保留原始 platform/event 供排查，
  例如插件新增事件名尚未同步进白名单）；纯调试用途，**不落盘、不建表**（main 内存环形缓冲上限
  200，重启清空），也不影响设备域消费。
- **架构 = server 零校验转发 + 原始总线两监听器**：`server/index.ts` 的 `dispatchEvent` 不做任何
  校验，收到 `/buddy/event` 即 `publishRawBuddyEvent(platform, event)` 发布到**原始事件总线**
  （`buddyEventBus.ts` raw 段）；两个监听器各取所需——
  ① `buddy/events/buddyEventFilter.ts` 白名单过滤：双白名单命中才 `publishBuddyEvent` 发布到
  校验后总线（红绿灯/圆屏照旧订阅消费）；
  ② `buddy/integrations/integrationsActivity.ts` 集成调试事件流：全量采集（同一双白名单打
  accepted 标记，仅供前端着色）+ 内存缓冲 + 广播渲染层。
  两个 init 都在 registerIpc.ts 注册（先于 startEventServer，不漏收）。
- **域化四件套**（对齐 esp32Lcd「main 持有 + 首拉 + onEvent 订阅推送」范式）：
  契约类型 `IntegrationActivityEntry { platform, event, accepted, at }` + 通道
  `integrations:getActivity`（渲染层首拉，补足伙伴窗口懒创建前的请求）/
  `integrations:activity`（主进程 → 渲染层单条推送）；preload `onActivity` 订阅返回退订函数、
  渲染层 `useIntegrations` 模块级单例首拉 + 订阅，卡片内 `EventFeedPanel.vue` 按 `platform` prop
  过滤展示该软件的全部请求。
- **UI**：折叠面板默认收起；展开为滚动日志（`HH:mm:ss.SSS` 时间 + 事件中文名（`BuddyEventOptions`）
  + 事件码等宽；未命中的只显示原始事件码），「跟随」默认开启自动滚底、可暂停，空态 t-empty
  「暂无事件，等待外部软件投递」；面板带「清空」按钮（调用 `clearActivity` 清空缓冲，用于开始
  一轮新调试）。「支持事件」chips 保持静态说明，不做状态点亮。
- **新增集成 / 新增事件**：事件流经原始总线自动接入，集成侧**零改动**——该软件发来的每条请求
  （无论是否命中白名单）都进入缓冲与面板；多集成软件各自卡片按 platform 过滤看各自事件。

## 注意事项

- **新增集成步骤**：`@common/types/trafficLight` 的 `SoftwareName`/`SoftwareNameOptions` 加成员 →
  `resources/plugins/<软件>/` 放内置插件模板 → main `platformConfig.ts` 补 adapter →
  集成页 `INTEGRATION_REGISTRY` 登记（含支持事件集）→ 需要门控的硬件页组件消费
  `useIntegrations` 的 `statusOf(软件名)`。
- **安装后需重启对应软件**才加载插件（toast 与卡片 hint 均已提示）；应用未运行时事件投递
  静默丢弃（灯灭语义），集成安装不拉起任何外部进程。
- 集成页卡片展示插件目标路径（`PlatformStatus.path`）便于用户核对/手动排查。
- 额度配置页（`pages/settings/quota/`）与集成无关：额度插件是独立公共域（docs/plugin/02），
  仅菜单归属设置下，域代码不动。
