/**
 * webUtils 桥（preload）：Electron 32+ 移除了 File.path，改由 webUtils.getPathForFile
 * 在渲染 / preload 进程内将 File 对象还原为真实磁盘路径（拖入或粘贴的磁盘文件）。
 *
 * 参数类型借用 electron 声明的 File 签名（Parameters<...>）：preload tsconfig 无 DOM lib，
 * 直接书写全局 `File` 会报未定义，故不回退为裸 File 名、也不引入 DOM lib 扩大全局作用域。
 */
import { webUtils } from 'electron'

type GetPathForFile = typeof webUtils.getPathForFile

export const webUtilsApi = {
  getPathForFile: ((file: Parameters<GetPathForFile>[0]): string => webUtils.getPathForFile(file))
}
