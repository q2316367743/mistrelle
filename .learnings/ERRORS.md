# Errors

Command failures and integration errors.

---

## [ERR-20260721-002] vue-tsc_control_flow_after_async_mutation

**Logged**: 2026-07-21T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: frontend

### Summary
`pnpm check` failed because TypeScript narrowed record status too aggressively around async engine mutation.

### Error
```text
src/pages/discussion/useDiscussionPage.ts(115,50): error TS2367: This comparison appears to be unintentional because the types '"idle" | "running" | "completed"' and '"stopped"' have no overlap.
```

### Context
- Command attempted: `pnpm check`
- `DiscussionEngine.runRound()` mutates `record.value.status`, but TypeScript control-flow analysis does not infer that external async mutation.

### Suggested Fix
Wrap status checks in a small function to avoid stale narrowing in the local control-flow branch.

### Metadata
- Reproducible: yes
- Related Files: src/pages/discussion/useDiscussionPage.ts

### Resolution
- **Resolved**: 2026-07-21T00:00:00+08:00
- **Notes**: Added local `isStopped()` predicate in `runCycle()`.

---

## [ERR-20260721-001] vue-tsc_discussion_status_mapping

**Logged**: 2026-07-21T00:00:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
`pnpm check` failed because discussion message status directly reused chat engine status.

### Error
```text
src/modules/discussion/DiscussionEngine.ts(201,9): error TS2322: Type '"pending" | "streaming" | "complete" | "stop" | "error" | "idle"' is not assignable to type 'AiDiscussionMessageStatus | undefined'.
```

### Context
- Command attempted: `pnpm check`
- `ToolChat.status` includes `idle`, but `AiDiscussionMessageStatus` intentionally does not.

### Suggested Fix
Map `idle` to `complete` before assigning chat status to discussion messages.

### Metadata
- Reproducible: yes
- Related Files: src/modules/discussion/DiscussionEngine.ts

### Resolution
- **Resolved**: 2026-07-21T00:00:00+08:00
- **Notes**: Added `toMessageStatus()` mapping helper in discussion engine.

---
