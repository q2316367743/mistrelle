# 06 应用集成页（伙伴窗口设置）

> 2026-09-07：插件安装从红绿灯页 OpencodePanel 独立为「设置-应用集成」页；检测/安装 IPC 从
> trafficLight 域迁出为独立 integrations 域；插件改名 `mistrelle-integration.js`；
> 硬件页（红绿灯/圆屏）按集成状态门控启用与配置。

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
  `IntegrationApi { checkPlatform(software), installPlatform(software) }`
  （`window.preload.integrations`，仅伙伴窗口独立 preload 注入，vite-env.d.ts 声明）。
- **通道** `@common/buddy/integrations/integrationChannels.ts`：`integrations:check` / `integrations:install`。
- **登记表** 渲染层 `registry.ts`：`INTEGRATION_REGISTRY: IntegrationItem[]`
  （`{ name: SoftwareName, label, description, devices, events }`），决定集成页卡片与顺序；
  `events` 为该软件插件支持上报的事件全集（opencode = `BUDDY_EVENT_NAMES` 24 个），
  卡片按 `BUDDY_EVENT_GROUPS` 分组渲染中文 chips，说明「支持哪些事件」。
- **main adapter**：`buddy/integrations/platformConfig.ts` 的 `ADAPTERS: Record<SoftwareName, PlatformAdapter>`，
  opencode 实现 = 模板 `resources/plugins/opencode/mistrelle-integration.js` 复制到
  `~/.config/opencode/plugins/mistrelle-integration.js`，install 顺带 `rmSync` 旧名残留
  `mistrelle-traffic-light.js`（防 opencode 双载双投递；清理失败不影响安装结果）。

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| common | `src/common/types/integrations.ts` | 域类型契约（三态/检查/安装结果/IntegrationApi），事实源 |
| common | `src/common/buddy/integrations/integrationChannels.ts` | IPC 通道常量 |
| main | `src/main/src/buddy/integrations/platformConfig.ts` | adapter 注册表 + opencode 三态检查/覆盖安装/旧名清理 |
| main | `src/main/src/buddy/integrations/integrationsIpc.ts` | 两个 handler（registerIpc.ts 注册 `registerIntegrationsIpc()`） |
| preload | `src/preload/src/modules/integrations/integrations.ts` | integrationsApi 薄封装；`preload/buddy.ts` 注入 `integrations` 域 |
| renderer | `windows/buddy/pages/settings/integrations/registry.ts` | INTEGRATION_REGISTRY 集成登记表 |
| renderer | `windows/buddy/pages/settings/integrations/useIntegrations.ts` | 状态单例（statuses/statusOf/check/install，init 遍历登记表检测） |
| renderer | `windows/buddy/pages/settings/integrations/IntegrationsPage.vue` | 页面骨架 + intro |
| renderer | `windows/buddy/pages/settings/integrations/components/IntegrationCard.vue` | 集成卡片：状态 tag/安装按钮/可驱动设备/插件位置/支持事件分组 chips |
| renderer | `windows/buddy/router/index.ts` + `App.vue` | `/settings/*` 路由 + 「设置」多级菜单（activePaths 高亮父级） |

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
