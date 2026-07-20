declare interface ZipApi {
  /**
   * 压缩方法，传入路径数组，和zip 路径，将路径的文件/文件夹压缩到指定路径
   * @param zipPath 压缩文件路径
   * @param paths 要压缩的文件/文件夹路径数组
   */
  compress: (zipPath: string, paths: string[]) => Promise<void>
  /**
   * 解压方法，传入 zip 路径和解压目录，将 zip 的内容解压到指定目录下，如果目标目录不存在，则自动创建
   * @param zipPath zip 文件路径
   * @param targetDic 解压目录
   */
  extract: (zipPath: string, targetDic: string) => Promise<void>
}
