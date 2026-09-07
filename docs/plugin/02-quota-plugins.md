# 02 额度插件体系（独立公共域：内置预置 + 插件目录）

> **额度插件是独立公共域**（`src/main/src/buddy/quota/`），不依附任何设备——ESP32 LCD 只是当前的消费方之一，未来更多硬件都会消费额度快照。统一插件模型：内置预置与第三方目录插件走同一契约、同一执行器、同一配置结构、同一 UI 卡片；**内置是可关闭的预置形态**（`enabled=false` 即不参与执行），为未来「在线插件列表 + 版本 → 下载到目录本地更新」预留演进位（在线接口暂未实现，本地模型已留口）。

## 域边界与消费关系

```
quota 域（配置 ~/.mistrelle/buddy/quota.json + 插件扫描/执行/调度）
  ├─ quota:* IPC → 渲染层「额度插件」独立页面（伙伴窗口 /plugins/quota）
  ├─ quota:snapshot 推送 → 渲染层快照展示（圆屏页等）
  └─ quotaBus（main 内 pub/sub）→ 订阅设备自行消费
        └─ esp32LcdService init 内订阅 → 串口 JSON 下发屏幕（设备是消费方，非归属方）
```

- 设备消费额度 = 设备域 init 内 `subscribeQuotaSnapshot`，quota 域不感知任何设备与串口（依赖单向）
- 新增消费硬件：设备域订阅 quotaBus 即可，quota 域与插件页零改动

## 插件目录与安装

- 目录：`~/.mistrelle/buddy/plugins/`，**归用户所有，应用只读扫描不写入**
- 安装第三方插件 = 把单文件 `.js` 放入目录（definePlugin 契约，与内置完全一致）→ 插件页「刷新插件列表」；**替换文件即更新**，下次刷新额度自动生效
- 文件名白名单 `^[A-Za-z0-9._-]+\.js$`（防路径穿越）；扫描失败/语法错误的文件记 `error` 展示，不拖垮其他插件
- UI 入口：伙伴窗口「额度插件」独立页面（`/plugins/quota`，仅插件配置；圆屏页只留运行控制与快照展示，经 t-link 跳转）

## 插件契约（内置与第三方一致）

```js
definePlugin({
  id: 'xxx',
  name: '显示名',
  settings: [{ key: 'apiKey', label: 'API Key', secret: true, placeholder: '…' }],  // 可选；secret 项 UI 用密码框，placeholder 为输入占位提示
  async fetch(ctx) {
    // ctx.settings = 该插件的持久化键值；ctx.fetch(url, {headers}) = 极简 HTTP（15s 超时，回 {status, body}）
    return {
      items: [{
        label: 'DeepSeek 余额', value: '110.00 元',   // UI 展示（必填）
        // —— 以下屏显字段可选；带屏显字段的条目才会经心跳协议下发到 LCD 等屏幕 ——
        screenTemplate: 'deepseek',   // 屏显模板（codex=按次额度 / deepseek=剩余价值）
        screenPct: 45,                // 进度环 0..100（缺省 100）
        screenValue: '110.00',        // 核心数值（仅 [0-9.]，≤15 字符）
        screenUnit: '元'              // 单位（≤7 字节 UTF-8）
      }]
    }  // 条目 ≤ 8
  }
})
```

- 恰好调用一次 `definePlugin`；`id/name/settings` 元数据由脚本声明、`collectQuotaPlugin` 取出（单一事实源），列表展示与执行同源
- 屏显字段逐项校验（枚举/范围/字符集），非法字段忽略不影响 UI 展示；heartbeat 行组装见圆屏域 `lcdProtocol.ts`
- **脚本在主进程 Node 环境执行，无沙箱**：本地自写脚本信任模型，勿粘贴运行不可信脚本
- **最大额度兜底语义（内置 deepseek）**：deepseek 声明第二个设置项 `maxQuota`（最大额度，币种随余额）。每次刷新计算
  `screenPct = 余额 / maxQuota × 100`（归一化钳制 0..100）；**未设置/非法时以本次拉到的余额为分母**——圆环满格；
  填了最大额度后圆环随消耗下降，该兜底是每次动态计算、不做首次记忆

## 配置结构（`~/.mistrelle/buddy/quota.json`，独立公共域配置）

```jsonc
{
  "intervalMinutes": 5,
  "screen": "deepseek",
  "builtin": { "deepseek": { "enabled": true, "settings": { "apiKey": "sk-…", "maxQuota": "200" } } },
  "external": { "deepseek-plus.js": { "enabled": false, "settings": {} } }
}
```

- 键：builtin = 插件 id；external = 文件名；normalize 兼容旧结构顶层 `apiKey`；command code（曾存在于 esp32-lcd.json 的 `customScript`）已删除，自定义一律落目录文件
- **`screen` = 屏显主额度**：屏幕类设备同时只显示一个额度，`screen` 指定哪条上屏；缺省/无效回落第一条带屏显字段的启用插件。快照聚合全部启用插件（`items` UI 全量预览），主额度条目单独放 `snapshot.main` 供设备消费

## 关键文件

| 层 | 文件 | 职责 |
|----|------|------|
| common | `src/common/types/quota.ts` | 域类型契约（QuotaConfig/QuotaSnapshot/QuotaPluginDescriptor/QuotaApi 等） |
| common | `src/common/buddy/quota/quotaChannels.ts` | 通道常量（6 invoke + 1 推送） |
| main | `src/main/src/buddy/quota/quotaRunner.ts` | `collectQuotaPlugin`（编译收集元数据，不执行）+ `runQuotaScript`（执行，15s 超时 / 条目 ≤8 校验） |
| main | `src/main/src/buddy/quota/builtinPlugins.ts` | 内置插件登记（key + 源码；现仅 deepseek），源码不落盘随版本更新 |
| main | `src/main/src/buddy/quota/externalPlugins.ts` | 插件目录扫描 / 读源码 / 目录惰性创建 |
| main | `src/main/src/buddy/quota/quotaConfig.ts` | `~/.mistrelle/buddy/quota.json` 读写与归一化 |
| main | `src/main/src/buddy/quota/quotaService.ts` | 单例：initQuota（加载+定时器）、runQuotaNow（enabled 插件 → allSettled 汇总 → 渲染层推送 + quotaBus 发布） |
| main | `src/main/src/buddy/quota/quotaBus.ts` | 快照总线（subscribe/publish）：设备域 init 内订阅消费，新增设备零改动 quota 域 |
| main | `src/main/src/buddy/quota/quotaIpc.ts` | quota:* handler 全集 |
| preload | `src/preload/src/modules/quota/quota.ts` | quotaApi 桥；`src/preload/buddy.ts` 注入第 5 域 `quota` |
| renderer | `windows/buddy/pages/plugins/quota/` | 独立插件管理页：QuotaPlugins.vue + useQuota.ts（域状态单例）+ components/QuotaPluginCard.vue |
| renderer | `windows/buddy/pages/hardware/esp32-lcd/components/QuotaPanel.vue` | 圆屏页的额度运行态：间隔 / 立即刷新 / 快照预览 + 跳转插件页 |

## 注意事项

- **内置可关闭**：关闭后完全不执行；因内置随 app 发版更新，若供应商接口大改而新版本未发布，可关闭内置并用目录第三方插件顶替
- **多插件聚合 + 主额度单选**：启用多个插件时全部执行、快照 `items` 聚合（UI 全量预览）；屏幕只显示「屏显额度」选中的那一条（每卡 radio，写入配置 `screen` 键，回落第一条带屏显字段者）
- **演进位**：external 按文件名键控，未来在线安装/更新（下载 js 进目录 + version/source 字段）可无破坏扩展；`listPlugins` 已把 builtin/external 统一为 `QuotaPluginDescriptor`，在线列表可平替该来源
- 配置与运行态分离：插件启停与配置在「额度插件」页；刷新间隔/立即刷新/快照展示在消费设备页（如圆屏页）
- 存量迁移：曾嵌在 `esp32-lcd.json` 的 `quota` 段（含 apiKey）不自动迁移，删除 command code 后重新在插件页配置即可
