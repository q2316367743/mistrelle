const os = require('node:os')
const { join, resolve, basename, dirname, sep, extname, normalize } = require('node:path')

module.exports = {
  join: (...paths) => join(...paths),
  resolve: (...paths) => resolve(...paths),
  basename: (path, ext) => basename(path, ext),
  dirname: (path) => dirname(path),
  extname: (path) => extname(path),
  sep: sep,
  // node:path.normalize 不展开 ~；~ 仅 POSIX 约定，Windows 不处理，展开后再交给内置 normalize 规范化
  normalizePath: (path) =>
    normalize(process.platform === 'win32' ? path : path.replace(/^~/, os.homedir()))
}
