/// <reference types="vite/client" />
import { AxiosInstance } from 'axios'

declare global {
  interface Window {
    preload: {
      net: {
        /**
         * 从url下载一个文件到指定目录
         * @param url 链接
         * @param path 要保存的文件路径，包含文件名
         * @param onProgress 进度回调
         */
        downloadFileFromUrl(
          url: string,
          path: string,
          onProgress?: (progress: ProgressEvent) => void
        ): Promise<void>
        /**
         * 将路径转换为href
         * @param path 路径
         */
        pathToHref(path: string): string
      }
      inject: InjectApi
      fs: FsApi
      axios: AxiosInstance
    }
  }
}
