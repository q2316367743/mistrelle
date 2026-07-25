const { join, resolve, basename, dirname, sep } = require('node:path')

module.exports = {
  join: (...paths) => join(...paths),
  resolve: (...paths) => resolve(...paths),
  basename: (path, ext) => basename(path, ext),
  dirname: (path) => dirname(path),
  sep: sep
}
