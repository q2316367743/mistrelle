const { URL } = require('node:url')
const https = require('node:https')
const http = require('node:http')
const fs = require('node:fs')
const { pathToFileURL } = require('url')

module.exports = {
  /**
   * 从url下载一个文件
   * @param url 文件地址
   * @param path 保存的地址
   * @param onProgress 下载进度回调
   * @return {Promise<void>}
   */
  downloadFileFromUrl: (url, path, onProgress) => {
    const file = fs.createWriteStream(path)
    const link = new URL(url)

    return new Promise((resolve, reject) => {
      let total = 0
      let loaded = 0

      const cleanup = () => {
        file.close()
        if (fs.existsSync(path)) {
          fs.unlinkSync(path)
        }
      }

      file
        .on('finish', function () {
          file.close()
          resolve()
        })
        .on('error', (e) => {
          cleanup()
          reject(e)
        })

      const protocol = link.protocol.startsWith('https') ? https : http

      protocol
        .get(link, (response) => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            cleanup()
            reject(new Error(`Download failed with status code ${response.statusCode}`))
            return
          }

          total = parseInt(response.headers['content-length'] || '0', 10)

          response.on('data', (chunk) => {
            loaded += chunk.length
            if (typeof onProgress === 'function') {
              onProgress({
                total,
                loaded,
                percent: total > 0 ? Math.round((loaded / total) * 100) : 0
              })
            }
          })

          response.pipe(file)
        })
        .on('error', (error) => {
          cleanup()
          reject(error)
        })
        .end()
    })
  },
  pathToHref: (path) => {
    return pathToFileURL(path).href
  }
}
