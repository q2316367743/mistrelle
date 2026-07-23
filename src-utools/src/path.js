const { join, resolve } = require('node:path')

module.exports = {
  join: (...paths) => join(...paths),
  resolve: (...paths) => resolve(...paths)
}
