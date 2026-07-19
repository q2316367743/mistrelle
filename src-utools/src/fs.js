const { statSync, existsSync } = require('node:fs')
const { readdir, readFile, writeFile, mkdir, rm } = require('node:fs/promises')
const { join } = require('node:path')

module.exports = {
  readDir: async (path) => {
    const names = await readdir(path)
    const paths = []
    for (const name of names) {
      const stat = statSync(join(path, name))
      paths.push({
        name,
        path: join(path, name),
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
        size: stat.size,
        mtime: stat.mtime,
        ctime: stat.ctime,
        atime: stat.atime,
        birthtime: stat.birthtime
      })
    }
    return paths
  },
  writeTextFile: (path, text) => {
    return writeFile(path, text, 'utf-8')
  },
  readTextFile: (path) => {
    return readFile(path, 'utf-8')
  },
  existsSync: (path) => {
    return existsSync(path)
  },
  mkdir: (path, recursive = true) => {
    return mkdir(path, { recursive })
  },
  rm: (path, options = { recursive: true, force: true }) => {
    return rm(path, options)
  }
}
