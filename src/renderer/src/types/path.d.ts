declare interface PathApi {
  join: (...paths: Array<string>) => string
  resolve: (...paths: Array<string>) => string
  basename: (path: string, ext?: string) => string
  dirname: (path: string) => string
  extname: (path: string) => string
  sep: string
  /** 路径规范化：非 Windows 平台展开开头的 ~ 为当前用户主目录，并交给 node:path.normalize 处理（. / .. / 多余分隔符） */
  normalizePath: (path: string) => string
}
