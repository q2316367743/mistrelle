# 02 · 激活码与会员档位功能控制

## 背景

服务端（mistrelle-server）提供激活码（会员档位 / 积分包）与会员档位能力契约 `features`。本文档覆盖两件事：

1. **激活码兑换**：`verify`（预检不执行）→ `redeem`（激活）全链路与弹窗 UI。
2. **档位功能门控**：`features.customFonts`（自定义字体 = 资源库字体）、`features.extendedDesignStyles`（自定义设计风格 = 用户自建风格，非内置预设）与 `features.thirdPartyRelay`（自定义供应商 = 第三方中转，见「thirdPartyRelay 落点」小节）三项能力的客户端控制。

`features.thirdPartyRelay` 已消费：自定义供应商（第三方中转）受其门控，详见下方「thirdPartyRelay（自定义供应商）落点」。

## 激活码链路（照 auth 域五层模式）

端点（Bearer apiKey，业务 Result 包装）：

- `POST /api/user/activation-codes/verify` body `{ code }` → `{ type, tier: { code, name, level, months } | null, points: number | null, pack: { code, name } | null, expiresAt: number | null }`。**展示按 tier / points 是否非空判别**会员码 / 积分包，不依赖 type 字符串值。
- `POST /api/user/activation-codes/redeem` body `{ code }` → `{ type, tier, tierName, startedAt, expiresAt, grantedPoints, points, membership }`（时间戳毫秒）。会员码：升级档位立即生效，同档/降级档位下一期生效；`grantedPoints` 为 0（会员不再发基础积分），`points` 为 null。增量包：`tier/startedAt/expiresAt` 为 null，`points` 写入 `points_account` 一笔 pack（发放+30 天）。

| 层 | 文件 | 内容 |
|---|---|---|
| 通道契约 | `src/preload/src/modules/auth/authChannels.ts` | `auth:verifyCode` / `auth:redeemCode` + `AuthCodeParams` / `AuthCodeVerifyResult` / `AuthCodeRedeemResult` / `AuthCodeActionResult<T>` |
| main 服务 | `src/main/src/modules/auth/AuthService.ts` | `verifyActivationCode` / `redeemActivationCode`（经 `apiPost` 业务包装；无凭证返回 `{ok:false,msg:'未登录'}`） |
| main IPC | `src/main/src/modules/auth/authIpc.ts` | 两通道纯透传 |
| preload 桥 | `src/preload/src/modules/auth/auth.ts` | `verifyCode` / `redeemCode` |
| 渲染 store + UI | `AuthStore.ts` `verifyCode/redeemCode`；`RedeemCodeDialog` + `MemberTierDialog`（底部「积分增量包」入口，不铺 SKU）+ `PackLotsDialog` / `PackSelectDialog` / `PackCheckoutDialog`（选 SKU → 结算确认须提示 30 天清零原文，无支付） |

要点：

- **redeem 成功后主进程自动 `refresh()`**：tier / features / 余额经 `auth:changed` 广播，全部 UI（账户卡片、门控开关）自动同步，渲染层无需手动刷新。
- 激活码错误（不存在/已被使用等）由服务端 `msg` 返回中文原因，弹窗内联展示，不走 MessageUtil。
- 入口：账户页服务端账号卡片已登录态按钮组「激活码」；未登录态不显示（兑换必须 Bearer 登录）。

## 功能门控

### 门控源（统一消费点）

- 类型：`AuthFeatureKey = 'thirdPartyRelay' | 'customFonts' | 'extendedDesignStyles'`、`AuthFeatures = Record<AuthFeatureKey, boolean>`（authChannels.ts + 渲染侧 types/auth.d.ts 双份维护）。
- `AuthService.fetchMe` 用 `normalizeAuthFeatures` 把服务端 features 归一为**三键完整布尔**（缺省 false）。
- `AuthStore.features` computed：**未登录 / unknown 视为免费档**（两项受控功能均 false），已登录取 `user.features`。所有门控点只读这一个 computed。

### 语义（用户拍板）

- **可见但锁定**（UI 面）：资源库字体、自建风格照常显示，操作入口 disabled + 「会员」tag 标注，操作被拦时提示「自定义 xx 为会员功能，可在 设置 → 账户 开通」。与 skill 启用/禁用「入口保留 + 状态标注」先例一致。
- **自定义风格「不可用于新发起的使用」，内置预设免费可用**：内置预设（`DESIGN_STYLE_PRESETS`，isSystem）免费档照常可用于新建 design/ppt 会话与文生图；自建 / 在线下载风格（isSystem=false）不可新增、不可编辑、不可在新会话下拉中选择（t-option disabled + 选中即清空），旧作品只读展示。
- **AI 面直接过滤/拒绝**：模型不可发现不可用不可写（`font_list` 过滤 library、`list_design_styles` 过滤为非内置预设、create/update 返回明确 error、内置 Agent「设计风格创建助手」整组隐藏）。
- **渲染不拦**：已有画布/文档中已用到的资源库字体（fontRegistry.ensureFontsForDoc）、已有会话引用的自建风格（get_design_style、ChatSessionManager.getDetail）与会员期内用「设计风格创建助手」开过的聊天（getById 保留解析）**继续可读可渲染**，防旧作品损坏与进行中会话 brick；数据保留磁盘，升级后自动恢复全部能力。
- `put`/`remove`（DesignStyleStore）非会员兜底拒绝（UI 入口已拦，防 AI 工具旁路），本地磁盘数据永不删除。

### customFonts（自定义字体 = source:'library' 资源库字体）落点

| 落点 | 行为（非会员） |
|---|---|
| `pages/design/font/DesignFontPage.vue` | 「添加字体」disabled + 会员 tag；表格 library 行「编辑/删除」disabled（系统字体 meta 编辑不拦） |
| `components/chat/aside/design/TextPropertyFields.vue`（画布属性面板） | 字体下拉资源库分组 label 加「（会员）」、逐项 disabled |
| `pages/design/list/modals/TypographyFields.vue`（风格表单） | 同上 |
| `components/chat/chat-assistant/tool/FontPickChatTool.vue`（AI 选字面板） | 过滤 library（AI 面不可见） |
| `modules/tool/components/design/fontTools.ts`（font_list） | 过滤 library + 结果 note「资源库自定义字体为会员功能」 |

### extendedDesignStyles（更多设计风格 = 自建 + 在线库）落点

| 落点 | 行为（非会员） |
|---|---|
| `store/design/DesignStyleStore.ts` | `put`/`remove` 兜底拒绝（返回 undefined / 直接 return）；`all` 不过滤（可见）；`getDetail` 不拦（防 brick） |
| `pages/design/list/index.vue` | 「新建风格」disabled + 会员 tag；`handleEdit`/`handleDelete` 拦截提示（查看本地详情不拦）；**在线 Tab** 可见但锁定（会员 badge + 空态提示），不拉远端列表 |
| `pages/design/detail`（`/design/online/:id`） | 在线详情与下载需能力；下载走 `store.put` |
| `pages/new/PageNew.vue` 风格下拉 + 文生图表单（全局 `StyleSelect`） | 自建/下载风格项 disabled 且**已选自定义 id 自动清空**（watch 兜底 keep-alive 残留 / 会员到期旧选中），内置预设可选可提交；`design/ppt` 会话与生图仅能带内置风格或不带 |
| `store/ai/AiAgentStore.ts` | `builtin:design-style`（设计风格创建助手）从 `all`/`options` 过滤隐藏（Expert 面板 / 专家管理页不可见）；`getById` 保留 → 会员期内用它开过的历史聊天可继续 |
| `modules/tool/components/design/designStyleTools.ts` | `list_design_styles` 只回内置预设；`create/update_design_style` 返回「会员功能」error；`get_design_style` 不拦 |
| 服务端 `GET /api/user/design-styles` | 无能力返回 403（不把提示词裸奔给免费档） |

> **渲染不拦**：历史会话（已锁自定义风格 / 已用 design-style agent）免费档继续可用，不做降级。

远端通道：`auth:listDesignStyles` / `auth:getDesignStyle`（`DesignStyleRemote.ts` + AuthService.authedApiGet）。

### thirdPartyRelay（自定义供应商 = 第三方中转）落点

与 customFonts / extendedDesignStyles 的「可见但锁定」不同，AI 设置页采用**整组隐藏**：免费档（未登录 + 已登录无会员）只显示「内置」分组，自定义供应商分组与「添加供应商」按钮整体不渲染，不产生禁用噪音。付费档（`features.thirdPartyRelay === true`）才显示自定义供应商并可增删改。

| 落点 | 行为（免费档 / thirdPartyRelay=false） |
|---|---|
| `store/setting/SettingAiStore.ts` | `visibleItems` 过滤：只保留内置供应商；`options`/`vectorOptions`/`imageOptions`/`optionMap` 均只含内置模型（启用项自动为内置）；内置供应商由 `init()` 注入 items 首项（`BUILTIN_PROVIDER_ID='builtin'`，不落盘） |
| `pages/setting/ai/components/SettingAiSidebar.vue` | 只渲染「内置」分组；自定义分组与「添加供应商」按钮隐藏；内置项禁用拖拽/删除/启用开关 |
| `pages/setting/ai/SettingAi.vue` | 免费档强制回选内置；内置面板只读展示 + 「刷新模型列表」；登录守卫：guest 提示登录 + `openLogin`，unknown 先 `authStore.refresh()` 再判 |
| `components/chat/AiModelSelect.vue` | 「模型设置」入口：未登录提示登录（登录成功回 `/setting/ai`）；unknown 先 refresh 再判定 |

**内置供应商 = 服务端中转站**（详见 `docs/setting/05-ai-provider-builtin-relay.md`）：模型列表来自 `GET {server}/v1/models`，对话走主进程 relay IPC 代理 `POST {server}/v1/chat/completions`（服务端 apiKey 由主进程注入，渲染层不接触凭证），免费档可用（消耗每日赠送 / 增量包 / 人工充值积分）。

## 注意事项

- 门控是**客户端产品功能**而非安全边界：字体文件与风格数据都在本地磁盘，服务端仅决定 features 契约。
- `membership.expiresAt` 存量类型标注为 `string | null`（authChannels.ts），服务端实际返回毫秒 number（存量遗留，未动）；激活码结果 `AuthCodeRedeemResult` 内的时间戳按 number 处理。
- `DesignStyleStore` 引 `useAuthStore` 须**直连 `@/store/AuthStore` 文件**（经 `@/store` index 会成环：index 再导出 DesignStyleStore）。
- 新增受控能力时：在 `AuthFeatureKey` / `AuthFeatures` / `normalizeAuthFeatures` / 渲染侧 auth.d.ts 四处同步键名，再按「UI 可见锁定 + AI 面过滤 + 渲染不拦」三段式落点。
