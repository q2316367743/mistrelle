# 06 · 账号设置页（Fluent 布局）

## 功能概述

「账号设置」页（`/setting/account`）按 Windows 设置页的账户结构重组：顶部身份主视觉 + 分组设置行，不再用两张带标题的 `t-card` 堆叠。

不改数据契约：服务端账号仍走 `AuthStore`；第三方密钥仍走 `SettingAccountStore.state`（deep watch 自动保存）。

## 页面结构

```text
账号设置
管理服务端身份、会员权益与第三方密钥

┌ 身份主视觉 ServerAccountCard ─────────────────┐
│ [头像]  名称 + 档位 Tag          刷新 / 登录     │
│         邮箱 / 会员到期                         │
│ 总积分  |  每日赠送（额度）  |  充值积分          │
└─────────────────────────────────────────────────┘

账户与安全  AccountActionList（仅 signed-in）
  我的会员 / 激活码 / 修改用户名 / 修改密码 / 退出登录

第三方账号  ThirdPartyAccountCard
  SkillHub API Key / 知乎 Access Secret（密码框 + 获取链接 + 已配置 Tag）
```

三态与原先一致：

| `AuthStatus` | 身份区 | 账户与安全 |
|--------------|--------|------------|
| `signed-in`  | 名称/邮箱/档位/到期 + 积分三栏 + 刷新 | 显示 |
| `unknown`    | 「正在连接服务端」+ 重试连接 | 隐藏 |
| `guest`      | 「未登录」+ 登录/注册 + 会员档位 | 隐藏 |

档位 Tag 优先用 `authStore.tiers` 的中文名，找不到再回退 `user.tier` 代码。会员到期用 `user.membership.expiresAt`，`toDateString(..., 'YYYY年M月D日')`。

## 关键文件

| 文件 | 角色 |
|------|------|
| `pages/setting/account/SettingAccountPage.vue` | 页壳：导语 + 三块拼装 |
| `pages/setting/account/components/ServerAccountCard.vue` | 身份主视觉（头像 / 积分 / 未登录与连接中） |
| `pages/setting/account/components/AccountActionList.vue` | 「账户与安全」设置行，打开既有命令式弹窗 |
| `pages/setting/account/components/ThirdPartyAccountCard.vue` | 第三方密钥：`v-model` 到 `SettingAccountStore` |
| `pages/setting/account/components/AccountSettingRow.vue` | 通用设置行（图标 + 标题/描述 + 操作 / 箭头） |

弹窗未改：`EditNameDialog` / `ChangePasswordDialog` / `MemberTierDialog` / `RedeemCodeDialog` / `LoginDialog`。

## 设计约定

- 表面用 Fluent token：`--fluent-card-bg` / `--fluent-card-border` / `--fluent-radius-card` / `--fluent-elevation-1`，不用带标题的 `t-card`
- 设置行 hover 用 `--fluent-item-hover`，可点击行支持 Enter / Space
- 颜色只用 tdesign / fluent CSS Token，不写裸色值
- 第三方密钥 `t-input` 使用 `clearable`（vue-next 属性名，不是 `allow-clear`）

## 注意事项

- 密钥仍是失焦即保存（store deep watch），页面不提供单独「保存」按钮
- 未登录也可打开「会员档位」（公开 `auth:tiers`）；积分数字只在已登录且 `balance` 有值时展示
- `AccountSettingRow` 是账号页私有组件，不要挪到 `src/components`
