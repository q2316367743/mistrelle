# 可用性检测工具（大模型中转站健康检测）

> 页面路由 `/attachment/test`（侧边栏「闲庭漫步 → 可用性检测工具」），参考 aibase llm-health：表单配置 → 单任务检测 → 结果概览 / 审计报告 / 执行日志三视图 + 历史记录。

## 实现思路

- **检测执行在渲染层**：全部检测请求复用 `modules/ai` 三格式适配器（`createChatCompletion` / `createChatStream` / `listAiModels`，支持 chat / anthropic / responses），主进程不新增 AI 请求能力。
- **单任务锁**：`useHealthChecks` 为模块级单例 composable（仿 `useImageGenerations`），`running` 状态下配置表单禁用、只能看进度与历史；配合 `App.vue` 的 keep-alive 白名单（`ExtendTestPage`）保证切页不中断。
- **持久化**：主进程只做 DB 透传（list / upsert / delete，仿 image 域），逐项完成即整行 upsert 累积 items / logs（JSON 文本），中断不丢已检项。
- **安全**：API 密钥只用于当次请求，不落库（`model_health` 表无 key 列）。
- **孤儿收尾**：页面挂载 `init()` 把不在运行中的 `running` 行（上次刷新 / 退出中断）收尾为 `stopped`，重算结论并补生成报告。

## 检测项（5 维度 12 项，basic=4 / full=12）

| key | 名称 | 维度 | 判定 |
| --- | --- | --- | --- |
| connect | 接口连通性 | 连通与速度 | 最小请求「回复OK」，2xx 且有内容=通过 |
| latency | 响应时延 | 连通与速度 | 复用 connect 耗时：<3s 通过 / <10s 警告 / ≥10s 失败 |
| stream | 流式输出 | 连通与速度 | stream 请求收到流式内容块 |
| ttft | 首字时延 | 连通与速度 | 复用 stream 首块耗时：<2s 通过 / <5s 警告 / ≥5s 失败 |
| model_list | 模型列表核验 | 模型真实性 | GET /models 是否含 model_id（anthropic 格式 skip；不在列表=警告，可能私映） |
| identity | 模型身份自述 | 模型真实性 | 自述家族（关键词映射）与配置比对：一致通过 / 无法判定警告 / 不一致失败（疑似掺假） |
| usage | 用量上报 | 计费合规 | usage 字段存在且 total_tokens>0；缺失=警告（无法核账） |
| usage_sanity | 用量合理性 | 计费合规 | completion_tokens 与内容长度比 >5x+20=警告（虚报嫌疑；思考模型正常） |
| chinese | 中文理解 | 能力基线 | 「中国的首都」答含「北京」 |
| instruction | 指令遵循 | 能力基线 | 「只回复数字 17×23」严格等于 391 / 含 391=警告 / 否则失败 |
| reasoning | 基础推理 | 能力基线 | 三人身高比较答「小华」 |
| tool_call | 工具调用 | 功能特性 | 携带 tools(get_current_weather)，检查 delta.tool_calls 或 finish_reason=tool_calls；未发起=警告 |

- 共享观测：latency / usage / usage_sanity 复用 connect 请求，ttft 复用 stream 请求（`HealthCheckContext.observed`）。
- 每请求 30s 超时：`AbortSignal.any([taskSignal, AbortSignal.timeout(30_000)])`；停止按钮 abort 任务级 controller，中断处该项标 skip。
- connect 失败后 `requiresConnect` 项级联跳过（model_list 除外，/models 独立端点）。
- 任务级结论：有 fail=danger / 有 warn=risky / 全过=healthy / 无有效项=unknown。

## 数据结构（model_health 表）

一行 = 一次检测任务，迁移 `resources/drizzle/0005_*.sql`：

```
id(PK) / provide_name / api_url / model_id / model_name
format('chat'|'anthropic'|'responses') / mode('basic'|'full')
status('running'|'finished'|'stopped') / conclusion('healthy'|'risky'|'danger'|'unknown')
items(HealthItemResult[] JSON) / logs(HealthLogEntry[] JSON)
duration_ms / created_at + idx_model_health_created
```

`HealthItemResult = { key, name, dimension, status: pass|warn|fail|skip, latencyMs, detail }`；
`HealthLogEntry = { time, level: info|warn|error, message }`。类型定义在 `src/preload/src/dbChannels.ts`（preload/main 不 import 渲染层 entity，`HealthApiFormat` 为独立命名 type），渲染侧 ambient 镜像在 `src/renderer/src/types/db.d.ts`。

**数据库只存关键数据**：审计报告（HTML）由记录标量 + items / logs 动态生成，仅导出时落盘。

## 审计报告（HTML 模板渲染）

- **模板引擎 EJS**（主进程运行时依赖）：模板文件在 `resources/templates/model-health-report.ejs`（与 drizzle 迁移同目录模式：electron-vite main publicDir，dev 自 out/main 相对回源、打包随应用分发）。以后新增 HTML 模板放同目录即可复用整条链路。
- **主进程统一渲染服务** `src/main/src/service/templateRender.ts`：读模板（内存缓存）+ `ejs.render`，模板名白名单校验（`^[a-z0-9][a-z0-9-]*$` 防路径穿越）。
- **IPC 链路**：`src/preload/src/templateChannels.ts`（独立通道文件，`template:render`，不碰贴红线的 channels.ts）→ `src/main/src/ipc/templateIpc.ts`（registerIpc.ts 注册）→ `src/preload/src/template.ts`（`window.preload.template.render({ name, data })` 返回完整 HTML）→ `vite-env.d.ts` 挂类型。
- **安全**：EJS 默认 `<%= %>` HTML 转义——detail 含模型自述 / 错误信息等不可信文本，模板侧禁止 `<%- %>`；预览用 `<iframe :srcdoc sandbox="">` 完全隔离（无脚本无同源）。
- **产物**：自包含单文件 HTML（内联 CSS，Fluent 风格：结论渐变横幅 + 四统计卡 + 基本信息卡 + 维度明细表 + 日志时间线），`@media print` 优化——浏览器 Ctrl+P 可直接另存 PDF。
- **导出**：历史详情抽屉「导出 HTML 报告」→ `useHealthChecks.exportReport(record)` 动态生成 → **`dialog.save` 让用户自选路径**（2026-08-26 与 compare 统一；原固定目录 `~/.mistrelle/health/report` 已弃用）→ 写文件 → `showItemInFolder` 定位 + 抽屉内路径 t-link（用户取消则无副作用）。
- 模板数据契约：渲染侧 `health-report.ts` 预处理 view model（stats / info / groups / logs 格式化），模板只做展示循环；契约注释写在模板文件头部。

## 关键文件

| 文件 | 职责 |
| --- | --- |
| `pages/extend/test/ExtendTestPage.vue` | 页面骨架（defineOptions name 供 keep-alive include 匹配） |
| `pages/extend/test/useHealthChecks.ts` | 单例 composable：运行锁 / 顺序编排 / 逐项落库 / 停止 / 孤儿收尾 / 报告重生成 |
| `pages/extend/test/health-check-items.ts` | 12 检测项定义 + 执行器 + 模型家族关键词映射 |
| `pages/extend/test/health-report.ts` | 结论计算 + 审计报告 view model 组装（buildHealthReport 调主进程模板渲染，async） |
| `components/HealthConfigForm.vue` | 表单：已配置模型一键选择（含禁用项，label 带「已禁用」）自动填充地址 / 密钥 / 模型 / 格式，均可手改；套餐 radio |
| `components/HealthRunPanel.vue` | 任务状态面板（ID / 结论 / 进度 / 停止）+ 实时结果 |
| `components/HealthResultView.vue` | 三视图（概览按维度分组 / 报告 / 日志），页面与抽屉共用；`autoScrollLogs` 供运行中滚动 |
| `components/HealthHistoryList.vue` | 历史表格（通过率 = 通过数 / 有效项数，skip 不计） |
| `modals/HealthRecordDrawer.tsx` + `Content.vue` | DrawerPlugin 命令式抽屉，查看历史详情 + 导出 HTML 报告（路径 t-link 定位） |
| `resources/templates/model-health-report.ejs` | 审计报告 EJS 模板（自包含 HTML，头部注释写明数据契约） |
| `src/main/src/{service/templateRender,ipc/templateIpc}.ts` | 主进程模板渲染服务与 IPC handler |
| `src/main/src/db/{schema,repo}/health*` | Drizzle schema + DAO（仿 image 域） |

IPC 链路五处同步：`dbChannels.ts`（db:health:list/upsert/delete + 类型）→ `dbIpc.ts`（handler）→ `preload/db.ts`（`dbApi.health`）→ `types/db.d.ts`（ambient）→ 渲染层 `window.preload.db.health.*`。

## 注意事项

- 模型选择器数据源为 `useSettingAiStore().items` 直接遍历（**不过滤 enable**，仅筛 `type === 'chat'`）；`optionMap` / `options` 会过滤禁用项，勿用。
- `createChatCompletion` 只聚合 `delta.content`（思考增量不混入）；tool_call 检测必须直接消费 `createChatStream` 看 `delta.tool_calls`。
- 渲染层 reload 会留下孤儿 running 行，靠 `init()` 收尾；不要在 main 侧起检测任务（会重复实现三格式协议）。
- keep-alive 白名单在 `App.vue` 的 `keepAliveNames`，与组件 `defineOptions({ name })` 精确匹配。
- 报告 HTML **不落库**（表无 report 列），预览 / 导出均由数据动态生成；`buildHealthReport` 是 async（跨 IPC 调主进程 EJS 渲染），computed 里不能直接 await，用 watch + ref（见 HealthRunPanel / 抽屉）。
- 新增 HTML 模板：放 `resources/templates/<name>.ejs`（name 仅小写字母 / 数字 / 连字符）→ 渲染层 `window.preload.template.render({ name, data })`；模板内插值一律 `<%= %>`。
