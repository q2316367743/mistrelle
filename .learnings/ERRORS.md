# Errors

Command failures and integration errors.

---

## [ERR-20260720-001] t-popup-overlay-inner-style-type

**Logged**: 2026-07-20T21:45:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
TDesign `t-popup` 的 `overlay-inner-style` 不接受 Vue `CSSProperties` 类型。

### Error
```text
Type 'CSSProperties' is not assignable to type 'Styles | ((triggerElement: HTMLElement, popupElement: HTMLElement) => Styles) | undefined'.
```

### Context
- 在 `src/components/chat/LChatSender.vue` 为 Skill 描述弹窗设置固定 300px 宽度。
- 初始写法使用 `CSSProperties`，`vue-tsc` 报类型不兼容。

### Suggested Fix
使用 `Record<string, string>` 这类普通样式对象类型传给 `overlay-inner-style`。

### Metadata
- Reproducible: yes
- Related Files: src/components/chat/LChatSender.vue

### Resolution
- **Resolved**: 2026-07-20T21:46:00+08:00
- **Notes**: 将 `popupStyle` 类型改为 `Record<string, string>`，`pnpm check` 通过。

---
