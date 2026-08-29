/**
 * path 模块（preload）：原 src-utools/src/path.js 的 TS 移植。
 * 纯字符串函数、无特权，留在 preload 侧同步实现（renderer 200 处内联调用零改动）。
 */
import os from 'node:os'
import { join, resolve, basename, dirname, sep, extname, normalize } from 'node:path'

export const pathApi = {
  join: (...paths: string[]): string => join(...paths),
  resolve: (...paths: string[]): string => resolve(...paths),
  basename: (path: string, ext?: string): string => basename(path, ext),
  dirname: (path: string): string => dirname(path),
  extname: (path: string): string => extname(path),
  sep,
  // node:path.normalize 不展开 ~；~ 仅 POSIX 约定，Windows 不处理，展开后再交给内置 normalize 规范化
  normalizePath: (path: string): string =>
    normalize(process.platform === 'win32' ? path : path.replace(/^~/, os.homedir()))
}
