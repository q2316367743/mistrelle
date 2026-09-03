# 模型对比检测工具（`/attachment/compare`）

> 多模型横向对比检测：选 2-6 个模型实例（提供方:模型），跑速度 / 题集 / 身份 / 一致性 / usage 计量四类检测，指标×模型矩阵可视化 + md 审计报告。原型为外部 Python 验货脚本（速度 + 6 题集两家对比），本工具为其可视化、多维、多模型、可配置的落地版。

## 实现思路

- **渲染层执行**（同可用性检测工具，见 [01-model-health-tool.md](./01-model-health-tool.md)）：全部请求走 `@/modules/ai` 三格式适配器（chat / anthropic / responses），主进程零 AI 能力；速度轮直接 `for await createChatStream` 逐帧计时（TTFT / 首思考块 / 生成时长 / 末帧 usage），题集轮用 `createChatCompletion` 聚合。
- **SQLite 存数据（2026-08-26 由文件 json 迁移，用户反馈固定格式内容 json 易手改出错 + 历史需分页表）**：题库 `compare_question` 表（逐题 CRUD）+ 对比记录 `model_compare` 表（同 model_health 模式：标量列 + models/results/logs JSON 文本列，created_at 倒序分页）；md 报告**用户手动导出**（`inject.dialog.save` 自选路径，见 `useModelCompare.exportReport`），程序不落固定目录、不自动生成；无偏好持久化（config.json 已删，进页面表单恒用默认值）。
- **单例编排**：`useModelCompare` 模块级单例（keep-alive `ExtendComparePage`），单任务锁 + `AbortController` 全局停止信号 + 每请求 `AbortSignal.any([taskSignal, timeout])`；防抖覆写落库（800ms 合并每请求完成的写放大），阶段边界与收尾强制落盘；init 时孤儿 running 收尾（补中断日志，不生成报告）；历史列表 db 分页（每页 15）。
- **三种执行模式**（表单 radio，默认 mixed）：
  - `parallel` 全并发：所有模型 `Promise.allSettled` 并发跑完整管线（模型内四阶段串行）——最快，速度指标含并发影响；
  - `mixed` 混合：速度轮逐模型串行（指标纯净、水位恒 1）→ 身份 / 题集 / 一致性轮模型间并发（质量指标不受带宽影响）；
  - `serial` 全串行：逐模型完整串行——最慢最准。
- **并发影响评估**：模块级 in-flight 计数器（请求发起 +1 / 结束 -1），速度请求记录发起时水位；总览表与 md 报告对水位 >1 的速度值标注「测速时并发 N」，报告含并发注意事项段。

## 检测管线（compare-runner.ts 四阶段）

| 阶段 | 内容 | 参数 |
| --- | --- | --- |
| 速度轮 | 写 600 字文章 prompt，逐帧计时 TTFT / thinkMs（思考流首块）/ genMs / tokPerSec（usage 精确，缺省字符估算并标注 `tokenSource`）、finishReason（length=截断）、N 次取中位数 | maxTokens 1500 / temperature 0.5 / 超时 180s |
| 身份轮 | 「你是哪家公司开发的哪个大模型」自述全文保留（不同提供方同款模型横向比对） | maxTokens 128 / 超时 30s |
| 题集轮 | 启用题逐题：answerKeys 全包含 && 可选 pattern 正则 → pass；答案全文 / 回答长度 / 截断保留供人工复核 | maxTokens 1024 / temperature 0 / 超时 60s |
| 一致性轮 | 启用题前 N 题各重复 3 次（temperature=0），答案全同 = 稳定 | 同题集轮 |

usage 计量：每请求 usage.prompt/completion_tokens 累计入 `result.usage`（对比表展示）。

## 存储设计（数据库 + 报告文件）

| 位置 | 说明 |
| --- | --- |
| `compare_question` 表 | 题库：`key`(PK) / tag / order_index（规避 SQL 保留字 order）/ enable（boolean 列）/ question / reference / answer_keys（JSON 文本，DAO 解析为数组）/ pattern / note；list 按 order_index 升序；空表（首启）时写入内置 12 题种子，可「恢复默认」全量替换（单事务） |
| `model_compare` 表 | 对比记录：id(PK) / status / exec_mode / speed_runs / consistency_count / models / results / logs（JSON 文本列）/ duration_ms / report_path（历史遗留，不再写入）/ created_at（索引）；分页倒序 |

运行中每阶段完成防抖落库（800ms 合并写放大）；初始化加载完整题库到单例 `bank`（配置表单与题库抽屉共享），历史按页查询 `rowToRecord` 解析 JSON 列。**无偏好持久化**（2026-08-26 用户拍板删除 config.json：不产生任何业务文件读写，进页面表单恒用默认值，速度轮 prompt 内置固定。

## 审计报告链路（md）

`compare-report.ts` 组装 view model（mdCell 统一清洗：压空白 / 转义竖线 `\|` / 截断）→ 主进程 EJS 渲染（`window.preload.template.render({ name: 'model-compare-report', data })`，复用 templateRender 统一服务）→ **渲染为字符串不落盘**；`useModelCompare.exportReport` 弹 `inject.dialog.save` 让用户自选路径 → 写文件 → `showItemInFolder` 定位（用户取消无副作用）。

- **模板例外**：本模板产出 markdown 纯文本，插值用 `<%- %>` 原样输出（`<%= %>` 的 HTML 实体转义会把代码 / JSON 答案污染成 `&lt;` 等）；文本已由 vm 侧统一清洗。HTML 报告仍一律 `<%= %>`。
- 报告结构：参与模型 → 观察摘要（客观数据陈述，不做主观评分）→ 对比总览表（最优 ⭐ + 水位标注）→ 分类能力画像（tag×模型）→ 模型特征（思考型 / 直出、截断率、平均回答长度、累计 tokens）→ 速度明细 → 身份自述 → 题集矩阵 → 答案全文 → 一致性轮 → 并发说明 → 执行日志。

## 关键文件

```
src/main/src/db/schema/compare.ts        # 两表 schema + schema/index.ts 导出
src/main/src/db/repo/compareRepo.ts      # 题库 CRUD + 记录 list/upsert/delete（answerKeys JSON 序列化在 DAO）
src/preload/src/modules/db/dbChannels.ts            # compare 域 7 通道 + 载荷类型
src/main/src/db/dbIpc.ts                # registerDbIpc 内 compare handler
src/preload/src/db.ts                    # dbApi.compare.{question,record}
src/renderer/src/types/db.d.ts           # compare 全局 DB 载荷类型 + CompareDbApi

src/renderer/src/pages/extend/compare/
├── ExtendComparePage.vue                # 页面壳（配置 / 任务状态 / 历史三卡片）
├── compare-types.ts                     # 结构化 UI 类型 + 中文标签（枚举联合独立命名 type）
├── compare-question-bank.ts             # 内置 12 题种子 + 题库 DB 加载/判分
├── compare-runner.ts                    # 四阶段执行器 + in-flight 水位 + usage 累计
├── compare-store.ts                     # 记录 row↔结构化转换 + save/remove + 报告路径
├── useModelCompare.ts                   # 单例编排（三模式 + 防抖落库 + 分页 + 题库操作 + 孤儿收尾）
├── compare-report.ts                    # md 报告 view model + renderCompareReport（纯渲染不落盘）
├── compare-metrics.ts                   # 派生指标纯函数（UI 与报告共用：最优 / 画像 / 摘要）
├── components/                          # ConfigForm / RunPanel（模型卡片 grid）/ LogList /
│                                        # OverviewTable / ProfileMatrix / QuestionMatrix /
│                                        # IdentityPanel / ResultView（四 tabs）/ HistoryList（db 分页）
└── modals/                              # RecordDrawer / AnswersDialog / QuestionBankDrawer /
                                         # QuestionEditDialog（题目编辑用 DialogPlugin，命令式）
resources/templates/model-compare-report.ejs   # md 报告模板
src/renderer/src/global/Constant.ts      # 无 compare 专属目录（报告手动导出自选路径）
src/renderer/src/App.vue                 # keepAliveNames + 'ExtendComparePage'
```

## 数据结构（model_compare 行 / 结构化 CompareRecord）

```ts
// DB 行（JSON 列由渲染侧 rowToRecord 解析；密钥不落库）
CompareRecordInput { id, status, execMode, speedRuns, consistencyCount,
  models /*CompareModelSnapshot[] 文本*/, results /*CompareModelResult[] 文本*/,
  logs /*CompareLogEntry[] 文本*/, durationMs, reportPath, createdAt }

// 结构化（compare-types.ts）：
CompareRecord { id, createdAt, status, config: { execMode, speedRuns, consistencyCount, models },
  results /* 每模型：target(无 key) / status / stage / speedRuns[]（TTFT、thinkMs、tokPerSec、
           tokenSource、finishReason、inFlight）/ speedMedian / identity /
           questions[]（answer 全文、pass、truncated）/ consistency[]（answers[]、allSame）/ usage 累计 */,
  logs, durationMs, reportPath }
```

## 注意事项

- **模型多选数据源**：直接遍历 `aiStore.items`（type==='chat'）含禁用项标注，勿用 `optionMap`/`options`（会过滤禁用）；key = `${provideId}:${identifier}`；运行中表单与题库入口禁用。
- **t-table 动态列**：模型列用 column `cell` 渲染函数（TNode 首参是 `h`，行类型固定 TableRowData 需断言到具体行类型），cell 函数渲染的元素样式须经 `:deep()` 穿透（无 scopeId）；t-table 不接受 `:pagination="null"`（不传即无分页）。
- **进度分母**：`totalRequests = 模型数 × (speedRuns + 1 + 启用题数 + 一致性题数×3)`，分子 `countDoneRequests` 从 results 推导（含失败请求），与分母同口径。
- **题集对齐**：矩阵 / 答案对比按 `question.key` 对齐（中断的模型可能缺尾部题，顺序对齐不可靠）。
- **题库 CRUD 即时保存**：抽屉用 composable 单例 `bank`（init 全量加载）；启停 switch / 编辑弹窗（DialogPlugin）确认后直接 `upsertQuestion` 落库并刷新 bank，无草稿；新增 key = `custom-${ts}`、orderIndex = 当前 max+1；「恢复默认」`replaceAll(种子)` 单事务。
- **写放大**：记录落库 800ms 防抖（每请求完成都会触发 onUpdate），收尾强制 flush；单个 results JSON 含全部答案全文（12 题 × 6 模型 × ~2KB）。
- **一致性轮语义**：allSame = 3 次答案 trim 后全同；波动不代表质量差（可能格式差异），报告措辞为「存在波动」。
- **历史迁移**：此前文件版（`{id}.json`）记录未做导入迁移（功能未发布，旧文件忽略即可）。