const { join } = require('node:path')

module.exports = {
  join: (...paths) => join(...paths)
}
