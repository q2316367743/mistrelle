# 账户设置 —— 配置文件（~/.mistrelle/account.json，safeStorage 加密）

## 功能概述

「账户设置」页维护的个人信息与第三方密钥（`SettingAccount`：avatar / nickname / skillhub / context7 / zhihu）
已从 lmdb（`/setting/account`，经 `DbStorageUtil` 读写）迁移到根数据目录下的单一 JSON 文件
**`~/.mistrelle/account.json`**，并整文件经 Electron `safeStorage`（OS 密钥链）加密后落盘。

> 不迁移旧 lmdb 数据：`account.json` 不存在时按默认值初始化，旧 db 数据被忽略。

## 加密链路

renderer Service → `window.preload.safeStorage`（preload 薄桥）→ IPC → main `safeStorageIpc` → Electron `safeStorage`：

| 层          | 文件                                                         | 说明                                                          |
|-------------|--------------------------------------------------------------|---------------------------------------------------------------|
| channel     | `src/preload/src/modules/<域>/*Channels.ts`（`SafeStorageChannels`）        | `safeStorage:encrypt` / `safeStorage:decrypt`                  |
| main        | `src/main/src/modules/platform/safeStorageIpc.ts`（`registerIpc.ts` 注册） | `encryptString` → base64 / `decryptString`；不可用或失败返回 null |
| preload     | `src/preload/src/safeStorage.ts`（`preload/index.ts` 挂载）   | 两个 `ipcRenderer.invoke` 薄方法                               |
| renderer 类型 | `src/renderer/src/types/safeStorage.d.ts` + `vite-env.d.ts` | `SafeStorageApi` 契约                                          |

- 后端为 macOS Keychain / Windows DPAPI / Linux libsecret；密钥不进代码。
- **密文绑定本机**：`account.json` 拷贝到其他机器 / 其他 OS 用户后无法解密。
- 降级策略：`safeStorage.isEncryptionAvailable()` 为 false（如 Linux 无 keyring）时 `encrypt` 返回
  null，Service **明文写入**；读取时解密返回 null（不可用 / 明文文件 / 解密失败）按明文 JSON 兼容解析。

## 文件结构

| 文件                                                        | 角色                                                        |
|-------------------------------------------------------------|-------------------------------------------------------------|
| `src/modules/setting/service/SettingAccountService.ts`      | 读写 `account.json` 的 Service（唯一 IO 入口，含加解密与降级） |
| `src/store/setting/SettingAccountStore.ts`                  | 设置 Store：内存态 + 三个派生鉴权配置（deep watch 全量保存）  |
| `src/global/Constant.ts`（`getAccountPath`）                | 文件路径工厂                                                |
| `src/entity/setting/SettingAccount.ts`                      | 数据结构契约                                                |

## 数据结构

`SettingAccount` 整对象 `JSON.stringify` 后加密，文件内容为 base64 密文（无 rev / 无包裹对象）：

```ts
interface SettingAccount {
  avatar: 'man' | 'woman'
  nickname: string
  skillhub: string // SkillHub API key
  context7: string // Context7 API key
  zhihu: string // 知乎开放平台 Access Secret
}
```

## Service API

`src/modules/setting/service/SettingAccountService.ts`

| 函数           | 签名                                             | 说明                                                              |
|----------------|--------------------------------------------------|-------------------------------------------------------------------|
| `accountLoad`  | `() => Promise<SettingAccount \| null>`          | 文件不存在返回 null（不预写空文件）；先解密，null 则按明文 JSON 解析 |
| `accountSave`  | `(account: SettingAccount) => Promise<void>`     | 全量覆写：加密后写密文，不可用时降级明文                            |

## Store 契约

`useSettingAccountStore` 对外暴露不变，调用方零改动（`SettingAccountPage`、`AppSide`、
7 个 SkillHub API、context7 工具、知乎搜索）：

- `state`：账户信息（响应式，设置页 v-model 直接编辑）
- `skillhubConfig` / `context7Config`：computed 鉴权配置
- `zhihuConfig()`：函数（时间戳须现取）
- deep watch 自动全量保存（无冲突控制，单进程唯一写者）

移除项：`rev` 冲突控制、`DbStorageUtil` / `LocalNameEnum.SETTING_ACCOUNT` 依赖。

## 注意事项

- 全量覆写、无防抖 / 原子写，与 `model.json` / `agent.json` 模式一致。
- 解密失败（如 OS 凭据变更）时 `accountLoad` 抛错、store 记日志并回退默认值；需手动删除 `account.json` 重建。
- 删除 `LocalNameEnum.SETTING_ACCOUNT` 后，`/setting/account` 的 lmdb 残留数据不再被读取（不清理）。
