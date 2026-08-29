/**
 * font IPC handler（main 进程）：系统字体枚举 + 资源库管理。
 * getAssetsDir / getFontCachePath 为纯路径常量，保留在 preload 侧同步实现。
 */
import { ipcMain } from 'electron'
import {
  listFonts,
  listSystemFontsApi,
  listLibraryApi,
  addFontApi,
  removeFontApi,
  updateFontMetaApi,
  parseFontFamilyNameApi,
  readFont
} from '$/font'
import { FontChannels } from '~/ipc/channels'

export function registerFontIpc(): void {
  ipcMain.handle(FontChannels.listFonts, () => listFonts())
  ipcMain.handle(FontChannels.listSystemFonts, () => listSystemFontsApi())
  ipcMain.handle(FontChannels.listLibrary, () => listLibraryApi())
  ipcMain.handle(FontChannels.addFont, (_event, srcPath: string, meta) => addFontApi(srcPath, meta))
  ipcMain.handle(FontChannels.removeFont, (_event, name: string) => removeFontApi(name))
  ipcMain.handle(FontChannels.updateFontMeta, (_event, name: string, meta) =>
    updateFontMetaApi(name, meta)
  )
  ipcMain.handle(FontChannels.parseFontFamilyName, (_event, filePath: string) =>
    parseFontFamilyNameApi(filePath)
  )
  ipcMain.handle(FontChannels.readFont, (_event, filePath: string) => readFont(filePath))
}
