# 工具安全策略注册与模块循环依赖约束（toolPolicy）

## 背景

`toolPolicy.ts` 提供工具专属安全策略的注册与裁决：

- `registerToolPolicy(policy)`：按 `policy.name`（工具全名）注册策略
- `resolveToolPolicy(tool, args, ctx)`：裁决本次工具调用权限（allow / ask / deny）

多类工具在各自模块**顶层**调用 `registerToolPolicy` 完成策略注册（article / novel / ppt /
canvas / design 系工具）。这要求 `toolPolicy.ts` 的模块级 `toolPolicies` 常量在任何注册
调用发生前必须已完成初始化。

## 曾经的崩溃（TDZ）

`toolPolicies` 是 `const`（暂时性死区 TDZ）。当模块循环依赖导致 `toolPolicy.ts` 处于
**import 求值阶段**（其顶层 `const toolPolicies` 尚未初始化）时，循环路径恰好回到某个
在模块顶层调用 `registerToolPolicy` 的模块 → 访问 TDZ 中的 `toolPolicies` →
`ReferenceError: Cannot access 'toolPolicies' before initialization`（曾命中
`articleTools.ts:227`）。

原循环链（两条均把 chat / store 全量图拉进 `toolPolicy` 的 import 闭包）：

```
toolPolicy ─► SettingSecureStore ─► @/entity ─► AiChat ─► chat ─► AgentChat ─► ChatTypeConfig ─► articleTools / novelTools / pptTools / canvasTools / design ─► toolPolicy(未初始化)
toolPolicy ─► httpDownloadPolicy ─► @/modules/tool/index ─► components/agent ─► @/store ─► ... 同上
```

## 修复：保持 toolPolicy 的 import 为叶子

让 `toolPolicy.ts` 的 import 闭包**全部为叶子模块**（不含任何 `registerToolPolicy` 调用方），
则 `toolPolicies` 在任何模块加载顺序下都先于所有注册方完成初始化，从结构上消灭该崩溃类。

改动点：

| 文件 | 改动 | 作用 |
|------|------|------|
| `modules/tool/policies/httpDownloadPolicy.ts` | `ToolPolicy` 类型改从 `@/modules/tool/toolPolicyTypes` 导入（type-only） | 切断 `toolPolicy → @/modules/tool/index` 全量图 |
| `store/setting/SettingSecureStore.ts` | `buildSettingSecure` / `getDefaultEgoBrowserPath` 改从 `@/entity/setting/SettingSecured` 直接导入 | 切断 `@/entity → entity/ai → chat` 全量图（该函数本就定义于此，`@/entity` 仅 re-export） |

## 约束（后续 AI 必须遵守）

1. **禁止**在 `toolPolicy.ts` 中新增非叶子 import。若需读取 store / 实体，必须改为从最具体的
   叶子文件导入（如 `@/entity/setting/SettingSecured`），禁止从 `@/entity`、`@/store`、
   `@/modules/tool` 等 barrel 导入。
2. **禁止**在可被上述循环链触及的模块顶层调用 `registerToolPolicy`。新增工具策略时，
   注册位置与工具工厂保持一致（如设计工具注册在 `design/*` 模块顶层、`fontListTool` 在
   `fontTools.ts` 顶层），前提是这些模块不被 `toolPolicy` 的 import 闭包反向触及。
3. 新增工具策略后运行 `npm run typecheck`，并确认 `toolPolicy.ts` 的 import 闭包中
   不存在模块顶层 `registerToolPolicy` 调用。

## 验证

- `npm run typecheck` 通过
- `npm run dev` 启动无 `ReferenceError`（此前在加载期即崩溃）
- ESM 求值模拟：修复后从任何入口求值，模块顶层 `registerToolPolicy` 均发生在
  `toolPolicies` 初始化之后

## 关键文件

- `src/renderer/src/modules/tool/toolPolicy.ts`（注册表与裁决）
- `src/renderer/src/modules/tool/toolPolicyTypes.ts`（`ToolPolicy` / `ToolPolicyContext` 类型）
- `src/renderer/src/modules/tool/policies/*`（browser_actions / http_download 等默认策略）
- `src/renderer/src/store/setting/SettingSecureStore.ts`、`src/renderer/src/entity/setting/SettingSecured.ts`
