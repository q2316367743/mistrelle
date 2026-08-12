const { statSync, existsSync } = require('node:fs')
const { readdir, readFile, writeFile, mkdir, rm, copyFile, rename, stat } = require('node:fs/promises')
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
  readBinaryFile: async (path) => {
    const buffer = await readFile(path)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  },
  existsSync: (path) => {
    return existsSync(path)
  },
  mkdir: (path, recursive = true) => {
    return mkdir(path, { recursive })
  },
  rm: (path, options = { recursive: true, force: true }) => {
    return rm(path, options)
  },
  copyFile: (src, dest) => {
    return copyFile(src, dest)
  },
  rename: (src, dest) => {
    return rename(src, dest)
  },
  writeBinaryFile: (path, arrayBuffer) => {
    return writeFile(path, Buffer.from(arrayBuffer))
  },
  stat: async (path) => {
    const s = await stat(path)
    return {
      path,
      isDirectory: s.isDirectory(),
      isFile: s.isFile(),
      size: s.size,
      mtime: s.mtime,
      ctime: s.ctime,
      atime: s.atime,
      birthtime: s.birthtime
    }
  }
}
