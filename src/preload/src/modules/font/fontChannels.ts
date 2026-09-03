/**
 * font 域 IPC 契约：通道常量。
 * preload 桥与 main handler 共用，保持两侧契约一致。
 */
// ── font ───────────────────────────────────────────────────
export const FontChannels = {
  listFonts: 'font:listFonts',
  listSystemFonts: 'font:listSystemFonts',
  listLibrary: 'font:listLibrary',
  addFont: 'font:addFont',
  removeFont: 'font:removeFont',
  updateFontMeta: 'font:updateFontMeta',
  parseFontFamilyName: 'font:parseFontFamilyName',
  readFont: 'font:readFont'
} as const
