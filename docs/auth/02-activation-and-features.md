# 02 · 激活码与会员档位功能控制

## 背景

服务端（mistrelle-server）提供激活码（会员档位 / 积分包）与会员档位能力契约 `features`。本文档覆盖两件事：

1. **激活码兑换**：`verify`（预检不执行）→ `redeem`（激活）全链路与弹窗 UI。
2. **档位功能门控**：`features.customFonts`（自定义字体 = 资源库字体）、`features.extendedDesignStyles`（自定义设计风格 = 用户自建风格，非内置预设）两项能力的客户端控制；`features.thirdPartyRelay`（自定义供应商 = 第三方中转）已下放免费，客户端不再消费。

第三方中转已下放免费（2026-09-12），自定义供应商不再受门控、**也无需登录**；详见下方「thirdPartyRelay（自定义供应商）落点」。

## 激活码链路（照 auth 域五层模式）

端点（Bearer apiKey，业务 Result 包装）：

- `POST /api/user/activation-codes/verify` body `{ code }` → `{ type, tier: { code, name, level, months } | null, points: number | null, pack: { code, name } | null, expiresAt: number | null }`。**展示按 tier / points 是否非空判别**会员码 / 积分包，不依赖 type 字符串值。
- `POST /api/user/activation-codes/redeem` body `{ code }` → `{ type, tier, tierName, startedAt, expiresAt, grantedPoints, points, membership }`（时间戳毫秒）。会员码：升级档位立即生效，同档/降级档位下一期生效；`grantedPoints` 为 0（会员不再发基础积分），`points` 为 null。增量包：`tier/startedAt/expiresAt` 为 null，`points` 累加到永久积分。

| 层 | 文件 | 内容 |
|---|---|---|
| 通道契约 | `src/preload/src/modules/auth/authChannels.ts` | `auth:verifyCode` / `auth:redeemCode` + `AuthCodeParams` / `AuthCodeVerifyResult` / `AuthCodeRedeemResult` / `AuthCodeActionResult<T>` |
| main 服务 | `src/main/src/modules/auth/AuthService.ts` | `verifyActivationCode` / `redeemActivationCode`（经 `apiPost` 业务包装；无凭证返回 `{ok:false,msg:'未登录'}`） |
| main IPC | `src/main/src/modules/auth/authIpc.ts` | 两通道纯透传 |
| preload 桥 | `src/preload/src/modules/auth/auth.ts` | `verifyCode` / `redeemCode` |
| 渲染 store + UI | `AuthStore.ts` `verifyCode/redeemCode`；`RedeemCodeDialog`（激活码验证/兑换）+ `MemberTierDialog`（「会员与积分」弹窗：`t-tabs` 平级切换 `MembershipTierTab` 档位 / `MembershipPackTab` 积分包，行内规格按钮 → 系统浏览器打开 16688 商品页） |

要点：

- **redeem 成功后主进程自动 `refresh()`**：tier / features / 余额经 `auth:changed` 广播，全部 UI（账户卡片、门控开关）自动同步，渲染层无需手动刷新。
- 激活码错误（不存在/已被使用等）由服务端 `msg` 返回中文原因，弹窗内联展示，不走 MessageUtil。
- 入口：账户页服务端账号卡片已登录态按钮组「激活码」；未登录态不显示（兑换必须 Bearer 登录）。

## 购买跳转（2026-09-10）

- **档位与积分包同级**：`MemberTierDialog`（header「会员与积分」，640px）内 `t-tabs` 两个 panel — 「会员档位」`MembershipTierTab`（名称/每日赠送/权限勾选/当前标记 + 行内规格按钮）、「积分增量包」`MembershipPackTab`（永久积分余额 + SKU 行 + 购买按钮）；底部「已有激活码？去兑换」→ `RedeemCodeDialog`。规格 offers 由服务端 `GET /api/tiers` 下发（months=1 月卡 / months=12 年卡，同档两种售卖周期），months>1 且平台价已同步时按钮下方展示折合月价营销位（`perMonthDeal`：折合 ¥x/月 · 省 ¥y）。
- **跳转外部平台**：点规格按钮 → `openPurchase(purchaseUrl)`（`modals/offer.ts` → `openUrlByBrowser` → `shell.openExternal`）用系统浏览器打开 16688 商品页。客户端**零硬编码平台域名**——`purchaseUrl` 由服务端 `/api/tiers`、`/api/points-packs` 的 `offers[]` 下发（服务端 `src/lib/market-url.ts` 用 `config.yaml` 的 `market16688.baseUrl` 拼 `{base}/goods/{goods_no}`），换平台/换域名只改服务端配置、无需发客户端版本。
- **offers 契约**（`AuthTierOffer { months, goodsNo, priceFen, purchaseUrl }` / `AuthPackOffer { goodsNo, priceFen, purchaseUrl }`）：付费档仅在服务端已绑定 16688 商品时下发，免费档恒空；**旧服务端可能无 `offers` 字段**，所有消费点 `?? []` 兜底（显式标 `offers?: AuthTierOffer[]`）。
- **价格展示**：`priceFen`（平台售价快照，分）有值时按钮显示 `月卡 ¥15.00`；为 null 时不显示价格——档位各规格总价不同（月卡 ≠ 年卡），回落档位月价会误导；积分包单规格可回落 SKU `price`。
- 规格标签：`1 → 月卡`、`12 → 年卡`、其他 `N 个月`。
- **已删除**（旧的弹窗叠弹窗链，六级）：`PackLotsDialog/Content`、`PackSelectDialog/Content`、`PackCheckoutDialog/Content`。`RedeemCodeDialog`、`PointsLedgerDrawer` 保留。

## 功能门控

### 门控源（统一消费点）

- 类型：`AuthFeatureKey = 'thirdPartyRelay' | 'customFonts' | 'extendedDesignStyles'`、`AuthFeatures = Record<AuthFeatureKey, boolean>`（authChannels.ts + 渲染侧 types/auth.d.ts 双份维护）。
- `AuthService.fetchMe` 用 `normalizeAuthFeatures` 把服务端 features 归一为**三键完整布尔**（缺省 false）。
- `AuthStore.features` computed：**未登录 / unknown 视为免费档**（两项受控功能均 false），已登录取 `user.features`。所有门控点只读这一个 computed。

### 语义（2026-09-12 会员定稿）

> 会员口径：**免费档 = 看得到市场 + 手动新增自造；付费档 = 市场下载 + AI 生成（+ 自定义字体）**。
> 自造内容免费且永久归用户（会员文档 5.3 方案 1）；市场下载内容断订后「直接不显示」（5.2），靠 `source: 'market'` 来源标记区分。

- **可见但锁定**（UI 面）：资源库字体、在线风格库照常显示，付费操作入口加「会员」标注，被拦时提示「xx 为会员功能，可在 设置 → 账户 开通」。与 skill 启用/禁用「入口保留 + 状态标注」先例一致。
- **手动新增 / 编辑 / 删除自造风格全开放**：`put`/`remove`（DesignStyleStore / CardStyleStore）不做会员拦截；AI 工具旁路由 builtin Agent 隐藏 + AI 工具层会员 gate 兜底。本地磁盘数据永不删除。
- **市场下载内容断订后隐藏**：本地实体可选 `source: 'market'`（缺省 = 自造或旧数据）。非会员时 `DesignStyleStore.all` 过滤 `source==='market'` 项（本地列表 / 选型下拉直接不显示，重新订购自动恢复）；历史作品经 `getDetail` 读盘渲染不受影响。
- **AI 面直接过滤/拒绝**（AI 生成 = 会员）：模型不可发现不可写（`font_list` 过滤 library、非会员时 `list_design_styles` 只回内置预设、create/update 返回明确 error、内置 Agent「设计风格/卡片风格创建助手」整组隐藏）。
- **渲染不拦**：已有画布/文档中已用到的资源库字体（fontRegistry.ensureFontsForDoc）、已有会话引用的风格（get_design_style、ChatSessionManager.getDetail）与会员期内用创建助手开过的聊天（getById 保留解析）**继续可读可渲染**，防旧作品损坏与进行中会话 brick。

### customFonts（自定义字体 = source:'library' 资源库字体）落点

| 落点 | 行为（非会员） |
|---|---|
| `pages/design/font/DesignFontPage.vue` | 「添加字体」disabled + 会员 tag；表格 library 行「编辑/删除」disabled（系统字体 meta 编辑不拦） |
| `components/chat/aside/design/TextPropertyFields.vue`（画布属性面板） | 字体下拉资源库分组 label 加「（会员）」、逐项 disabled |
| `pages/design/list/modals/TypographyFields.vue`（风格表单） | 同上 |
| `components/chat/chat-assistant/tool/FontPickChatTool.vue`（AI 选字面板） | 过滤 library（AI 面不可见） |
| `modules/tool/components/design/fontTools.ts`（font_list） | 过滤 library + 结果 note「资源库自定义字体为会员功能」 |

### extendedDesignStyles（在线风格库下载 + AI 生成设计风格）落点

| 落点 | 行为（非会员） |
|---|---|
| `store/design/DesignStyleStore.ts` | `put`/`remove` 不拦（自造免费）；`all` 过滤 `source==='market'` 项（断订后市场下载内容直接不显示）；`getDetail` 不拦（防 brick） |
| `pages/design/list/index.vue` | 新建/编辑/删除全开放；**在线 Tab** 全员可浏览（列表登录即可拉）；点击在线卡片与下载动作提示「下载在线风格为会员功能」 |
| `pages/design/detail`（`/design/online/:id`） | 在线详情与下载需能力（服务端 403 兜底）；下载走 `store.put(..., id, 'market')` 打来源标记 |
| `pages/new/PageNew.vue` 风格下拉 + 文生图表单（全局 `StyleSelect`） | 自造项可选可提交；市场来源项由 `all` 过滤不可见，已选市场 id 自动清空（watch 兜底 keep-alive 残留 / 断订旧选中）；内置预设可选可提交 |
| `store/ai/AiAgentStore.ts` | `builtin:design-style`（设计风格创建助手）从 `all`/`options` 过滤隐藏（Expert 面板 / 专家管理页不可见）；`getById` 保留 → 会员期内用它开过的历史聊天可继续 |
| `modules/tool/components/design/designStyleTools.ts` | `list_design_styles` 非会员只回内置预设；`create/update_design_style` 返回「AI 生成设计风格为会员功能」error；`get_design_style` 不拦 |
| 服务端 `GET /api/user/design-styles/` | **列表登录即可**（免费档可浏览市场）；`GET /:id`（详情=下载）无能力返回 403 |

> **渲染不拦**：历史会话（已选风格 / 已用 design-style agent）免费档继续可用，不做降级。

远端通道：`auth:listDesignStyles` / `auth:getDesignStyle`（`DesignStyleRemote.ts` + AuthService.authedApiGet）。

### thirdPartyRelay（自定义供应商 = 第三方中转）——已下放免费

**2026-09-12 会员定稿：第三方中转下放免费**（它是软件能跑的前提，不能当墙），`features.thirdPartyRelay` 客户端**不再消费**（键保留仅透传兼容，服务端免费档种子置 1）：

- `SettingAiStore`：`relayEnabled`/`visibleItems` 已删，`options`/`vectorOptions`/`optionMap` 直接消费全量 `items`（内置 + 自定义）。
- `SettingAiSidebar`：自定义供应商分组与「添加供应商」按钮全员可见，不再按档位隐藏。
- `SettingAi.vue`：强制回选内置的 watch 已删；页面登录守卫已删（第三方 key 免登录，仅内置中转刷新需登录）；默认选中「已登录优先内置 / 未登录优先第一个自定义供应商」。
- 客户端权益表（MembershipTierTab）已移除「第三方中转」行；管理端档位表单不再提供该开关。

| 落点 | 行为（全员） |
|---|---|
| `pages/setting/ai/SettingAi.vue` | 内置面板只读展示 + 「刷新模型列表」（需登录，内置中转走服务端凭证）；自定义供应商可增删改排，免登录进入页面 |
| `components/chat/AiModelSelect.vue` | 「模型设置」入口：直接跳 `/setting/ai`，不再拦截未登录 |

**内置供应商 = 服务端中转站**（详见 `docs/setting/05-ai-provider-builtin-relay.md`）：模型列表来自 `GET {server}/v1/models`，对话走主进程 relay IPC 代理 `POST {server}/v1/chat/completions`（服务端 apiKey 由主进程注入，渲染层不接触凭证），免费档可用（消耗每日赠送 / 增量包 / 人工充值积分）。

## 注意事项

- 门控是**客户端产品功能**而非安全边界：字体文件与风格数据都在本地磁盘，服务端仅决定 features 契约。
- `membership.expiresAt` 存量类型标注为 `string | null`（authChannels.ts），服务端实际返回毫秒 number（存量遗留，未动）；激活码结果 `AuthCodeRedeemResult` 内的时间戳按 number 处理。
- `DesignStyleStore` 引 `useAuthStore` 须**直连 `@/store/AuthStore` 文件**（经 `@/store` index 会成环：index 再导出 DesignStyleStore）。
- 新增受控能力时：在 `AuthFeatureKey` / `AuthFeatures` / `normalizeAuthFeatures` / 渲染侧 auth.d.ts 四处同步键名，再按「UI 可见锁定 + AI 面过滤 + 渲染不拦」三段式落点。
