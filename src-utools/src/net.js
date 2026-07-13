const { URL } = require('node:url')
const https = require('node:https')
const http = require('node:http')
const { pathToFileURL } = require('url')

module.exports = {
  /**
   * 从url下载一个文件
   * @param url 文件地址
   * @param path 保存的地址
   * @return {Promise<void>}
   */
  downloadFileFromUrl: (url, path) => {
    const file = fs.createWriteStream(path)
    const link = new URL(url)

    return new Promise((resolve, reject) => {
      file
        .on('finish', function () {
          file.close()
          resolve()
        })
        .on('error', (e) => {
          file.close()
          reject(e)
        })
      ;(link.protocol.startsWith('https') ? https : http)
        .get(link, (response) => {
          response.pipe(file)
        })
        .on('error', (error) => {
          reject(error)
        })
        .end()
    })
  },
  pathToHref: (path) => {
    return pathToFileURL(path).href
  }
}
