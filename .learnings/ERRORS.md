# Errors

Command failures and integration errors.

---

## [ERR-20260722-001] pnpm-build

**Logged**: 2026-07-22T00:00:00Z
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
`Headers.entries()` 在未启用 `DOM.Iterable` 的 TypeScript 配置中不可用。

### Error
`Property 'entries' does not exist on type 'Headers'.`

### Context
- 执行 `pnpm check` 和 `pnpm build` 时触发。
- 项目 `tsconfig.json` 只启用了 `DOM`，没有启用 `DOM.Iterable`。

### Suggested Fix
使用 `Headers.forEach()` 收集请求头，避免扩大全局 TypeScript lib 配置。

### Metadata
- Reproducible: yes
- Related Files: src/modules/chat/agent/agentStream.ts

### Resolution
- **Resolved**: 2026-07-22T00:00:00Z
- **Notes**: 已改为 `Headers.forEach()`。

---
