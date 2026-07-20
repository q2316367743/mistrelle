const { URL } = require('node:url')
const https = require('node:https')
const http = require('node:http')
const fs = require('node:fs')
const axios = require('axios')
const { pathToFileURL } = require('url')

module.exports = {
  /**
   * 从url下载一个文件
   * @param config {require('axios').AxiosRequestConfig} 请求配置
   * @param path 保存的地址
   * @return {Promise<void>}
   */
  downloadFileFromUrl: async (config, path) => {
    const response = await axios({
      ...config,
      adapter: 'http',
      responseType: 'stream',
    })

    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path)
      response.data.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', reject)
      response.data.on('error', reject)
    })
  },
  pathToHref: (path) => {
    return pathToFileURL(path).href
  }
}
