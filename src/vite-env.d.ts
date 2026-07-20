/// <reference types="vite/client" />
import { AxiosInstance } from 'axios'

declare global {
  interface Window {
    preload: {
      iconv: {
        parseBuffer(buffer: ArrayBufferLike<number>, charset: string): string
        parseArrayBuffer(arrayBuffer: ArrayBuffer, charset: string): string
        convertCharset(content: string, source: string, target?: string): string
      }
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
      crypto: {
        md5: (text: string) => string
        aesEncrypt: (
          data: string,
          key: string,
          iv?: string,
          mode?: 'CBC' | 'ECB'
        ) => Promise<string>
        // AES 解密。
        aesDecrypt: (
          data: string,
          key: string,
          iv?: string,
          mode?: 'CBC' | 'ECB'
        ) => Promise<string>
        // AES 解密，IV 为 Base64 编码的原始字节。适用于服务端随机生成的二进制 IV。
        aesDecryptB64Iv: (
          cipher: string,
          key: string,
          ivB64: string,
          mode?: string
        ) => Promise<string>
        // DES-CBC 加密。
        desEncrypt: (data: string, key: string, iv?: string) => Promise<string>
        // DES-CBC 解密。
        desDecrypt: (data: string, key: string, iv?: string) => Promise<string>
      }
      inject: InjectApi
      fs: FsApi
      path: PathApi
      axios: AxiosInstance
    }
  }
}
