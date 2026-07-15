/// <reference types="vite/client" />
/// <reference path="./types/inject.d.ts" />

interface RouteMeta {
  hidden?: boolean
  icon: JSX.Element
}

interface Window {
  preload: {
    net: {
      /**
       * 从url下载一个文件到指定目录
       * @param url 链接
       * @param path 要保存的文件路径，包含文件名
       */
      downloadFileFromUrl(url: string, path: string): Promise<void>
      /**
       * 将路径转换为href
       * @param path 路径
       */
      pathToHref(path: string): string
    }
    inject: InjectApi
  }
}
